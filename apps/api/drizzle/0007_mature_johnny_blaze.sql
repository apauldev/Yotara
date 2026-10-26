-- Scoped to the name_norm addition from the Unicode label-uniqueness fix.
-- Other drift a full generate emits is omitted, matching 0006: labels.icon,
-- labels.pinned, and projects.retired_at are applied through guarded ALTERs on
-- startup from earlier phases, and the tasks.bucket drop is a schema.ts cleanup
-- the runtime deliberately leaves alone in existing files. The unique index is
-- created by the startup migration after dedupe, not here — replaying an
-- index-only 0007 on a database that still contains duplicates would fail.
-- db/client.ts applies name_norm through a guarded ALTER on startup; this file
-- exists so the generated chain records the same change.
ALTER TABLE `labels` ADD `name_norm` text NOT NULL;
