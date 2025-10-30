import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { relations } from 'drizzle-orm';
import { boardTaskTable } from './board-task';
import { userTable } from '../schema/user';

export const taskAssigneesTable = sqliteTable(
  'task_assignees',
  {
    userId: text('user_id')
      .references(() => userTable.id, { onDelete: 'cascade' })
      .notNull(),
    taskId: text('task_id')
      .references(() => boardTaskTable.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    taskAssigneesPkey: primaryKey({
      columns: [table.taskId, table.userId],
      name: 'task_assignees_pkey',
    }),
  }),
);

export const taskAssigneesRelations = relations(taskAssigneesTable, ({ one }) => ({
  user: one(userTable, {
    fields: [taskAssigneesTable.userId],
    references: [userTable.id],
  }),
  assignee: one(boardTaskTable, {
    fields: [taskAssigneesTable.taskId],
    references: [boardTaskTable.id],
  }),
}));
