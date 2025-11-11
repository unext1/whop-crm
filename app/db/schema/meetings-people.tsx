import { relations } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { meetingsTable } from './meetings';
import { peopleTable } from './people';

export const meetingsPeopleTable = sqliteTable('meetings_people', {
  meetingId: text('meeting_id')
    .references(() => meetingsTable.id, { onDelete: 'cascade' })
    .notNull(),
  personId: text('person_id')
    .references(() => peopleTable.id, { onDelete: 'cascade' })
    .notNull(),
});

export const meetingsPeopleRelations = relations(meetingsPeopleTable, ({ one }) => ({
  meeting: one(meetingsTable, {
    fields: [meetingsPeopleTable.meetingId],
    references: [meetingsTable.id],
  }),
  person: one(peopleTable, {
    fields: [meetingsPeopleTable.personId],
    references: [peopleTable.id],
  }),
}));


