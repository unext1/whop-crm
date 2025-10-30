import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { boardTable } from './board';
import { boardTaskTable } from './board-task';

export const boardColumnTable = sqliteTable('board_column', {
  id: text('id').primaryKey().default(sql`(uuid4())`),
  name: text('name').notNull(),
  order: integer('order').notNull(),
  boardId: text('board_id')
    .references(() => boardTable.id, { onDelete: 'cascade' })
    .notNull(),
});

export const boardColumnRelations = relations(boardColumnTable, ({ one, many }) => ({
  board: one(boardTable, {
    fields: [boardColumnTable.boardId],
    references: [boardTable.id],
  }),
  tasks: many(boardTaskTable),
}));
