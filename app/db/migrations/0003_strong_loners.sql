ALTER TABLE `organizations` ADD `subscription_start` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `subscription_end` text;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `membership_id`;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `membership_status`;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `renewal_period_start`;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `renewal_period_end`;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `cancel_at_period_end`;--> statement-breakpoint
ALTER TABLE `organizations` DROP COLUMN `membership_updated_at`;