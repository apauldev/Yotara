ALTER TABLE `user` ADD `archiveAutoDelete` integer DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `archived_at` text;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `permanent_archive` integer DEFAULT false NOT NULL;
