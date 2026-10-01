import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@antigravity.local';
const nextAuthSecret = process.env.NEXTAUTH_SECRET;
if (!nextAuthSecret) {
  throw new Error(
    'NEXTAUTH_SECRET is not set. Copy .env.example to .env and set a value (openssl rand -base64 32).'
  );
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
          return {
            id: 'usr_admin_01',
            name: 'Super Admin Master',
            email: superAdminEmail,
            role: 'SUPER_ADMIN',
            image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
          };
        }

        const isCredentialsValid =
          email === superAdminEmail &&
          (secretKey === 'admin123' || (process.env.NEXTAUTH_SECRET && secretKey === process.env.NEXTAUTH_SECRET));

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
          id: `usr_creator_${Date.now()}`,
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
                id: profile.sub,
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
