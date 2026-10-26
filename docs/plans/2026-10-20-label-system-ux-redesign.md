# Plan: Label System UX Redesign — Icon-First Focus Labels

> **Owner:** @apauldev
> **Date:** 2026-10-20
>
> Redesign Yotara's label system around a small curated icon set, one management
> surface, and labels that work as filters in task lists. The work is split into
> three phases: fix the truth and visual hierarchy first, add the icon identity
> and redesigned Labels page second, then make labels a first-class filtering and
> capture system.

---

## 1. Context & Motivation

### 1.1 Why the current system falls short

Labels exist, but they do not yet carry their weight as a navigation and
scanning tool.

| Problem | Current behavior |
|:---|:---|
| **Color is discarded** | `personal-task-card.component.ts` renders `.meta-pill-label` with `--accent-soft` / `--accent-strong`, so every label looks the same in task lists. The color chosen in the label editor only appears on the Labels page and in the task modal. |
| **Badge fatigue** | A task card can show labels, due date, status, priority, simple mode, subtask progress, recurrence, and completion state at once. Labels compete with transient metadata instead of helping users scan. |
| **Two management surfaces** | The Labels page is a master-detail layout. Editing opens a modal that contains a *second* label rail, editor, and create flow. There are two selection models and two places to manage the same data. |
| **Duplicate labels** | There is no case-insensitive uniqueness constraint, so “Writing” and “writing” can both exist. Cleanup requires manual deletion. |
| **Counts are ambiguous** | `label.taskCount` counts every `task_labels` row, including completed, archived, and soft-deleted tasks, while the Labels page displays “active tasks.” The two numbers can disagree. |
| **Filtering is client-side** | `labels-page.component.ts` filters `allActiveTasks()` in the browser, contrary to the project's server-side filtering architecture. The tasks API has no label filter. |
| **Labels are a destination** | There is no label filter in the task list. The Labels page is the only way to view tasks by label, so labels do not function as a lens across task views. |
| **Capture loses tags** | `#newtag` is always stripped from the title by `parseTaskCommand`, but only resolved against existing labels. An unknown tag disappears silently and the task saves without it. |
| **Search is a dead end** | The label tab in search renders the raw hex color as text and the result card is not clickable. |
| **Seeding resurrects deleted labels** | `GET /labels` calls `seedDefaultLabelsForOwner`, so deleting every label and reloading the page recreates the defaults. |
| **Identity is unclear** | Projects and labels both present as colored/text pills. Users have no rule for whether “Finance” should be a project or a label. |

**Code check (2026-10-20).** These constraints were verified against the current
implementation and are the assumptions this plan depends on:

- `ensureSqliteSchema` in `apps/api/src/db/client.ts` is the runtime schema
  bootstrap. Drizzle files under `apps/api/drizzle/` are not applied
  automatically at startup. The label migration must live in
  `ensureSqliteSchema`; any Drizzle SQL is a schema snapshot, not a runnable
  upgrade path. In particular, a unique-index-only `0007` would fail on an
  existing database with duplicates, and a `0008` `ALTER TABLE` would fail if
  the bootstrap had already added the columns.
- The unique label index must be created **after** duplicate cleanup. Adding it
  to `SQLITE_BOOTSTRAP_SQL` would fail on an existing database that still has
  duplicates, because the bootstrap SQL runs before the cleanup block.
- `task_labels` has no `label_id` index. Counts and label filters need one.
- The Labels page currently reads `allActiveTasks()` and filters in the browser.
  The API and `TaskService` need a label-filtered query before the page can show
  completed tasks or make its counts trustworthy.
- The capture bar already has `#` suggestions and keyboard navigation. Phase 3
  extends that combobox with a “Create ‘X’” option; it does not build suggestions
  from scratch.
- Task-card labels already sit in the title row before the right-aligned metadata
  group; they are not in a separate right-hand rail. The work is to replace the
  accent pill with the shared chip, cap the overflow, and stop repeating the
  active label.
- The shared `ModalComponent` supports a full-height layout but not a right-side
  drawer. Phase 2 must extend it (or add a drawer) rather than assuming the
  current modal can slide in.
- `GET /labels` currently seeds defaults, and `LabelService` sorts only by name.
  Seeding behavior and pinned ordering are explicit tasks below.

### 1.2 Product model (decision)

Yotara has two categorization layers. This plan does **not** redesign projects,
but it locks the rule that labels must follow:

| Layer | Rule | Examples |
|:---|:---|:---|
| **Project** | Has a finish line and contains tasks. | “Taxes 2026”, “Website relaunch” |
| **Label** | A cross-cutting condition or context that applies across projects. | “Waiting”, “Phone”, “Errand”, “Review”, “15 min” |

Two consequences:

1. Labels are curated focus areas. Aim for **3–8 active labels** per user, not
   an unbounded tag cloud. The UI should guide toward that range without
   enforcing a hard cap.
2. Labels can apply to subtasks. Counts and label-filtered views use one flat
   scope: all non-deleted tasks, including subtasks. The unfiltered task list
   keeps its nested layout. This keeps the directory count, pane count, and
   filtered result list in agreement.

This rule is written into `docs/ARCHITECTURE.md` in Phase 1 so future features
have a reference.

### 1.3 Design principles

1. **Icon-first, not icon-only.** The icon is a mnemonic; the name is the source
   of truth; color is an accent. Shape + color + text provide redundant channels.
2. **Names stay discoverable.** In task lists, show icon + name for the first
   one or two labels. Icon-only is reserved for overflow and compact layouts,
   and must always have an accessible name and a tap target that reveals it.
3. **One management surface.** The Labels page owns label management. The task
   modal owns applying and quick-creating labels. Neither embeds the other's
   full manager.
4. **Labels are filters in task lists.** A label chip is actionable. Clicking it
   filters the task list; label filters persist in query params and run
   server-side. Calendar filtering is not required by this plan.
5. **Few and meaningful.** A small curated icon set and sensible defaults
   encourage a useful label system rather than a sprawl of near-duplicates.
6. **Accessible by default.** Keyboard navigation, screen-reader names, focus
   management, contrast in light and dark themes, and touch-sized targets are
   acceptance criteria, not polish.

### 1.4 Success signals

- Percentage of open tasks with at least one label.
- Median labels per user stays in the 3–8 range; the long tail above 15 is
  investigated.
