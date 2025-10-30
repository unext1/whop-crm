import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { boardTaskTable } from './board-task';
import { userTable } from '../schema';

export const taskCommentTable = sqliteTable('task_comment', {
  id: text('id').primaryKey().default(sql`(uuid4())`),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  userId: text('user_id').references(() => userTable.id, { onDelete: 'set null' }),
  taskId: text('task_id')
    .references(() => boardTaskTable.id, { onDelete: 'cascade' })
    .notNull(),
});

export const taskCommentRelations = relations(taskCommentTable, ({ one }) => ({
  user: one(userTable, {
    fields: [taskCommentTable.userId],
    references: [userTable.id],
  }),
  task: one(boardTaskTable, {
    fields: [taskCommentTable.taskId],
    references: [boardTaskTable.id],
  }),
}));
