import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// Enums
export const testStatusEnum = pgEnum('test_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PARTIAL',
])

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'APPROVE_ALL',
  'REJECT_ALL',
  'PARTIAL',
])

// Users table
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Test runs table
export const tests = pgTable(
  'tests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    branch: text('branch').notNull(),
    baseBranch: text('base_branch').notNull().default('main'),
    commitHash: text('commit_hash').notNull(),
    commitMessage: text('commit_message'),
    status: testStatusEnum('status').notNull().default('PENDING'),
    totalStories: integer('total_stories').notNull(),
    changedCount: integer('changed_count').notNull(),
    passedCount: integer('passed_count').notNull(),
    failedCount: integer('failed_count').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    userId: text('user_id').references(() => users.id),
  },
  (table) => [index('branch_created_idx').on(table.branch, table.createdAt)]
)

// Story results table
export const storyResults = pgTable(
  'story_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    testId: text('test_id')
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),
    storyId: text('story_id').notNull(), // "ComponentName-StoryName"
    componentName: text('component_name').notNull(),
    storyName: text('story_name').notNull(),
    baselineUrl: text('baseline_url'),
    currentUrl: text('current_url').notNull(),
    diffUrl: text('diff_url'),
    pixelDiff: real('pixel_diff').notNull().default(0),
    ssimScore: real('ssim_score').notNull().default(1),
    hasDiff: boolean('has_diff').notNull().default(false),
    isNew: boolean('is_new').notNull().default(false),
    renderTime: integer('render_time'), // Milliseconds
    memoryUsage: integer('memory_usage'), // Bytes
    approved: boolean('approved'),
  },
  (table) => [index('test_diff_idx').on(table.testId, table.hasDiff)]
)

// Approvals table
export const approvals = pgTable(
  'approvals',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    testId: text('test_id')
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    decision: approvalDecisionEnum('decision').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique('test_user_uniq').on(table.testId, table.userId)]
)

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tests: many(tests),
  approvals: many(approvals),
}))

export const testsRelations = relations(tests, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [tests.userId],
    references: [users.id],
  }),
  stories: many(storyResults),
  approvals: many(approvals),
}))

export const storyResultsRelations = relations(storyResults, ({ one }) => ({
  test: one(tests, {
    fields: [storyResults.testId],
    references: [tests.id],
  }),
}))

export const approvalsRelations = relations(approvals, ({ one }) => ({
  test: one(tests, {
    fields: [approvals.testId],
    references: [tests.id],
  }),
  user: one(users, {
    fields: [approvals.userId],
    references: [users.id],
  }),
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Test = typeof tests.$inferSelect
export type NewTest = typeof tests.$inferInsert
export type StoryResult = typeof storyResults.$inferSelect
export type NewStoryResult = typeof storyResults.$inferInsert
export type Approval = typeof approvals.$inferSelect
export type NewApproval = typeof approvals.$inferInsert