- Labels created from the task modal or capture bar, not just the Labels page.
- Weekly sessions that use a label filter.
- Duplicate-name attempts and merge usage.
- Task cards show at most two label chips plus an overflow indicator.
- Five-person usability test: “Find every Writing task”, “Create an Errands
  label while adding a task”, “Delete a label without deleting its tasks”,
  “What does this icon mean?”

---

## 2. Scope

**In scope**

- Label schema, API validation, icon keys, uniqueness, counts, merge.
- Shared label chip/icon components.
- Task card, task modal picker, capture bar, search results.
- Labels page redesign and label editing surface.
- Server-side single-label filtering for the Labels page, then multi-label
  filtering and the task-list filter UI in Phase 3.
- Mobile, keyboard, screen-reader, and contrast work for the above.

**Out of scope**

- Redesigning projects. This plan clarifies the taxonomy and hides
  status/simple-mode pills on the Labels page via `showContextMetadata`; it
  does not change their global treatment.
- Label filtering or label icons in the calendar view.
- Team/shared labels.
- Custom uploaded icons, arbitrary emoji, or per-label cover images.
- Label descriptions, nesting, and label groups.
- Bulk import/export changes beyond adding the new label fields.
- A full analytics/event-tracking system.

---

## 3. Phase Overview

| Phase | Theme | Outcome | Exit gate | Size |
|:---|:---|:---|:---|:---|
| **1** | Foundations, truth, and hygiene | Labels render truthfully, stop creating visual noise, and cannot be duplicated. Counts and the Labels pane come from the task API, not a client-side filter. | All P1 acceptance criteria pass; existing tests and new regression tests are green. | M–L |
| **2** | Icon-first identity and one Labels surface | Labels have a curated icon + color + name identity. The Labels page is a focus-area browser with inline creation/editing, pinned labels, and Open/Completed/All panes. Task cards and the task modal use the shared chip. | Icon migration is backward-compatible; create/edit/delete works from one surface; visual QA passes. | L |
| **3** | Labels as a first-class system | Labels support multi-label filtering in task lists, can be created from capture, and scale through sorting, merging, and mobile drill-in. | E2E filter/create/merge flows pass; accessibility checklist passes. | L |

Phases are sequential. Phase 2 depends on the shared chip, uniqueness, and
single-label task query from Phase 1. Phase 3 depends on the icon keys, page
structure, and pinning from Phase 2.

---

## 4. Phase 1 — Foundations, Truth, and Hygiene

**Goal:** Make the existing system correct before adding icons. Labels must show
their own color, stop crowding task cards, stop duplicating, and stop lying
about counts.

### 1.1 Lock the taxonomy and copy

**Files:** `docs/ARCHITECTURE.md`, `apps/api/src/services/label-service.ts`,
`apps/api/src/routes/labels.ts`, `apps/api/src/routes/me.ts`, Labels page and
modal templates, task modal, search copy.

- Add a “Categorization model” subsection to `docs/ARCHITECTURE.md` with the
  project/label rule from §1.2. Add labels to the server-side filtering list in
  the frontend architecture section.
- Use **Labels** as the object name in navigation and headings. Use “focus
  areas” at most as explanatory copy; never use “tags” and “focus areas”
  interchangeably in the same surface.
- Move default seeding to onboarding/profile setup and remove the
  `seedDefaultLabelsForOwner` call from `GET /labels`. Deleting every label must
  not resurrect the defaults on the next page load. New users get six context
  labels (Urgent, Waiting, Planning, Errand, Review, Idea), not life-area
  duplicates. Existing users keep their labels. Make seeding idempotent under
  the new unique index (`onConflictDoNothing` or a caught constraint), so a
  double onboarding request cannot 500.

**Acceptance:** a new contributor can explain the difference between a project
and a label using only the architecture doc and UI copy; deleting all labels and
reloading leaves the label list empty.

### 1.2 Build the shared `LabelChipComponent`

**Files to create:**

- `apps/frontend/src/app/shared/ui/label-chip/label-chip.component.ts`
- `apps/frontend/src/app/shared/ui/label-chip/label-chip.component.spec.ts`

**Files to update:**

- `personal-task-card.component.ts`
- `labels-page.component.html`
- `personal-task-modal.component.html`
- `search-page.component.html`
- `apps/frontend/src/app/core/services/label.service.ts` (add a `labelById`
  computed map and sort pinned labels first once Phase 2 adds the field)
- `apps/frontend/src/app/shared/utils/color-contrast.ts` (+ spec) for the
  black/white on-color decision

**API:**

- Inputs: `label: Label`, `mode: 'full' | 'compact'`, `selected`, `removable`,
  `interactive`, optional `size`.
- Outputs: `select`, `remove`.
- `interactive` defaults to false, so chips rendered inside links or the task
  card are not nested buttons; only the task-list filter chip opts in.
- `mode="compact"` is the icon-only variant; there is no separate
  `suppressName` flag to keep the API unambiguous.

**Visual spec:**

