import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { companiesTable } from './companies';
import { organizationTable } from './organization';
import { peopleTable } from './people';
import { userTable } from './user';

export const summaryTable = sqliteTable('summary', {
  id: text('id').primaryKey().default(sql`(uuid4())`).notNull(),

  // Structured AI response data
  description: text('description').notNull(),
  insights: text('insights').notNull(), // JSON array of strings
  ratingScore: integer('rating_score').notNull(), // 0-100
  ratingTier: text('rating_tier').notNull(), // 'cold', 'warm', 'hot', 'very_hot'
  ratingReasoning: text('rating_reasoning').notNull(),
  recommendation: text('recommendation').notNull(),

  // Entity references (either person OR company, not both)
  peopleId: text('people_id').references(() => peopleTable.id, { onDelete: 'cascade' }),
  companyId: text('company_id').references(() => companiesTable.id, { onDelete: 'cascade' }),

  // Metadata
  userId: text('user_id')
    .references(() => userTable.id, { onDelete: 'cascade' })
    .notNull(),
  organizationId: text('organization_id')
    .references(() => organizationTable.id, { onDelete: 'cascade' })
    .notNull(),

  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const summaryRelations = relations(summaryTable, ({ one }) => ({
  person: one(peopleTable, {
    fields: [summaryTable.peopleId],
    references: [peopleTable.id],
  }),
  company: one(companiesTable, {
    fields: [summaryTable.companyId],
    references: [companiesTable.id],
  }),
  user: one(userTable, {
    fields: [summaryTable.userId],
    references: [userTable.id],
  }),
  organization: one(organizationTable, {
    fields: [summaryTable.organizationId],
    references: [organizationTable.id],
  }),
}));

export type SummaryType = typeof summaryTable.$inferSelect;
export type SummaryInsert = typeof summaryTable.$inferInsert;
