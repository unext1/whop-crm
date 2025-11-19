import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { organizationTable } from './organization';
import { boardColumnTable } from '../kanban-schemas/board-column';

export const formsTable = sqliteTable('forms', {
  id: text('id').primaryKey().default(sql`(uuid4())`).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  slug: text('slug').notNull().unique(), // Optional, kept for backward compatibility but not used

  // Form configuration
  entityType: text('entity_type', { enum: ['person', 'company', 'both'] })
    .notNull()
    .default('person'),
  defaultEntityType: text('default_entity_type', { enum: ['person', 'company'] }), // If entityType is 'both', this is the default
  allowEntitySelection: integer('allow_entity_selection', { mode: 'boolean' }).default(false),

  // Pipeline configuration
  pipelineColumnId: text('pipeline_column_id').references(() => boardColumnTable.id, { onDelete: 'set null' }),
  createDeal: integer('create_deal', { mode: 'boolean' }).default(false),

  // Form fields configuration (JSON)
  fields: text('fields').notNull(), // JSON array of field configurations

  // Success message
  successMessage: text('success_message').default("Thank you for your submission! We'll be in touch soon."),

  // Notification settings
  sendNotification: integer('send_notification', { mode: 'boolean' }).default(true),
  notificationEmails: text('notification_emails'), // JSON array of email addresses

  // UTM tracking
  trackUtm: integer('track_utm', { mode: 'boolean' }).default(true),

  // Organization
  organizationId: text('organization_id')
    .references(() => organizationTable.id, { onDelete: 'cascade' })
    .notNull(),

  // Metadata
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const formsRelations = relations(formsTable, ({ one }) => ({
  organization: one(organizationTable, {
    fields: [formsTable.organizationId],
    references: [organizationTable.id],
  }),
  pipelineColumn: one(boardColumnTable, {
    fields: [formsTable.pipelineColumnId],
    references: [boardColumnTable.id],
  }),
}));

export type FormType = typeof formsTable.$inferSelect;
export type FormFieldConfig = {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select fields
  entityField?: string; // Maps to person/company field (e.g., 'name', 'email', 'phone', 'jobTitle', etc.)
};
