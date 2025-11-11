import { relations } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { companiesTable } from './companies';
import { meetingsTable } from './meetings';

export const meetingsCompaniesTable = sqliteTable('meetings_companies', {
  meetingId: text('meeting_id')
    .references(() => meetingsTable.id, { onDelete: 'cascade' })
    .notNull(),
  companyId: text('company_id')
    .references(() => companiesTable.id, { onDelete: 'cascade' })
    .notNull(),
});

export const meetingsCompaniesRelations = relations(meetingsCompaniesTable, ({ one }) => ({
  meeting: one(meetingsTable, {
    fields: [meetingsCompaniesTable.meetingId],
    references: [meetingsTable.id],
  }),
  company: one(companiesTable, {
    fields: [meetingsCompaniesTable.companyId],
    references: [companiesTable.id],
  }),
}));


