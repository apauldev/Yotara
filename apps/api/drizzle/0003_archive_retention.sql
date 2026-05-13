CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_labels` (
	`task_id` text NOT NULL,
	`label_id` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `permanent_archive` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `archiveAutoDelete` integer DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE `tasks` SET `archived_at` = `updated_at` WHERE `completed` = 1 AND `archived_at` IS NULL;