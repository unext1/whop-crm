import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const organizationTable = sqliteTable('organizations', {
  id: text('id').primaryKey().notNull(), // biz_xxxx,
  name: text('name'),
  ownerId: text('owner_id'), // ausr_xxxx,
  plan: text('plan').default('free'),
  membershipId: text('membership_id'), // mem_xxxx - the active membership to the app
  subscriptionStart: text('subscription_start'),
  subscriptionEnd: text('subscription_end'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type OrganizationType = typeof organizationTable.$inferSelect;
