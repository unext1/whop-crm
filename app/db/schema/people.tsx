import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { companiesTable } from './companies';
import { organizationTable } from './organization';

export const peopleTable = sqliteTable('people', {
  id: text('id').primaryKey().default(sql`(uuid4())`).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  jobTitle: text('job_title'),
  phone: text('phone'),
  linkedin: text('linkedin'),
  twitter: text('twitter'),
  website: text('website'),
  address: text('address'),
  notes: text('notes'),

  companyId: text('company_id')
    .references(() => companiesTable.id)
    .notNull(),
  organizationId: text('organization_id')
    .references(() => organizationTable.id)
    .notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export type PeopleType = typeof peopleTable.$inferSelect;
