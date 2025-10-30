import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationTable } from './organization';

export const organizationInvitesTable = sqliteTable('organization_invites', {
  id: text('id').primaryKey().notNull(),
  authorizedWhopUserId: text('authorized_whop_user_id').notNull(), // ausr_xxxx,
  organizationId: text('organization_id').references(() => organizationTable.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type OrganizationInvitesType = typeof organizationInvitesTable.$inferSelect;
