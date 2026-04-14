CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `simple_mode` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `bucket` text DEFAULT 'personal-sanctuary';--> statement-breakpoint
ALTER TABLE `tasks` ADD `project_id` text REFERENCES projects(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `user` ADD `workspaceMode` text;--> statement-breakpoint
ALTER TABLE `user` ADD `onboardingCompleted` integer DEFAULT false NOT NULL;