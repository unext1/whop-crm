import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { userTable } from '../schema';
import { boardTable } from './board';
import { relations } from 'drizzle-orm';

export const boardMemberTable = sqliteTable(
  'board_member',
  {
    userId: text('user_id')
      .references(() => userTable.id, { onDelete: 'cascade' })
      .notNull(),
    boardId: text('board_id')
      .references(() => boardTable.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (table) => ({
    boardMemberPkey: primaryKey({
      columns: [table.boardId, table.userId],
      name: 'board_member_pkey',
    }),
  }),
);

export const boardMemberRelations = relations(boardMemberTable, ({ one }) => ({
  board: one(boardTable, {
    fields: [boardMemberTable.boardId],
    references: [boardTable.id],
  }),
  member: one(userTable, {
    fields: [boardMemberTable.userId],
    references: [userTable.id],
  }),
}));
