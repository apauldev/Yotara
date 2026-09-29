CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`read` integer DEFAULT false NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `due_time` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `parent_id` text REFERENCES tasks(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurrence_rule` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `base_task_id` text REFERENCES tasks(id);--> statement-breakpoint
ALTER TABLE `user` ADD `passwordSetupRequired` integer DEFAULT false NOT NULL;