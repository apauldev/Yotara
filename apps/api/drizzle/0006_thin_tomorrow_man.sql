-- Scoped to the one object the runtime bootstrap does not already create.
-- Every other statement here (the notifications table, parent_id,
-- recurrence_rule, base_task_id, passwordSetupRequired) exists in any database
-- this project has initialized, so replaying it would abort on the first
-- duplicate. db/client.ts applies due_time through a guarded ALTER on startup;
-- this file exists so the generated chain records the same change.
ALTER TABLE `tasks` ADD `due_time` text;
