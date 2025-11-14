CREATE TABLE `summary` (
	`id` text PRIMARY KEY NOT NULL,
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
	FOREIGN KEY (`people_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
