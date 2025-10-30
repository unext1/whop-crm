import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationTable } from './organization';

export const companiesTable = sqliteTable('companies', {
  id: text('id').primaryKey().default(sql`(uuid4())`).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  domain: text('domain'),
  website: text('website'),
  industry: text('industry'),
  address: text('address'),
  phone: text('phone'),
  linkedin: text('linkedin'),
  twitter: text('twitter'),

  organizationId: text('organization_id')
    .references(() => organizationTable.id)
    .notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type CompanyType = typeof companiesTable.$inferSelect;
