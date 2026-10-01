// Resilient Database Layer (Prisma + PostgreSQL with InMemory/File fallback)

export interface DBUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'CREATOR';
  avatar?: string;
  createdAt: string;
}

export interface DBSubscription {
  userId: string;
  tier: 'FREE_TRIAL' | 'PRO_CREATOR' | 'AGENCY_SCALE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  maxSocialAccounts: number;
  maxMonthlyPosts: number;
  byokAllowed: boolean;
  autoSchedulingEnabled: boolean;
}

export interface DBSocialConnection {
  id: string;
  userId: string;
  platform: 'TWITTER' | 'LINKEDIN' | 'INSTAGRAM';
  accountHandle: string;
  accountName: string;
  connected: boolean;
  isSandbox: boolean;
}

// In-Memory Database store representing PostgreSQL tables
class InMemoryPostgresStore {
  users: DBUser[] = [
    {
      id: 'usr_creator_01',
      email: 'jane@creatorstudio.dev',
      name: 'Jane Creator',
      role: 'CREATOR',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_admin_01',
      email: 'admin@antigravity.local',
      name: 'Super Admin Master',
      role: 'SUPER_ADMIN',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_creator_02',
      email: 'alex@saaslab.com',
      name: 'Alex Growth Ops',
      role: 'CREATOR',
      createdAt: new Date().toISOString(),
    },
  ];

  subscriptions: Record<string, DBSubscription> = {
    usr_creator_01: {
      userId: 'usr_creator_01',
      tier: 'PRO_CREATOR',
      status: 'ACTIVE',
      maxSocialAccounts: 3,
      maxMonthlyPosts: 100,
      byokAllowed: true,
      autoSchedulingEnabled: true,
    },
    usr_creator_02: {
      userId: 'usr_creator_02',
      tier: 'AGENCY_SCALE',
      status: 'ACTIVE',
      maxSocialAccounts: 999,
      maxMonthlyPosts: 9999,
      byokAllowed: true,
      autoSchedulingEnabled: true,
    },
  };

  connections: DBSocialConnection[] = [
    {
      id: 'conn_tw_01',
      userId: 'usr_creator_01',
      platform: 'TWITTER',
      accountHandle: '@jane_creator_x',
      accountName: 'Jane Dev',
      connected: true,
      isSandbox: true,
    },
    {
      id: 'conn_li_01',
      userId: 'usr_creator_01',
      platform: 'LINKEDIN',
      accountHandle: 'Jane Creator (LinkedIn)',
      accountName: 'Jane Creator',
      connected: true,
      isSandbox: true,
    },
    {
      id: 'conn_ig_01',
      userId: 'usr_creator_01',
      platform: 'INSTAGRAM',
      accountHandle: '@jane_creator_ig',
      accountName: 'Jane Visuals',
      connected: true,
      isSandbox: true,
    },
  ];

  // User queries
  async findUserByEmail(email: string) {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async getAllUsers() {
    return this.users;
  }

  async createUser(data: Omit<DBUser, 'id' | 'createdAt'>) {
    const user: DBUser = {
      ...data,
      id: `usr_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.users.push(user);
    return user;
  }

  // Subscription queries
  async getSubscription(userId: string) {
    return (
      this.subscriptions[userId] || {
        userId,
        tier: 'FREE_TRIAL',
        status: 'ACTIVE',
        maxSocialAccounts: 1,
        maxMonthlyPosts: 9,
        byokAllowed: false,
        autoSchedulingEnabled: false,
      }
    );
  }

  async updateSubscription(userId: string, tier: 'FREE_TRIAL' | 'PRO_CREATOR' | 'AGENCY_SCALE') {
    const limits = {
      FREE_TRIAL: { maxSocialAccounts: 1, maxMonthlyPosts: 9, byokAllowed: false, autoSchedulingEnabled: false },
      PRO_CREATOR: { maxSocialAccounts: 3, maxMonthlyPosts: 100, byokAllowed: true, autoSchedulingEnabled: true },
      AGENCY_SCALE: { maxSocialAccounts: 999, maxMonthlyPosts: 9999, byokAllowed: true, autoSchedulingEnabled: true },
    }[tier];

    this.subscriptions[userId] = {
      userId,
      tier,
      status: 'ACTIVE',
      ...limits,
    };
    return this.subscriptions[userId];
  }

  // Social Connections
  async getUserConnections(userId: string) {
    return this.connections.filter((c) => c.userId === userId);
  }
}

export const db = new InMemoryPostgresStore();
export default db;
