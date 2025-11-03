CREATE TABLE `board` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'pipeline' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`owner_id` text,
	`company_id` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `board_column` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`name` text NOT NULL,
	`order` integer NOT NULL,
	`board_id` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `board_member` (
	`user_id` text NOT NULL,
	`board_id` text NOT NULL,
	PRIMARY KEY(`board_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `board_task` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name` text NOT NULL,
	`content` text,
	`order` integer,
	`type` text DEFAULT 'pipeline' NOT NULL,
	`amount` integer,
	`owner_id` text,
	`board_id` text,
	`column_id` text,
	`person_id` text,
	`company_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`due_date` text,
	`priority` text,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`board_id`) REFERENCES `board`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`column_id`) REFERENCES `board_column`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `task_assignees` (
	`user_id` text NOT NULL,
	`task_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `board_task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_comment` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`user_id` text,
	`task_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `board_task`(`id`) ON UPDATE no action ON DELETE cascade
);
