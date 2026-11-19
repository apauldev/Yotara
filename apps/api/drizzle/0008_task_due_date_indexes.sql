CREATE INDEX IF NOT EXISTS `idx_tasks_owner_deleted_due_date` ON `tasks`(`user_id`, `deleted_at`, date(`due_date`));
CREATE INDEX IF NOT EXISTS `idx_tasks_owner_deleted` ON `tasks`(`user_id`, `deleted_at`);
