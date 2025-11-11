import { relations, sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { userTable } from './user';

export const activitiesTable = sqliteTable('activities', {
  id: text('id').primaryKey().default(sql`(uuid4())`).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  activityDate: text('activity_date'), // When the activity actually occurred (for logging past activities)
  entityType: text('entity_type').notNull(), // 'task', 'person', 'company'
  entityId: text('entity_id').notNull(),
  userId: text('user_id').references(() => userTable.id, { onDelete: 'set null' }),

  // Activity type: 'created', 'updated', 'name_changed', 'content_changed',
  // 'status_changed', 'assignee_added', 'assignee_removed', 'column_moved',
  // 'due_date_changed', 'priority_changed', 'company_linked', 'person_linked', etc.
  activityType: text('activity_type').notNull(),
  description: text('description'),

  // JSON field for storing change details (old value, new value, etc.)
  // Example: { field: 'name', oldValue: 'Old Title', newValue: 'New Title' }
  // or { field: 'status', oldValue: 'Todo', newValue: 'In Progress' }
  metadata: text('metadata'), // JSON string

  // Optional: For references (e.g., which user was added/removed, which company was linked)
  relatedEntityId: text('related_entity_id'),
  relatedEntityType: text('related_entity_type'), // 'user', 'company', 'person', etc.
});

export const activitiesRelations = relations(activitiesTable, ({ one }) => ({
  user: one(userTable, {
    fields: [activitiesTable.userId],
    references: [userTable.id],
  }),
}));

export type ActivityType = typeof activitiesTable.$inferSelect;
