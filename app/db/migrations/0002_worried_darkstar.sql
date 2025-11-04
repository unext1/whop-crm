ALTER TABLE `organizations` ADD `membership_id` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `membership_status` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `renewal_period_start` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `renewal_period_end` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `cancel_at_period_end` text DEFAULT 'false';--> statement-breakpoint
ALTER TABLE `organizations` ADD `membership_updated_at` text;