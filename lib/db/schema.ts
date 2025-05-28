// lib/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  decimal,
  uuid,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  githubId: text('github_id').unique(),
  githubUsername: text('github_username'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  
  // Subscription info
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionStatus: text('subscription_status').$type<'active' | 'inactive' | 'past_due' | 'canceled'>().default('inactive'),
  subscriptionTier: text('subscription_tier').$type<'free' | 'pro' | 'team'>().default('free'),
  subscriptionEndDate: timestamp('subscription_end_date'),
  
  // Usage tracking
  repositoriesAnalyzed: integer('repositories_analyzed').default(0),
  lastAnalysisAt: timestamp('last_analysis_at'),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  githubIdIdx: index('users_github_id_idx').on(table.githubId),
}));

// Accounts table (NextAuth)
export const accounts = pgTable('accounts', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => ({
  compoundKey: primaryKey(table.provider, table.providerAccountId),
}));

// Sessions table (NextAuth)
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').notNull().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires').notNull(),
});

// Repositories table
export const repositories = pgTable('repositories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  githubId: integer('github_id').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  description: text('description'),
  language: text('language'),
  isPrivate: boolean('is_private').default(false),
  url: text('url').notNull(),
  defaultBranch: text('default_branch').default('main'),
  
  // Analysis metadata
  lastAnalyzedAt: timestamp('last_analyzed_at'),
  analysisCount: integer('analysis_count').default(0),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('repositories_user_id_idx').on(table.userId),
  githubIdIdx: index('repositories_github_id_idx').on(table.githubId),
}));

// Repository analyses table
export const repositoryAnalyses = pgTable('repository_analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  repositoryId: uuid('repository_id').notNull().references(() => repositories.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // Analysis results
  overallScore: integer('overall_score').notNull(), // 0-100
  complexityGrade: text('complexity_grade').notNull(), // A-F
  maintainabilityScore: integer('maintainability_score').notNull(),
  securityRisk: text('security_risk').$type<'low' | 'medium' | 'high' | 'critical'>().notNull(),
  technicalDebt: integer('technical_debt').notNull(), // Hours
  
  // Metrics
  totalFiles: integer('total_files').notNull(),
  totalLinesOfCode: integer('total_lines_of_code').notNull(),
  averageComplexity: decimal('average_complexity', { precision: 10, scale: 2 }).notNull(),
  testCoverage: decimal('test_coverage', { precision: 5, scale: 2 }), // Percentage
  
  // Detailed analysis (JSON)
  fileAnalyses: jsonb('file_analyses').$type<any[]>(),
  clusters: jsonb('clusters').$type<any[]>(),
  dependencies: jsonb('dependencies').$type<Record<string, string[]>>(),
  securityIssues: jsonb('security_issues').$type<any[]>(),
  recommendations: jsonb('recommendations').$type<string[]>(),
  
  // Network metrics
  modularityScore: decimal('modularity_score', { precision: 5, scale: 4 }),
  networkDensity: decimal('network_density', { precision: 5, scale: 4 }),
  clusteringCoefficient: decimal('clustering_coefficient', { precision: 5, scale: 4 }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  repositoryIdIdx: index('analyses_repository_id_idx').on(table.repositoryId),
  userIdIdx: index('analyses_user_id_idx').on(table.userId),
  createdAtIdx: index('analyses_created_at_idx').on(table.createdAt),
}));

// User achievements/badges
export const userAchievements = pgTable('user_achievements', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementType: text('achievement_type').notNull(), // 'first_analysis', 'quality_improver', 'security_champion', etc.
  title: text('title').notNull(),
  description: text('description'),
  iconName: text('icon_name'),
  earnedAt: timestamp('earned_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('achievements_user_id_idx').on(table.userId),
}));

// Usage tracking for rate limiting
export const usageTracking = pgTable('usage_tracking', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'analysis', 'github_sync', etc.
  resourceId: text('resource_id'), // Repository ID, etc.
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  metadata: jsonb('metadata'),
}, (table) => ({
  userIdIdx: index('usage_user_id_idx').on(table.userId),
  timestampIdx: index('usage_timestamp_idx').on(table.timestamp),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  repositories: many(repositories),
  analyses: many(repositoryAnalyses),
  achievements: many(userAchievements),
  usage: many(usageTracking),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  user: one(users, { fields: [repositories.userId], references: [users.id] }),
  analyses: many(repositoryAnalyses),
}));

export const repositoryAnalysesRelations = relations(repositoryAnalyses, ({ one }) => ({
  repository: one(repositories, { fields: [repositoryAnalyses.repositoryId], references: [repositories.id] }),
  user: one(users, { fields: [repositoryAnalyses.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, { fields: [userAchievements.userId], references: [users.id] }),
}));

export const usageTrackingRelations = relations(usageTracking, ({ one }) => ({
  user: one(users, { fields: [usageTracking.userId], references: [users.id] }),
}));
