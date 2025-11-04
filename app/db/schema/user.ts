import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { boardMemberTable, boardTable } from '../kanban-schemas';
import { taskCommentTable } from '../kanban-schemas/task-comments';
import { taskAssigneesTable } from '../kanban-schemas/task-assignees';
import { organizationTable } from './organization';

export const userTable = sqliteTable('user', {
  id: text('id').primaryKey().default(sql`(uuid4())`).notNull(),
  whopUserId: text('whop_user_id').notNull(), // user_xxxx,
  email: text('email').notNull(),
  name: text('name'),
  lastName: text('last_name'),
  username: text('username'),
  profilePictureUrl: text('profile_picture_url'),
  organizationId: text('organization_id').references(() => organizationTable.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const userRelations = relations(userTable, ({ many }) => ({
  memberOfBoard: many(boardMemberTable),
  ownerOfBoard: many(boardTable),
  taskComments: many(taskCommentTable),
  taskAssignees: many(taskAssigneesTable),
}));

export type UserType = typeof userTable.$inferSelect;
