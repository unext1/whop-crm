import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationTable } from './organization';
import { userTable } from './user';
import { meetingsPeopleTable } from './meetings-people';
import { meetingsCompaniesTable } from './meetings-companies';

export const meetingsTable = sqliteTable('meetings', {
  id: text('id').primaryKey().default(sql`(uuid4())`).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startDate: text('start_date').notNull(), // ISO timestamp
  duration: integer('duration').notNull().default(60), // Duration in minutes
  location: text('location'),
  notes: text('notes'),
  recurrenceType: text('recurrence_type').default('none').notNull(), // 'none' | 'daily' | 'weekly' | 'monthly'
  recurrenceEndDate: text('recurrence_end_date'), // ISO timestamp, nullable
  organizationId: text('organization_id')
    .references(() => organizationTable.id)
    .notNull(),
  ownerId: text('owner_id').references(() => userTable.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const meetingsRelations = relations(meetingsTable, ({ one, many }) => ({
  organization: one(organizationTable, {
    fields: [meetingsTable.organizationId],
    references: [organizationTable.id],
  }),
  owner: one(userTable, {
    fields: [meetingsTable.ownerId],
    references: [userTable.id],
  }),
  meetingsPeople: many(meetingsPeopleTable),
  meetingsCompanies: many(meetingsCompaniesTable),
}));

export type MeetingType = typeof meetingsTable.$inferSelect;
