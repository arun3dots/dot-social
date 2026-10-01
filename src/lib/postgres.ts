import { Pool } from 'pg';
import { PlanTier, Platform, UserRole } from '../types';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env and set your Postgres connection string.'
  );
}

const pool = new Pool({
  connectionString,
});

let isInitialized = false;

export async function initPostgresTables() {
  if (isInitialized) return;

  const client = await pool.connect();
  try {
    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        role VARCHAR(32) NOT NULL DEFAULT 'CREATOR',
        avatar TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        tier VARCHAR(32) NOT NULL DEFAULT 'FREE_TRIAL',
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        max_social_accounts INT DEFAULT 1,
        max_monthly_posts INT DEFAULT 9,
        byok_allowed BOOLEAN DEFAULT FALSE,
        auto_scheduling_enabled BOOLEAN DEFAULT FALSE,
        current_period_end TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_sub_user UNIQUE(user_id)
      );
    `);

    // 3. Social Connections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS social_connections (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(32) NOT NULL,
        account_handle VARCHAR(255) NOT NULL,
        account_name VARCHAR(255),
        connected BOOLEAN DEFAULT TRUE,
        is_sandbox BOOLEAN DEFAULT TRUE,
        access_token TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_user_platform UNIQUE(user_id, platform)
      );
    `);

    // 4. Content Calendars table
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_calendars (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        batch_status VARCHAR(32) DEFAULT 'PENDING_APPROVAL',
        niche TEXT,
        audience TEXT,
        tone TEXT,
        days_json JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 5. Audit Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        platform VARCHAR(32) NOT NULL,
        post_id VARCHAR(64),
        status VARCHAR(32) NOT NULL,
        is_sandbox BOOLEAN DEFAULT TRUE,
        payload JSONB,
        external_id TEXT,
        external_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed initial users if table empty
    const countCheck = await client.query('SELECT COUNT(*) FROM users;');
    if (parseInt(countCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO users (id, email, name, role, avatar)
        VALUES 
          ('usr_creator_01', 'jane@creatorstudio.dev', 'Jane Creator', 'CREATOR', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'),
          ('usr_admin_01', 'admin@antigravity.local', 'Super Admin Master', 'SUPER_ADMIN', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'),
          ('usr_creator_02', 'alex@saaslab.com', 'Alex Growth Ops', 'CREATOR', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100');

        INSERT INTO subscriptions (id, user_id, tier, status, max_social_accounts, max_monthly_posts, byok_allowed, auto_scheduling_enabled)
        VALUES
          ('sub_01', 'usr_creator_01', 'PRO_CREATOR', 'ACTIVE', 3, 100, TRUE, TRUE),
          ('sub_02', 'usr_creator_02', 'AGENCY_SCALE', 'ACTIVE', 999, 9999, TRUE, TRUE);

        INSERT INTO social_connections (id, user_id, platform, account_handle, account_name, connected, is_sandbox)
        VALUES
          ('conn_01', 'usr_creator_01', 'TWITTER', '@jane_creator_x', 'Jane Dev', TRUE, TRUE),
          ('conn_02', 'usr_creator_01', 'LINKEDIN', 'Jane Creator (LinkedIn)', 'Jane Creator', TRUE, TRUE),
          ('conn_03', 'usr_creator_01', 'INSTAGRAM', '@jane_creator_ig', 'Jane Visuals', TRUE, TRUE);
      `);
    }

    isInitialized = true;
  } catch (err: any) {
    console.error('PostgreSQL table init error:', err.message);
  } finally {
    client.release();
  }
}

// Database helper functions
export async function getDbUsers() {
  await initPostgresTables();
  const res = await pool.query(`
    SELECT u.*, 
           s.tier as sub_tier, s.status as sub_status, s.max_social_accounts, s.max_monthly_posts, s.byok_allowed, s.auto_scheduling_enabled,
           COALESCE(
             json_agg(
               json_build_object(
                 'platform', c.platform,
                 'handle', c.account_handle,
                 'connected', c.connected,
                 'isSandbox', c.is_sandbox
               )
             ) FILTER (WHERE c.id IS NOT NULL), '[]'
           ) as connections
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id
    LEFT JOIN social_connections c ON u.id = c.user_id
    GROUP BY u.id, s.id;
  `);

  return res.rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role as UserRole,
    avatar: r.avatar,
    createdAt: r.created_at,
    subscription: {
      tier: (r.sub_tier || 'FREE_TRIAL') as PlanTier,
      status: r.sub_status || 'ACTIVE',
      maxSocialAccounts: r.max_social_accounts || 1,
      maxMonthlyPosts: r.max_monthly_posts || 9,
      byokAllowed: !!r.byok_allowed,
      autoSchedulingEnabled: !!r.auto_scheduling_enabled,
    },
    connections: r.connections || [],
  }));
}

export async function getDbSubscription(userId: string) {
  await initPostgresTables();
  const res = await pool.query('SELECT * FROM subscriptions WHERE user_id = $1;', [userId]);
  if (res.rows.length === 0) {
    return {
      tier: 'FREE_TRIAL' as PlanTier,
      status: 'ACTIVE',
      maxSocialAccounts: 1,
      maxMonthlyPosts: 9,
      byokAllowed: false,
      autoSchedulingEnabled: false,
    };
  }
  const r = res.rows[0];
  return {
    tier: r.tier as PlanTier,
    status: r.status,
    maxSocialAccounts: r.max_social_accounts,
    maxMonthlyPosts: r.max_monthly_posts,
    byokAllowed: r.byok_allowed,
    autoSchedulingEnabled: r.auto_scheduling_enabled,
  };
}

export async function updateDbSubscription(userId: string, tier: PlanTier) {
  await initPostgresTables();
  const limits: Record<PlanTier, { maxSocial: number; maxPosts: number; byok: boolean; auto: boolean }> = {
    FREE_TRIAL: { maxSocial: 1, maxPosts: 9, byok: false, auto: false },
    PRO_CREATOR: { maxSocial: 3, maxPosts: 100, byok: true, auto: true },
    AGENCY_SCALE: { maxSocial: 999, maxPosts: 9999, byok: true, auto: true },
  };

  const l = limits[tier];
  await pool.query(
    `
    INSERT INTO subscriptions (id, user_id, tier, status, max_social_accounts, max_monthly_posts, byok_allowed, auto_scheduling_enabled, updated_at)
    VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET 
      tier = EXCLUDED.tier,
      max_social_accounts = EXCLUDED.max_social_accounts,
      max_monthly_posts = EXCLUDED.max_monthly_posts,
      byok_allowed = EXCLUDED.byok_allowed,
      auto_scheduling_enabled = EXCLUDED.auto_scheduling_enabled,
      updated_at = NOW();
  `,
    [`sub_${Date.now()}`, userId, tier, l.maxSocial, l.maxPosts, l.byok, l.auto]
  );

  return {
    tier,
    status: 'ACTIVE',
    maxSocialAccounts: l.maxSocial,
    maxMonthlyPosts: l.maxPosts,
    byokAllowed: l.byok,
    autoSchedulingEnabled: l.auto,
  };
}

export async function appendDbAuditLog(log: {
  userId?: string;
  platform: Platform;
  postId?: string;
  status: string;
  isSandbox: boolean;
  payload?: any;
  externalId?: string;
  externalUrl?: string;
}) {
  await initPostgresTables();
  await pool.query(
    `
    INSERT INTO audit_logs (id, user_id, platform, post_id, status, is_sandbox, payload, external_id, external_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
  `,
    [
      `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      log.userId || 'usr_creator_01',
      log.platform,
      log.postId || null,
      log.status,
      log.isSandbox,
      log.payload ? JSON.stringify(log.payload) : null,
      log.externalId || null,
      log.externalUrl || null,
    ]
  );
}

export default pool;
