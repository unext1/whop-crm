CREATE TABLE `forms` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`slug` text NOT NULL,
	`entity_type` text DEFAULT 'person' NOT NULL,
	`default_entity_type` text,
	`allow_entity_selection` integer DEFAULT false,
	`pipeline_column_id` text,
	`create_deal` integer DEFAULT false,
	`fields` text NOT NULL,
	`success_message` text DEFAULT 'Thank you for your submission! We''ll be in touch soon.',
	`send_notification` integer DEFAULT true,
	`notification_emails` text,
	`track_utm` integer DEFAULT true,
	`organization_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`pipeline_column_id`) REFERENCES `board_column`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `forms_slug_unique` ON `forms` (`slug`);