import { relations } from 'drizzle-orm';
import { companiesTable } from './companies';
import { emailsTable } from './emails';
import { organizationTable } from './organization';
import { peopleTable } from './people';
import { peopleEmailsTable } from './people-emails';

// Organization relations
export const organizationRelations = relations(organizationTable, ({ many }) => ({
  companies: many(companiesTable),
  emails: many(emailsTable),
  people: many(peopleTable),
}));

// Companies relations
export const companiesRelations = relations(companiesTable, ({ one, many }) => ({
  organization: one(organizationTable, {
    fields: [companiesTable.organizationId],
    references: [organizationTable.id],
  }),
  people: many(peopleTable),
}));

// People relations
export const peopleRelations = relations(peopleTable, ({ one, many }) => ({
  company: one(companiesTable, {
    fields: [peopleTable.companyId],
    references: [companiesTable.id],
  }),
  organization: one(organizationTable, {
    fields: [peopleTable.organizationId],
    references: [organizationTable.id],
  }),
  peopleEmails: many(peopleEmailsTable),
}));

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
