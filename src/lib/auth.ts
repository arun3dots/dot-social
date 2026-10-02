import { NextAuthOptions } from 'next-auth';
import crypto from 'crypto';
import pool from './postgres';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@antigravity.local';
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
if (!nextAuthSecret) {
  throw new Error(
    'NEXTAUTH_SECRET is not set. Copy .env.example to .env and set a value (openssl rand -base64 32).'
  );
}

// Demo logins return a session with NO credential check, so they may only exist
// outside production (or when explicitly enabled).
const demoAllowed =
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_LOGIN === 'true';

// Same person must always map to the same user row. Previously creators got
// `usr_creator_${Date.now()}` — a NEW id on every login, which made per-user
// persistence impossible.
function stableUserId(email: string): string {
  return 'usr_' + crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 20);
}

// Upsert on every sign-in so the database, not the client, decides who you are.
async function upsertUser(email: string, name: string | null, preferredId: string): Promise<string> {
  const id = preferredId || stableUserId(email);
  try {
    const res = await pool.query(
      `INSERT INTO users (id, email, name, role)
       VALUES ($1, $2, $3, 'CREATOR')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [id, email, name || email.split('@')[0]]
    );
    return res.rows[0]?.id || id;
  } catch (e) {
    // Never block sign-in on a database hiccup; fall back to the deterministic id.
    console.error('upsertUser failed:', (e as Error).message);
    return id;
  }
}

export const authOptions: NextAuthOptions = {
  secret: nextAuthSecret,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    // 1. Super Admin Credentials Provider
    CredentialsProvider({
      id: 'admin-credentials',
      name: 'Super Admin Credentials',
      credentials: {
        email: { label: 'Admin Email', type: 'email' },
        secretKey: { label: 'Secret Key', type: 'password' },
        isDemo: { label: 'Demo Mode', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const isDemo = credentials.isDemo === 'true' || credentials.isDemo === true as any;
        const email = credentials.email?.trim();
        const secretKey = credentials.secretKey;

        if (isDemo) {
          if (!demoAllowed) {
            throw new Error('Demo login is disabled in production. Set ALLOW_DEMO_LOGIN=true to enable it.');
          }
          return {
            id: 'usr_admin_01',
            name: 'Super Admin Master',
            email: superAdminEmail,
            role: 'SUPER_ADMIN',
            image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
          };
        }
        const adminSecretKey = (process.env.SUPER_ADMIN_SECRET_KEY || '').trim();

        const isCredentialsValid =
          !!adminSecretKey &&
          !!email &&
          email === superAdminEmail &&
          secretKey === adminSecretKey;

        if (!isCredentialsValid) {
          throw new Error('Invalid Super Admin credentials. Access denied.');
        }

        return {
          id: 'usr_admin_01',
          name: 'Super Admin Master',
          email: superAdminEmail,
          role: 'SUPER_ADMIN',
          image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        };
      },
    }),

    // 2. Creator Credentials Provider
    CredentialsProvider({
      id: 'creator-credentials',
      name: 'Creator Credentials',
      credentials: {
        email: { label: 'Creator Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
        isDemo: { label: 'Demo Mode', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const isDemo = credentials.isDemo === 'true' || credentials.isDemo === true as any;
        const email = credentials.email?.trim().toLowerCase();

        if (isDemo) {
          if (!demoAllowed) {
            throw new Error('Demo login is disabled in production. Set ALLOW_DEMO_LOGIN=true to enable it.');
          }
          return {
            id: 'usr_creator_demo',
            name: 'Jane Creator',
            email: 'jane@creatorstudio.dev',
            role: 'CREATOR',
            image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
          };
        }

        if (!email || !email.includes('@') || !email.includes('.')) {
          throw new Error('Invalid creator email address. Please provide a valid email (e.g., creator@techstart.io).');
        }

        return {
          id: stableUserId(email),
          name: credentials.name || email.split('@')[0],
          email,
          role: 'CREATOR',
          image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        };
      },
    }),

    // 3. Optional Google OAuth Provider (activated when keys provided)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            profile(profile) {
              return {
                // Google's `sub` is provider-specific; the app keys every user by email, so derive the
                // same id as every other sign-in path (usr_<sha256(email)>). Using `sub` here split one
                // person across two ids and made social_connections INSERTs violate the users.id FK.
                id: profile.email ? stableUserId(profile.email) : profile.sub,
                name: profile.name,
                email: profile.email,
                image: profile.picture,
                role: 'CREATOR',
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user?.email) {
        user.id = await upsertUser(user.email, user.name ?? null, user.id as string);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'CREATOR';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || 'CREATOR';
      }
      return session;
    },
  },
};
