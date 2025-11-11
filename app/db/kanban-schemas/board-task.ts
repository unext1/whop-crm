import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { boardTable } from './board';
import { boardColumnTable } from './board-column';
import { taskAssigneesTable } from './task-assignees';
import { userTable } from '../schema/user';
import { taskCommentTable } from './task-comments';
import { peopleTable } from '../schema/people';
import { companiesTable } from '../schema';

export const boardTaskTable = sqliteTable('board_task', {
  id: text('id').primaryKey().default(sql`(uuid4())`),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  name: text('name').notNull(),
  content: text('content'),
  order: integer('order'),
  type: text('type', { enum: ['tasks', 'pipeline'] })
    .default('pipeline')
    .notNull(),
  amount: integer('amount'),

  ownerId: text('owner_id').references(() => userTable.id, { onDelete: 'set null' }),
  boardId: text('board_id').references(() => boardTable.id, { onDelete: 'cascade' }),
  columnId: text('column_id').references(() => boardColumnTable.id, { onDelete: 'set null' }),

  personId: text('person_id').references(() => peopleTable.id, { onDelete: 'set null' }),
  companyId: text('company_id').references(() => companiesTable.id, { onDelete: 'set null' }),
  parentTaskId: text('parent_task_id'),
  status: text('status').default('open').notNull(),
  dueDate: text('due_date'),
  priority: text('priority'), // 'low', 'medium', 'high'
});

export const boardTaskRelations = relations(boardTaskTable, ({ one, many }) => ({
  owner: one(userTable, {
    fields: [boardTaskTable.ownerId],
    references: [userTable.id],
  }),
  column: one(boardColumnTable, {
    fields: [boardTaskTable.columnId],
    references: [boardColumnTable.id],
  }),
  board: one(boardTable, {
    fields: [boardTaskTable.boardId],
    references: [boardTable.id],
  }),
  comments: many(taskCommentTable),
  assignees: many(taskAssigneesTable),
  parentTask: one(boardTaskTable, {
    fields: [boardTaskTable.parentTaskId],
    references: [boardTaskTable.id],
    relationName: 'parent',
  }),
  subTasks: many(boardTaskTable, {
    relationName: 'parent',
  }),
}));

export type BoardTaskType = typeof boardTaskTable.$inferSelect;

export type BoardTaskWithRelations = BoardTaskType & {
  owner: typeof userTable.$inferSelect | null;
  assignees: (typeof taskAssigneesTable.$inferSelect & {
    user: typeof userTable.$inferSelect;
  })[];
};
