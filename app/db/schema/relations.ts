import { relations } from 'drizzle-orm';
import { companiesTable } from './companies';
import { emailsTable } from './emails';
import { organizationTable } from './organization';
import { peopleTable } from './people';
import { peopleEmailsTable } from './people-emails';
import { meetingsTable } from './meetings';
import { boardTable } from '../kanban-schemas/board';
import { userTable } from './user';

// Organization relations
export const organizationRelations = relations(organizationTable, ({ one, many }) => ({
  companies: many(companiesTable),
  emails: many(emailsTable),
  people: many(peopleTable),
  meetings: many(meetingsTable),
  boards: one(boardTable, {
    fields: [organizationTable.id],
    references: [boardTable.companyId],
  }),
  users: many(userTable),
}));

// Companies relations - moved to companies.tsx for many-to-many setup

// People relations - moved to people.tsx for many-to-many setup

// Emails relations
export const emailsRelations = relations(emailsTable, ({ one, many }) => ({
  organization: one(organizationTable, {
    fields: [emailsTable.organizationId],
    references: [organizationTable.id],
  }),
  peopleEmails: many(peopleEmailsTable),
}));

// People-Emails junction relations
export const peopleEmailsRelations = relations(peopleEmailsTable, ({ one }) => ({
  person: one(peopleTable, {
    fields: [peopleEmailsTable.personId],
    references: [peopleTable.id],
  }),
  email: one(emailsTable, {
    fields: [peopleEmailsTable.emailId],
    references: [emailsTable.id],
  }),
}));
