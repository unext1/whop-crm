import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationTable } from './organization';
import { companiesPeopleTable } from './companies-poeple';

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

  organizationId: text('organization_id')
    .references(() => organizationTable.id)
    .notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const peopleRelations = relations(peopleTable, ({ one, many }) => ({
  organization: one(organizationTable, {
    fields: [peopleTable.organizationId],
    references: [organizationTable.id],
  }),
  companiesPeople: many(companiesPeopleTable),
}));

export type PeopleType = typeof peopleTable.$inferSelect;
