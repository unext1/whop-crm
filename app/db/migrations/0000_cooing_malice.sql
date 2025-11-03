CREATE TABLE `activities` (
	`id` text PRIMARY KEY DEFAULT (uuid4()) NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
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
	`organization_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
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
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
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
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`owner_id` text,
	`plan` text DEFAULT 'free',
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
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `people_emails` (
	`person_id` text NOT NULL,
	`email_id` text NOT NULL,
	PRIMARY KEY(`person_id`, `email_id`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
