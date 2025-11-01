ALTER TABLE `board` ADD `type` text DEFAULT 'pipeline' NOT NULL;--> statement-breakpoint
ALTER TABLE `board_task` ADD `type` text DEFAULT 'pipeline' NOT NULL;