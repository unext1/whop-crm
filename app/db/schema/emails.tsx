import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { organizationTable } from './organization';

export const emailsTable = sqliteTable('emails', {
  id: text('id').primaryKey().default(sql`(uuid4())`).notNull(),
  email: text('email').notNull(),
  type: text('type').default('work'), // work, personal, other
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),

  organizationId: text('organization_id')
    .references(() => organizationTable.id)
    .notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type EmailType = typeof emailsTable.$inferSelect;
