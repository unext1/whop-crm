import { relations } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { peopleTable } from './people';
import { companiesTable } from './companies';

export const companiesPeopleTable = sqliteTable('companies_people', {
  companyId: text('company_id')
    .references(() => companiesTable.id, { onDelete: 'cascade' })
    .notNull(),
  personId: text('person_id')
    .references(() => peopleTable.id, { onDelete: 'cascade' })
    .notNull(),
});

export const companiesPeopleRelations = relations(companiesPeopleTable, ({ one }) => ({
  company: one(companiesTable, {
    fields: [companiesPeopleTable.companyId],
    references: [companiesTable.id],
  }),
  person: one(peopleTable, {
    fields: [companiesPeopleTable.personId],
    references: [peopleTable.id],
  }),
}));
