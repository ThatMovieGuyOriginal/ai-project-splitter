// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import GitHubProvider from 'next-auth/providers/github';
import { db } from './db';
import { users, accounts, sessions } from './db/schema';

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        
        // Fetch additional user data
        const userData = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.id, user.id),
        });
        
        if (userData) {
          (session.user as any).subscriptionTier = userData.subscriptionTier;
          (session.user as any).subscriptionStatus = userData.subscriptionStatus;
          (session.user as any).repositoriesAnalyzed = userData.repositoriesAnalyzed;
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github' && profile) {
        // Update GitHub info
        await db
          .update(users)
          .set({
            githubId: profile.id?.toString(),
            githubUsername: (profile as any).login,
            updatedAt: new Date(),
          })
          .where((usersTable, { eq }) => eq(usersTable.id, user.id!));
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'database',
  },
};
