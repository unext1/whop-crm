CREATE TABLE `activities` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`activity_date` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`user_id` text,
	`activity_type` text NOT NULL,
	`description` text,
	`metadata` text,
	`related_entity_id` text,
	`related_entity_type` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `companies_people` (
	`company_id` text NOT NULL,
	`person_id` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`domain` text,
	`website` text,
	`industry` text,
	`address` text,
	`phone` text,
	`linkedin` text,
	`twitter` text,
	`notes` text,
	`organization_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`email` text NOT NULL,
	`type` text DEFAULT 'work',
	`is_primary` integer DEFAULT false,
	`organization_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_date` text NOT NULL,
	`duration` integer DEFAULT 60 NOT NULL,
	`location` text,
	`notes` text,
	`recurrence_type` text DEFAULT 'none' NOT NULL,
	`recurrence_end_date` text,
	`organization_id` text NOT NULL,
	`owner_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `meetings_companies` (
	`meeting_id` text NOT NULL,
	`company_id` text NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meetings_people` (
	`meeting_id` text NOT NULL,
	`person_id` text NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`owner_id` text,
	`plan` text DEFAULT 'free',
	`membership_id` text,
	`subscription_start` text,
	`subscription_end` text,
	`cancel_at_period_end` integer DEFAULT false,
	`canceled_at` text,
	`last_membership_check` text,
	`had_premium_before` integer DEFAULT false,
	`getting_started_completed` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`job_title` text,
	`phone` text,
	`linkedin` text,
	`twitter` text,
	`website` text,
	`address` text,
	`notes` text,
	`whop_user_id` text,
	`organization_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `people_emails` (
	`person_id` text NOT NULL,
	`email_id` text NOT NULL,
	PRIMARY KEY(`person_id`, `email_id`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `summary` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`description` text NOT NULL,
	`insights` text NOT NULL,
	`rating_score` integer NOT NULL,
	`rating_tier` text NOT NULL,
	`rating_reasoning` text NOT NULL,
	`recommendation` text NOT NULL,
	`people_id` text,
	`company_id` text,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`people_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`whop_user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`last_name` text,
	`username` text,
	`profile_picture_url` text,
	`organization_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
	`parent_task_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`due_date` text,
	`priority` text,
	`notes` text,
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
