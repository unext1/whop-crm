import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { userTable } from '../schema';
import { boardColumnTable } from './board-column';
import { boardMemberTable } from './board-member';
import { boardTaskTable } from './board-task';
import { organizationTable } from '../schema';

export const boardTable = sqliteTable('board', {
  id: text('id').primaryKey().default(sql`(uuid4())`),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  ownerId: text('owner_id').references(() => userTable.id, { onDelete: 'set null' }),
  companyId: text('company_id')
    .references(() => organizationTable.id, { onDelete: 'cascade' })
    .notNull(),
});

export const boardRelations = relations(boardTable, ({ one, many }) => ({
  owner: one(userTable, {
    fields: [boardTable.ownerId],
    references: [userTable.id],
  }),
  company: one(organizationTable, {
    fields: [boardTable.companyId],
    references: [organizationTable.id],
  }),
  columns: many(boardColumnTable),
  tasks: many(boardTaskTable),
  members: many(boardMemberTable),
}));
