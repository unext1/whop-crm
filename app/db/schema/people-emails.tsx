import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { peopleTable } from './people';
import { emailsTable } from './emails';

export const peopleEmailsTable = sqliteTable(
  'people_emails',
  {
    personId: text('person_id')
      .references(() => peopleTable.id, { onDelete: 'cascade' })
      .notNull(),
    emailId: text('email_id')
      .references(() => emailsTable.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.personId, table.emailId] })],
);