- Set `--label-color` from `label.color` on the host. Derive three tokens:
  `--label-soft` (12% label color mixed with surface), `--label-strong` (the
  label color), and `--label-on-strong` (auto-selected black or white based on
  the label color's relative luminance).
- **Default full chip:** soft/tinted pill body; a 20–22px **solid label-color
  icon tile** with the glyph inverted in `--label-on-strong`; name in
  `--on-surface` at 0.72–0.78rem, sentence case, not uppercase; 24–28px height.
  This concentrates color in the icon, keeps text contrast predictable, and
  avoids a wall of saturated pills. Near-neutral label colors (the palette has a
  very light gray-green) need a subtle border on the soft body so the chip does
  not disappear.
- **Compact chip:** the same solid icon tile without the name. The accessible
  name is `Label: {name}`; add `title` as a hover enhancement, never the only
  name.
- **Selected / active state:** full solid label-color pill with
  `--label-on-strong` text and glyph. Render the glyph directly on the solid pill
  (no same-color tile), used for the active filter or selected picker option.
  Solid fills should communicate state, not every label.
- **Color-first option (power users):** a “Color-first labels” preference can
  turn the default full chip into a solid label-color pill. Default off; only
  enable it after the palette passes contrast checks. Do not rely on hue alone.
- Interactive chips are buttons; removable chips include a separate remove
  button with `aria-label="Remove {name}"`. A removable chip is a wrapper with
  the chip control and the remove button as siblings; never nest a button inside
  another button.
- If no icon is available (Phase 1), render the tag glyph in the icon tile; the
  data model arrives in Phase 2.
- Skip label IDs that are not in the live `labelById` map instead of rendering a
  raw ID. This keeps deleted labels from flashing on cards after a refresh.
- Validate contrast: 4.5:1 for text on the pill, 3:1 for the icon against its
  tile. Compute `--label-on-strong` instead of assuming white works on every
  user color. Validate/normalize label colors as 3- or 6-digit hex at the API
  boundary; fall back to the accent color for invalid legacy values.

**Acceptance:** every primary label surface in this phase (task card, task
modal, Labels page, search results) uses the shared component; two labels with
different colors render visibly differently; contrast is checked in light and
dark themes.

### 1.3 Fix task-card label treatment

**Files:** `personal-task-card.component.ts` and its spec.

- Labels already render in the title row before the right-aligned metadata
  group. Keep that proximity, but give them the new chip treatment. Do not move
  them into the metadata rail; on narrow cards the label group may sit on its
  own line under the title.
- Show at most **two** full chips, then a `+N` button. Cap chip width and
  truncate long names so the row does not wrap or push the metadata off-card.
  The popover lists all label names. The card already uses `role="button"` and
  contains buttons, so keep the `+N` control out of the card’s primary click
  target and stop its events from opening the task.
- Add an input such as `suppressLabelId` so a label-filtered pane does not
  repeat the active label on every card. If suppression leaves no labels, hide
  the label group entirely.
- Add a `showContextMetadata` input. The Labels page sets it to `false` so
  “Inbox” and simple-mode pills do not compete with the label context. The
  normal task list keeps current behavior in this phase; do not remove
  status/simple-mode pills globally as part of this label plan.
- Skip unknown label IDs (see 1.2) rather than showing a raw UUID.

**Acceptance:** a card with five labels does not wrap; the first two names are
visible; long names truncate; the overflow count is keyboard-accessible; the
active label is hidden in its own pane; unknown label IDs are omitted.

### 1.4 Enforce case-insensitive uniqueness and merge existing duplicates

**Files:**

- `apps/api/src/db/client.ts` (schema bootstrap/migration)
- `apps/api/src/db/schema.ts` (`nameNorm` column)
- `apps/api/src/lib/label-name.ts` and `label-name.test.ts` (normalized key)
- `apps/api/drizzle/0007_mature_johnny_blaze.sql` (schema record for `name_norm`,
  scoped to the guarded ALTER like 0006; the runtime migration owns the index)
- `apps/api/src/services/label-service.ts`
- `apps/api/src/routes/labels.ts`
- `apps/api/src/lib/app-error.ts` and/or `apps/api/src/server.ts` (409 response)
- `apps/api/src/docs/openapi.ts`
- `apps/api/src/services/label-service.test.ts`
- `apps/api/src/routes/labels.test.ts`
- `apps/api/src/db/label-migration.test.ts` (new)

**Migration algorithm (inside `ensureSqliteSchema`, within its existing
`BEGIN IMMEDIATE` transaction):**

1. Group labels by `(user_id, name_norm)` where the group has more than one row.
   `name_norm` is computed in application code (NFKC, lowercase, NFD, NFKC, then
   the case-folding overrides), so names that differ only by Unicode case,
   composition, or surrounding whitespace are treated as duplicates. The NFD
   step decomposes the Greek iota subscript so both combining and precomposed
   spellings reach the fold; the following NFKC recomposes sequences that only
   become composable once lowercased (for example `T` plus a combining diaeresis,
   or Greek `Ϊ` plus a combining tonos). The final case-folding overrides close
   the gap between JavaScript's toLowerCase() (case *conversion*) and Unicode
   case *folding*: `ß`/`ẞ` fold to `ss`, final sigma `ς` folds to `σ`, long s
   `ſ` folds to `s`, iota subscript folds to `ι`, and Cyrillic Extended-C
   variants fold to their base letters — so `Straße`/`STRASSE`, `ΟΣ`/`οσ`, and
   `ᾳ`/`αι` collide as expected. SQLite's `lower()` is ASCII-only and cannot
   provide this key.
2. Choose the canonical label: earliest non-empty `created_at`, then lowest
   `id`. The canonical label keeps its own color (and icon once Phase 2 adds it);
   duplicate metadata is discarded.
3. Re-point `task_labels` rows to the canonical label using
   `INSERT OR IGNORE`, then delete the duplicate join rows.
4. Delete the duplicate label rows.
5. **After** deduplication, create
   `CREATE UNIQUE INDEX idx_labels_user_name_unique ON labels(user_id, name_norm)`.
   Rebuild it only when it is missing, does not match the expected shape —
   verified via `PRAGMA index_list`/`index_info` as a full (non-partial) unique
   index with columns exactly `(user_id, name_norm)`, so an older
   expression-based index or a wrong-column/partial variant counts as stale — or
   the backfill changed at least one stored key: a normalization change can make
   previously distinct keys collide, so those updates must not run while the
   index still enforces the old keys. Steady-state startups leave the index
   untouched. Do not add this index to `SQLITE_BOOTSTRAP_SQL`: the bootstrap
   runs before dedupe and would fail on a database that still contains
   duplicates.
6. Create
   `CREATE INDEX IF NOT EXISTS idx_task_labels_label_id ON task_labels(label_id)`
   for counts and label filters. This is safe in the bootstrap for fresh
   databases and after table creation for old ones.
7. Log the number of merged labels and affected task-label rows. Tasks are never
   deleted.

The migration must be idempotent and safe with `busy_timeout`. `0007_mature_johnny_blaze.sql`
records the `name_norm` addition for the generated chain but is not a safe
manual upgrade; startup behavior is governed by `ensureSqliteSchema`.
`schema.ts` declares `nameNorm` so Drizzle writes keep the key in sync; the
unique index itself is created by the startup migration.

SQLite's `lower()` limitation is addressed by the stored `name_norm` key.
Canonically equivalent forms such as `Étude`, `étude`, and `E` plus a combining
accent all map to `étude`, and the unique index enforces that key. The
case-folding overrides extend the same guarantee to `Straße`/`STRASSE`, to
Greek final vs. medial sigma (`ΟΣ`/`οσ`), to iota-subscript forms (`ᾳ`/`αι`),
and to Cyrillic Extended-C variants, which a plain `toLowerCase()` would leave
as distinct keys.

**API behavior:**

- Trim names; reject empty names. Normalize valid hex colors on write; reject
  invalid color strings instead of letting broken CSS reach the browser. Do not
  fail reads for legacy rows with invalid colors; fall back to the accent color
  in the UI and do not reject an unchanged legacy value on update.
- On create or rename, detect an existing case-insensitive match and return
  `409 Conflict` with the existing label `{ id, name }`.
- Add a `ConflictError` with optional details (mapped by the central error
  handler) or return the 409 body explicitly from the route. Also catch the
  SQLite unique-constraint error so a race between the pre-check and insert
  still returns 409, not 500.
- Update OpenAPI schemas and tests, including the 409 response. The UI shows an
  inline “A label named X already exists” message with a path to the existing
  label. The full merge action lands in Phase 3.

**Acceptance:** creating “writing” when “Writing” exists returns 409 with the
existing label; creating “étude” when “Étude” exists also returns 409; the startup
migration merges existing duplicates without losing task associations; a second
startup is a no-op; invalid colors and empty names are rejected.

### 1.5 Make counts truthful and add the single-label task query

**Files:** `label-service.ts`, `apps/api/src/routes/tasks.ts`,
`apps/api/src/services/task-service.ts`, `apps/api/src/routes/search.ts`,
`packages/shared/src/index.ts`, `docs/openapi.ts`,
`apps/frontend/src/app/core/services/task.service.ts`, Labels page, search page,
settings export.

- Add `openTaskCount` (not completed, not deleted) and `totalTaskCount` (not
  deleted, includes completed/archived). Also add `completedTaskCount` for the
  pane header and delete confirmation.
- Keep `taskCount` as a temporary alias for total so existing consumers do not
  break; migrate the UI and export code to the new fields in this phase.
- Join `tasks` in label count queries and exclude `deleted_at IS NOT NULL`.
  Counts and filtered lists include subtasks; they use the flat scope from §1.2.
- Add a single-label filter to `GET /tasks`: accept comma-separated `labelIds`
  now (the Labels page passes one id), filter with an `EXISTS` subquery that
  also checks label ownership, and add `TaskFilters.labelIds`. Add a
  `TaskService` method for the Labels page so it stops using
  `allActiveTasks().filter(...)`; the Labels page query uses
  `includeSubtasks=true` so it matches the flat count scope in §1.2. Do not
  build the multi-select task-list UI until Phase 3.
- Update the raw label SQL and `LabelSearchRow`/`toLabel` in
  `apps/api/src/routes/search.ts` (there is no `search-service.ts`). Search
  label results show the open count and include the new fields.
- Update the settings label export for the new counts; add `icon`/`pinned`
  columns in Phase 2.1.
- Labels page: show open count in the directory; show the open/completed totals
  in the selected pane header. The visible Phase 1 list remains the open list;
  Phase 2 adds the Completed/All tabs. Search results show the open count.

**Acceptance:** the directory count, pane open count, and visible open task list
agree for every label; completed/deleted tasks are accounted for explicitly; the
Labels page makes no client-side label filter call; search and export expose the
same count fields.

### 1.6 Correct the Labels page and remove the duplicate manager

**Files:** `labels-page.component.ts/html/scss`, `label-modal.component.ts`,
`personal-task-workspace.component.ts`, `personal-task-modal.component.ts/html`.

- Select a default label after labels load, not in the constructor. In Phase 1,
  select the first alphabetical label; Phase 2 adds pinned-first ordering. If
  the `label` query param is invalid, show a “Label not found” state with a link
  back to all labels, but only after the list has loaded — never flash
  not-found while labels are still loading. Do not auto-scroll the pane into
  view.
- Replace the div-based table with a semantic list of links or buttons. Each
  row has `aria-current` when selected. Remove the decorative “→” affordance.
- Put Edit and Delete in a per-row overflow menu; add Pin in Phase 2. Keep the
  row link and the overflow button as siblings, not nested interactive
  elements. The row click only selects.
- Remove the label rail from the modal. The modal becomes a simple create/edit
  form; Phase 2 turns it into the drawer with live preview.
- Make Delete explicit: a labeled menu item or danger-zone button, never a “×”
  in the header. Confirmation copy names the label and its counts: “Delete
  Writing? It is on 3 open and 7 completed tasks. The tasks will stay; the label
  will be removed.” After delete, refresh the label list and the pane, clear the
  query param, and select the next label (or show the empty state).
- Add form validation: required name, max length, disabled submit when empty,
  inline error, loading state, and a visible error if the request fails.
- Add a pane-level “Add task” action. Extend
  `PersonalTaskWorkspaceComponent.openCreateTaskModal` and
  `PersonalTaskModalComponent` with `initialLabelIds` (applied only when
  creating, not when editing) so a task created from a label pane starts with
  that label selected. Do not rely on the user re-selecting it.
- Empty state for a selected label: “No open tasks in Writing” with an “Add task”
  button. Empty state for no labels: a clear “Create your first label” CTA
  (the starter gallery arrives in Phase 2).

**Acceptance:** `/labels` lands on a useful label; editing never changes the
pane behind the modal; delete is distinguishable from close; form errors are
visible; keyboard and screen-reader users can select and edit; a task created
from the pane is born with the active label.

### 1.7 Fix search and capture truthfulness

**Files:** `search-page.component.html/ts`, `task-list-page.component.ts`,
`personal-task-modal.component.ts`, `capture-bar.component.ts`,
`task-command-parser.ts` and its spec.

- Search label results: render the shared chip with icon/color and open count,
  link to `/labels?label={id}`, and remove the raw hex string.
- Capture: when a `#tag` does not match an existing label, preserve the token in
  the task title (or show an explicit “Label not found” message) instead of
  silently stripping it. Extend `parseTaskCommand` to accept the known label
  names (or return `unresolvedLabelNames`) and strip only resolved tags; update
  both the capture and task-modal callers.
- The capture bar already has `#` suggestions and keyboard navigation. Keep
  them; Phase 3 adds the “Create ‘X’” option and actual creation.
- Full create-on-enter arrives in Phase 3.

**Acceptance:** a search for a label leads to its task view; typing an unknown
tag never loses information silently; existing label suggestions still work.

### 1.8 Phase 1 verification

- New/updated unit tests for the chip, task card cap/suppression, label service
  uniqueness/counts, route 409, search result, capture parser, the single-label
  task query, and the seed-once behavior.
- Add a database migration test that seeds a legacy database with duplicate
  labels and verifies associations survive, the unique index exists, and a
  second startup is a no-op.
- Add a frontend test that `/labels` uses the API query rather than filtering
  `allActiveTasks()`.
- Run `pnpm --filter @yotara/api test`, `pnpm --filter @yotara/frontend test`,
  `pnpm typecheck`, `pnpm lint`, and `pnpm docs:check`.
- Manual: duplicate migration on a copy of a real database; light/dark
  contrast; keyboard-only selection; screen-reader names.

**Phase 1 exit criteria**

- Every label chip shows the label's own color.
- No task card shows more than two label chips plus overflow.
- The active label is not repeated in its own task pane.
- Duplicate names are impossible; existing duplicates are merged safely.
- Counts are defined and consistent; the Labels page reads them from the task
  API rather than a client-side filter.
- Deleting all labels stays deleted after reload.
- One management surface; delete is explicit and safe.
- Search and capture no longer lose or misrepresent data.

---

## 5. Phase 2 — Icon-First Identity and One Labels Surface

**Goal:** Give labels a recognizable visual identity and replace the duplicated
management UI with one focus-area browser.

### 2.1 Add the icon and pinned fields

**Files:** `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`,
`apps/api/drizzle/0008_*.sql` (optional; do not add an `ALTER` snapshot that
duplicates the bootstrap), `packages/shared/src/index.ts`, `label-service.ts`,
`apps/api/src/routes/labels.ts`, `apps/api/src/routes/search.ts`,
`docs/openapi.ts`, tests.

- Add `icon TEXT NOT NULL DEFAULT 'tag'` and
  `pinned INTEGER NOT NULL DEFAULT 0` (boolean mode) to the `labels` table in
  `SQLITE_BOOTSTRAP_SQL` (fresh DB) and to the existing-table branch in
  `ensureSqliteSchema` (old DB). Add the same fields to the Drizzle schema.
  Because the bootstrap owns these columns, do not add a generated `0008`
  `ALTER TABLE` migration that would fail on an already-bootstrapped database;
  update the Drizzle schema/metadata instead.
- Add `icon` and `pinned` to `Label`, `CreateLabelDto`, and `UpdateLabelDto`.
  Update test fixtures; existing API rows backfill to `tag`/`false`.
- Validate `icon` against the shared allowlist. Unknown keys return `400`.
  Existing labels receive `tag` and render safely.
- Include icon/pinned in list, create, update, `getTaskLabels`, the raw
  `LabelSearchRow`/`toLabel` in `apps/api/src/routes/search.ts`, and the settings
  label export (CSV and JSON). Order label lists by `pinned DESC, name ASC`.
- Seed new users with six context labels, colors, and icons:
  Urgent (red) → `flame`, Waiting (amber) → `hourglass`, Planning (blue) →
  `calendar-days`, Errand (green) → `basket-shopping`, Review (purple) →
  `check-double`, Idea (mint) → `lightbulb`.
  Existing users keep their labels.
- Update the OpenAPI schema and its test.

**Acceptance:** an old database upgrades in place; every label has a renderable
icon key; invalid keys are rejected; pin/unpin round-trips; search and export
return the new fields; fresh users receive the six seeded labels.

### 2.2 Define the curated icon set and registry

**Files:**

- `packages/shared/src/label-icons.ts` (new; export it from
  `packages/shared/src/index.ts`)
- `apps/frontend/src/app/shared/utils/label-icons.ts` (new)
- `apps/frontend/src/app/shared/ui/label-icon/label-icon.component.ts` (+ spec)
  to own the solid icon tile, size variants, and on-color calculation. The
  `LabelChipComponent`, directory, and editor preview compose it instead of
  duplicating the tile markup.
- Tests for the registry and suggestion function.

**Shared keys (24, grouped for the picker):**

- **Work & focus:** `briefcase`, `laptop-code`, `pen`, `book`, `graduation-cap`,
  `chart-line`
- **Life & health:** `heart`, `house`, `dumbbell`, `leaf`, `mug-hot`, `utensils`
- **Action & admin:** `basket-shopping`, `credit-card`, `phone`, `envelope`,
  `car`, `plane`
- **Signals:** `flame`, `hourglass`, `calendar-days`, `check-double`,
  `lightbulb`, `tag`

Rules:

- Keys are visual names, not semantic names (`credit-card`, not `finance`).
- Store only the key in the database; never store SVG or HTML.
- Map keys to Font Awesome icons in the frontend only. Keep the shared package
  runtime-agnostic. The installed `@fortawesome/free-solid-svg-icons` package
  has `faFire`, not `faFlame`; map `flame` → `faFire` and verify every key
  against the installed package in the registry test.
- `tag` is the fallback and the “generic label” choice.
- No emoji in v1. A curated glyph set is consistent across platforms and
  matches the calm visual system. Emoji/custom uploads are a future decision.

**Auto-suggestion:** a keyword map from the label name to a suggested icon:
Family → heart, Moving → house, Writing → pen, Call → phone, Waiting →
hourglass, Urgent → flame, Review → check-double, Idea/Ideas → lightbulb,
Finance → credit-card, Reading → book. Show the top suggestion selected but
always changeable.

**Acceptance:** every key maps to a rendered icon; suggestions are deterministic;
the picker displays all keys without missing icons.

### 2.3 Build the icon picker and label editor

**Files to create:**

- `shared/ui/label-icon-picker/label-icon-picker.component.ts` (+ spec)
- `features/personal/components/label-editor.component.ts` (+ spec)
- `shared/ui/modal/modal.component.ts/html/scss` (add a side/drawer layout, or
  add a sibling drawer component with the same focus trap and Escape handling)

**Files to remove/replace:** the label rail and inline palette form in
`label-modal.component.ts`; its create/edit logic moves to the editor.

**Editor behavior:**

- One surface, shown as a right-side drawer on desktop and a full-height sheet on
  mobile. The current `ModalComponent` is centered and has no side layout, so
  this is an explicit change, not a CSS tweak on the existing component.
- Live preview of the real chip at the top, using the shared `LabelIconComponent`
  and `LabelChipComponent`.
- Name field with validation and duplicate detection.
- Suggested icons derived from the name, followed by the grouped 24-icon picker.
- Use a radio-group pattern (`role="radiogroup"` / `role="radio"`) with roving
  tabindex for the icons; arrow keys move only while focus is in the picker,
  Enter/Space selects, and Escape closes the editor.
- “Generic tag” option and, if desired later, “No icon” mapped to `tag`.
- Eight color tints; auto-assign a color when the user has not chosen one. Keep
  the palette in one shared constant used by the API auto-assignment, the editor,
  and the seed data; the current frontend and API palettes are duplicated. If an
  existing label's color is outside the palette, show it as a selected
  legacy/custom swatch so saving does not silently recolor it.
- Keyboard: arrow keys move through the picker; Enter selects; Escape closes;
  focus returns to the trigger on close.
- Save, Cancel, and a clearly labeled Delete action with the task-count copy from
  Phase 1.
- Create supports “Create and add another” only if it does not complicate state;
  otherwise omit it.

**Acceptance:** creating a label takes name → optional icon change → save, with
the preview updating live; editing never opens a second list; keyboard-only
creation works.

### 2.4 Redesign the Labels page as a focus-area browser

**Files:** `labels-page.component.ts/html/scss`, `label-editor.component.ts`,
`apps/frontend/src/app/core/services/task.service.ts` (the single-label query
from Phase 1), `shared/ui/label-chip`, `shared/ui/label-icon`.

**Desktop layout**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Labels                                            [Search labels]  [+ New]  │
│ A few focus areas make your work easier to scan.                              │
├────────────────────────────┬─────────────────────────────────────────────────┤
│ PINNED                     │  [✎]  Writing                       3 open     │
│ [✎] Writing          3     │  Drafting, editing, and publishing.             │
│ [✦] Learning         4     │  [Open 3] [Completed 7] [All 10]   [⋯]         │
│                            │                                                 │
│ ALL LABELS                 │  ☐ Another task          Today   ● Medium      │
│ [⚑] Errand           2     │  ☐ have fun              Inbox   ● Medium      │
│ [✉] Admin            3     │  ☐ testing               Inbox   ● Low         │
│ [▤] Reading          2     │                                                 │
│                            │  + Add a task with this label                   │
│ + New label                │                                                 │
└────────────────────────────┴─────────────────────────────────────────────────┘
```

- Left directory: 32px icon tiles, name, open count, overflow menu (Edit, Pin/
  Unpin, Delete; Merge arrives in Phase 3). Search and sort A–Z; “Most used”
  sorting arrives in Phase 3. Pinned labels render in a pinned section first.
- Right pane: 40px icon tile, name, “3 open · 7 completed”, Add task, overflow.
  Segmented Open / Completed / All, using the single-label task query from
  Phase 1 with `completed=false|true|undefined`; extend that `TaskService`
  method to accept `completed` and the pane’s pagination. Task cards suppress
  the active label.
- Creation/editing uses the drawer, not a nested master-detail modal.
- On mobile, replace the two-pane layout with a drill-in: label list → selected
  label detail with a back button. Do not auto-scroll the task pane into view.
- Empty states: starter gallery when there are no labels; “No open tasks in X”
  with an Add task CTA when a label is empty.
- Accessibility: use a list of links with a sibling overflow menu (do not nest a
  button inside the link), `aria-current` on the selected row,
  `aria-live="polite"` on the pane count, focus moved to the pane heading after
  drill-in, and focus restored to the row on back.

**Acceptance:** landing selects the first pinned label, then the first
alphabetical label; create/edit/delete all start and end on this page; the icon
identity is visible in the list and pane; mobile uses drill-in and the back
button restores focus to the list; Open/Completed/All panes match their counts.

### 2.5 Replace the task modal's label grid with a picker

**Files:** `personal-task-modal.component.ts/html/scss`, shared picker/chip.

- Selected labels appear as removable chips at the top.
- A search input filters labels by name.
- The list shows icon + name + selected state.
- When the typed name has no exact match, show “Create ‘X’” and create it with
  the suggested icon and auto-assigned color, then apply it immediately.
- On a 409 duplicate, select the existing label in the picker instead of
  showing a dead-end error.
- Keyboard: Arrow Up/Down, Enter, Escape; ARIA combobox semantics.
- Remove the separate inline name + palette form. One picker, one interaction.

**Acceptance:** a user can apply an existing label or create a new one without
leaving the task modal; every label in the picker shows its icon; typing an
existing name selects it instead of creating a duplicate.

### 2.6 Update task cards and search to use icon + name

- The shared chip now renders the icon instead of the tag fallback. The
  `labelById` map from Phase 1 is already in place.
- Keep the Phase 1 cap of two full chips + overflow. Compact/icon-only is used
  only where the container is explicitly compact; accessible names remain.
- Search label results use the chip, open count, and link to the label view;
  update `apps/api/src/routes/search.ts` so its raw SQL and `toLabel` mapping
  return the icon/pinned/count fields.
- Calendar task chips keep their current text-only label names; calendar icons
  and label filtering are out of scope for this plan.

**Acceptance:** icons are legible at 12–14px in light and dark themes; color +
icon + name all render; no card displays more than two named chips; search
results show the icon and open count and link to the label view.

### 2.7 Phase 2 verification

- API migration tests: old DB → icon/pinned columns; default `tag`; invalid key;
  fresh bootstrap contains the columns and `idx_task_labels_label_id`.
- Registry tests: all 24 keys map against the installed Font Awesome package;
  suggestion fallback; `flame` → `faFire`.
- Component tests: picker keyboard/radio behavior, editor duplicate error, live
  preview, drawer focus trap.
- Labels page tests: default selection (pinned then alphabetical),
  search/sort, pin, Open/Completed/All panes, drawer open/close, mobile drill-in.
- E2E: create a label with an icon, apply it to a task, see it on the card,
  edit the icon, delete the label with confirmation.
- Visual QA at 14px, 200% zoom, light/dark, high-contrast mode, and long names.
- Run the full repo checks.

**Phase 2 exit criteria**

- Labels have icon + color + name in the primary surfaces (Labels page, task
  cards, task modal, search).
- One management surface; quick-create in the task modal reuses the same API and
  validation rather than becoming a second label manager.
- Labels page works as a focus-area browser on desktop and mobile, including
  Open/Completed/All.
- Task modal picker supports search, apply, and inline create.
- Existing labels are safely backfilled with the generic tag icon.
- Fresh users receive the six seeded context labels with their icons.

---

## 6. Phase 3 — Labels as a First-Class System

**Goal:** Make labels useful beyond management: filter, capture, merge, and
scale.

### 3.1 Extend label filtering to multiple labels and the task list

**Files:** `apps/api/src/routes/tasks.ts`, `task-service.ts`, shared DTOs,
`apps/frontend/src/app/core/services/task.service.ts`, task-list page, labels
page.

- The single-label `labelIds`/`TaskFilters` path already exists from Phase 1.
  Extend it with `labelMode=any|all` (default `any`) and a multi-select task-list
  control. Cap the number of ids and the query-string length; reject or ignore
  malformed ids rather than interpolating arbitrary strings.
- Filter with an `EXISTS` subquery against `task_labels` joined to `labels` so
  ownership is enforced; combine correctly with status, completed, due-date,
  view, and pagination. Search remains `GET /tasks/search`; do not imply the
  list endpoint has a free-text query.
- Task list: a label filter control (multi-select with search), persisted in the
  URL as `?labels=id1,id2`. Preserve the active view and other query params.
  Use a flat result set when a label filter is active so labeled subtasks are
  discoverable and the result matches the counts.
- Label chips become actionable: clicking a chip filters by that label and
  stops the card-click from opening the task. In an already-filtered label view,
  the active chip is suppressed (Phase 1 behavior).
- Define and test OR semantics. An AND toggle is optional and must be explicit.
- Check the nested interactive-control issue: `PersonalTaskCardComponent` uses
  `role="button"` on the card and already contains buttons. Do not add a nested
  chip button without resolving the accessibility semantics (refactor the card
  to a non-button container with a separate title link/overlay, or use the chip
  only outside the card's click target).

**Acceptance:** filtering by a label returns the same set as the pane count;
pagination and completed filters compose correctly; label filters survive
refresh and back/forward navigation; keyboard/screen-reader users can trigger a
label filter without activating the task card.

### 3.2 Create labels directly from capture

**Files:** `capture-bar.component.ts`, `task-list-page.component.ts`,
`task-command-parser.ts`, shared label picker/service.

- The capture bar already shows existing `#` suggestions and supports
  Arrow/Enter selection. Extend that combobox with a “Create ‘foo’” option when
  there is no exact match; do not build a second suggestions UI.
- Creating from capture uses the suggested icon and auto-assigned color, applies
  the label immediately, and never strips an unresolved tag silently.
- Keep the title parsing behavior predictable; the label token is removed only
  after a label is resolved or created. Reuse the parser’s resolved/unresolved
  result from Phase 1.
- Reuse the task modal's create logic; do not duplicate the API call shape.

**Acceptance:** “Buy milk #errand” creates/uses the Errand label and saves the
task; cancelling the suggestion preserves the typed tag.

### 3.3 Scale management: sort, merge, bulk cleanup

**Files:** `apps/api/src/routes/labels.ts`, `label-service.ts`,
`apps/api/src/docs/openapi.ts`, Labels page, label editor.

- The `pinned` field and pin/unpin menu already exist from Phase 2. Add the
  “Most used” sort option and finish the directory sort control (Pinned,
  Most used, A–Z). Pinning is the answer to “I only use three of these.”
- Add a merge action: `POST /labels/:id/merge` with a target label. Validate
  ownership, reject source = target, move `task_labels` with `INSERT OR IGNORE`,
  delete the source label, and return the number of moved associations.
  Confirmation names both labels.
- Add a duplicate warning in the editor with a “Merge into existing” action.
- Optional if time allows: multi-select labels for bulk delete/merge.
- Do not add drag-and-drop ordering until there is evidence users need it.

**Acceptance:** merging preserves every task association; pin/sort works and is
persisted; no destructive action lacks a confirmation with counts; merge
handles 400/404 paths without leaving the source label orphaned.

### 3.4 Mobile, accessibility, and density polish

**Files:** `PreferencesStore`, `settings-page.component.ts`, label chip/card
styles, and the task modal.

- Mobile: drill-in navigation, sticky pane header, focus restoration, 44px
  touch targets. The editor is already a full-height sheet from Phase 2.
- Add a setting “Show label names in task lists” (default on). When off, use
  compact icon chips with accessible names and a tap sheet. Do not make icon-only
  the default.
- Add a “Color-first labels” preference (default off) that renders full chips
  as solid label-color pills for users who want stronger color coding. Keep the
  icon and name, run the same contrast validation, and never rely on hue alone.
- Accessibility audit: keyboard-only flows for create, apply, filter, edit,
  merge, delete; `aria-live` announcements for pane counts; visible focus;
  contrast in all themes; no color-only meaning.
- Add a keyboard shortcut to open the label picker in the task modal (`L`) if it
  does not conflict with existing shortcuts; do not trigger it while focus is in
  a text field.
- Empty, loading, and error states for labels, label results, and filtering.

**Acceptance:** a keyboard-only user can complete every label task; VoiceOver/
NVDA announces chip names and pane changes; mobile has no hover-only affordance.

### 3.5 Optional, only if metrics support it

- Color calendar tasks by label.
- Show pinned labels in the sidebar under Labels.
- Label descriptions for shared/team use.
- Custom icon upload or emoji labels.
- Label usage insights (“not used in 90 days”).

These are explicitly not required for Phase 3 exit.

### 3.6 Phase 3 verification

- API tests: label filter OR/AND, ownership, completed/deleted interactions,
  flat subtask scope, pagination, merge counts, 400/404/409 paths.
- Frontend tests: filter query-param sync, chip-click filtering, capture
  create-on-enter, pin/sort, merge dialog, preferences.
- E2E: filter tasks by label from the task list; create a label from capture;
  merge two labels and verify tasks; mobile drill-in; keyboard-only run.
- Manual accessibility and contrast checklist from §7.
- Update `docs/ARCHITECTURE.md` and `PROJECT_README.md` label behavior if the
  route/feature descriptions change.

**Phase 3 exit criteria**

- Labels are visible and usable as filters in the task list.
- Capture never drops a label silently.
- Duplicate labels can be merged without losing tasks.
- The label system works on mobile and with a keyboard/screen reader.
- Metrics can be collected for the success signals in §1.4.

---

## 7. Cross-Phase Verification

Run these before each phase is considered complete:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @yotara/frontend e2e
pnpm docs:check
```

| Layer | What to test |
|:---|:---|
| API unit | Ownership, uniqueness, counts, icon validation, merge, filter semantics |
| Frontend unit | Chip rendering, card cap/suppression, picker keyboard, editor validation, page states |
| E2E | Create → apply → filter → edit → merge → delete; capture creation; mobile drill-in |
| Visual | Light/dark, 14px icons, 200% zoom, long label names, 0/1/5 labels on a card |
| Accessibility | Keyboard-only, screen reader, contrast, touch targets, reduced motion |
| Data | Old database migration, duplicate merge, idempotent startup |

**Manual release checklist**

- [ ] An existing database upgrades without data loss.
- [ ] Duplicate labels are merged and task associations survive.
- [ ] A label created with an icon appears correctly on a task card.
- [ ] A task with five labels shows two names and an accessible overflow.
- [ ] Filtering by label matches the count and survives a refresh.
- [ ] Deleting a label leaves its tasks intact.
- [ ] Deleting every label stays deleted after a reload.
- [ ] `#newtag` either creates a label or preserves the tag; it is never lost.
- [ ] Keyboard-only and mobile flows pass.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|:---|:---|
| Duplicate-merge migration deletes the wrong labels or associations | Run in a transaction; choose the earliest canonical label; `INSERT OR IGNORE` before deletes; log counts; test on a copy of a real database; keep backups. |
| The unique index is created before duplicates are cleaned up | Do not put it in `SQLITE_BOOTSTRAP_SQL`; create it only after the dedupe step inside `ensureSqliteSchema`; test an old DB with duplicates. |
| Startup migration slows boot or locks the DB | Idempotent queries, index creation after dedupe, respect the existing `busy_timeout`; benchmark with a large label set. |
| Icons are ambiguous or too small | Default to icon + name; test 24 icons at actual size; use auto-suggestions; make “Generic tag” easy. |
| Icon-only pressure returns | Enforce the two-named-chips rule; icon-only only in compact mode/overflow, with accessible names and a tap sheet. |
| Font Awesome increases bundle size | Import individual icons, keep the set to 24, verify tree-shaking and the `flame` → `faFire` mapping in the production build. |
| The labels page ships with a client-side filter again | Add the single-label query in Phase 1, test that the page uses it, and keep the server-side contract in OpenAPI. |
| `TaskService` fetches are fixed per view already, so adding a multi-label filter becomes a broad refactor | Budget for threading a filter signal through the existing view fetches (or a dedicated filtered-view method) instead of adding a parallel unfiltered/filtered cache. |
| Counts and filtered lists disagree because subtasks are handled differently | Use the flat all-non-deleted-task scope from §1.2 for counts, the Labels pane, and label-filtered task lists. |
| Adding a chip button inside a card that is already `role="button"` breaks keyboard/screen-reader behavior | Audit the card semantics in Phase 1 (the `+N` overflow) and again in Phase 3 (actionable chips); refactor the card to a non-button container or place chip actions outside its click target. |
| A right-side drawer is assumed but `ModalComponent` has no side layout | Extend the modal (or add a drawer) in Phase 2 with the same focus trap, Escape handling, and mobile sheet behavior. |
| Scope creep into project management | The plan only clarifies the taxonomy and hides contextual pills on the Labels page. Project redesign is explicitly out of scope. |
| Contrast fails in dark themes | Use tinted backgrounds plus `--on-surface` text, not raw label color for small text; validate the solid icon tile and color-first mode in every theme. |
| Existing labels all render as generic tags | Accept `tag` as the backfill; offer a “Set icons for existing labels” pass in the editor; do not block the release on manual curation. |
| The picker becomes another form to fill out | Auto-suggest icon and color; make both optional; keep name as the only required field. |

---

## 9. Open Decisions

These should be confirmed before Phase 1 implementation where they affect schema
or seeding, and before Phase 2 where they affect identity. Recommended defaults
are listed so the plan can proceed without blocking.

1. **Visible name:** keep **Labels** in navigation, use “focus areas” only as
   explanatory copy. *Recommended.*
2. **Icon style:** curated Font Awesome subset vs. a custom line-icon set.
   *Recommended for v1: Font Awesome subset, because it is already a dependency
   and can be tree-shaken; revisit if visual QA finds the glyphs too heavy.*
3. **Icon-only preference:** default off; offer “Show label names in task lists”
   in Phase 3. *Recommended.*
4. **Multi-label filter semantics:** OR (any selected label) by default; explicit
   AND toggle later. *Recommended.*
5. **Default labels:** replace the current eight with six context labels
   (Urgent, Waiting, Planning, Errand, Review, Idea), with the colors and icons
   in §2.1. Seed them only during onboarding so deleting all labels sticks.
   Existing users keep their labels. *Recommended.*
6. **Merge endpoint shape:** `POST /labels/:id/merge` with `{ targetId }`.
   *Recommended; if a generic bulk action is preferred later, it can wrap this.*
7. **Color treatment:** default to a soft chip with a solid label-color icon
   tile; use full solid pills only for selected/active state and an opt-in
   “Color-first labels” mode. *Recommended; avoid filling every pill by default.*
8. **Count scope:** counts and label-filtered views include subtasks in one flat
   list. *Recommended; it keeps counts and results in agreement.*

---

## 10. Out of Scope

- Redesigning projects or the task detail modal beyond the label picker.
- Label filtering or label icons in the calendar view.
- Team labels, shared label permissions, or workspace-level labels.
- Label groups/nesting, descriptions, or a custom color picker. Existing labels
  keep whatever hex color they already have; the UI offers the curated palette.
- Custom uploaded icons, emoji labels, or icon packs.
- Changes to label export format beyond adding `icon`/`pinned` and the new
  counts.
- Full analytics instrumentation. Success signals can be measured with SQL or
  existing usage data; a product analytics system is a separate project.
