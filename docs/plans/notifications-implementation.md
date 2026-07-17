# Notifications Implementation Plan

In-app notifications with persistence (backend `notifications` table), a bell
icon + dropdown, a `/notifications` page, and optional browser notifications
that fire while the tab is open. This doc is self-contained — it does not
depend on the Web Push / email-verification / admin plans. Browser (tab-open)
notifications are a subset of this system, gated by a settings toggle.

## Conventions followed

Grounded in the existing codebase:

- **Schema** lives in `apps/api/src/db/schema.ts` (Drizzle). App tables
  (`labels`, `projects`, `tasks`) use **text ISO timestamps** via
  `nowIsoTimestamp()`, not integer timestamps. The `notifications` table
  follows the same convention.
- **Table creation** is via `SQLITE_BOOTSTRAP_SQL` in
  `apps/api/src/db/client.ts`. There is no migration runner —
  `ensureSqliteSchema` only runs `ALTER TABLE` guards for *new columns on
  existing tables*. A brand-new table just needs a `CREATE TABLE IF NOT EXISTS`
  in the bootstrap SQL. Do not write "run a migration"; add the SQL to the
  bootstrap string.
- **Services** take an optional `tx?: Database` and use
  `db.transaction(run, { behavior: 'immediate' })` for multi-table writes.
- **Task dates** are TEXT ISO; "today" comparisons must be timezone-aware using
  the existing `todayInTimezone(tz)` / `startOfDayInUtc()` helpers — never raw
  SQL `datetime('now')` (that is UTC, not the user's day).
- **Routes** use `requireAuthenticatedUser` preHandler, `request.userId`,
  OpenAPI schemas via `withJsonResponse` / `authCookieSecurity` /
  `errorResponseSchema`, and `$ref` component schemas registered in
  `apps/api/src/docs/openapi.ts`.
- **Domain types** live in `packages/shared/src/index.ts` and are imported by
  both apps.

---

## Phase 1: Backend

### 1.1 Schema — `apps/api/src/db/schema.ts`

Add a `notifications` table. Includes `task_id` (nullable) so due/overdue
notifications can be de-duplicated per task, and `read_at` for read-time
auditability.

```typescript
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Nullable: future notification types may not be task-linked. SET NULL on
  // task delete so historical notifications survive task removal.
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  type: text('type').notNull(), // 'due_today' | 'overdue' | ...
  title: text('title').notNull(),
  body: text('body'),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull(),
});

export type DbNotification = typeof notifications.$inferSelect;
export type NewDbNotification = typeof notifications.$inferInsert;
```

Cascade behavior, explicitly:
- `user_id` → `ON DELETE CASCADE` (notifications are owned by the user and are
  ephemeral; deleting a user removes all their notifications, like `labels`).
- `task_id` → `ON DELETE SET NULL` (a deleted task's historical notifications
  remain readable; `taskId` just becomes null).

### 1.2 Table creation — `apps/api/src/db/client.ts`

Add to `SQLITE_BOOTSTRAP_SQL` (no migration runner; bootstrap SQL runs on every
startup via `CREATE TABLE IF NOT EXISTS`):

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  task_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Supports the list query (user's notifications, unread-first, newest-first)
-- and the unread-count query.
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications(user_id, read, created_at);

-- Supports the de-dup probe in createDueNotificationIfNeeded.
CREATE INDEX IF NOT EXISTS idx_notifications_task_type_created
  ON notifications(task_id, type, created_at);
```

### 1.3 Service — `apps/api/src/services/notification-service.ts`

All functions accept an optional `tx?: Database` so triggers can run inside the
task-service transaction (see taste: `db.transaction(..., { behavior:
'immediate' })` with sync `.run()` calls for multi-table writes).

```typescript
import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, type Database } from '../db/client.js';
import { notifications } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { startOfDayInUtc } from '../lib/timezone.js';

// Insert a notification. Returns the created row. No dedup here — dedup is
// the caller's responsibility (see createDueNotificationIfNeeded).
export function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string | null,
  taskId: string | null,
  tx?: Database,
): DbNotification {
  const client = tx ?? db;
  const id = randomUUID();
  const now = nowIsoTimestamp();
  client
    .insert(notifications)
    .values({ id, userId, taskId, type, title, body, read: false, createdAt: now })
    .run();
  const [row] = client.select().from(notifications).where(eq(notifications.id, id)).limit(1).all();
  return row;
}

export function getNotificationsForOwner(userId: string, limit = 50, tx?: Database): DbNotification[] {
  const client = tx ?? db;
  return client
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();
}

export function getUnreadCountForOwner(userId: string, tx?: Database): number {
  const client = tx ?? db;
  const [row] = client
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .all();
  return row?.count ?? 0;
}

export function markNotificationRead(id: string, userId: string, tx?: Database): DbNotification | null {
  const client = tx ?? db;
  const now = nowIsoTimestamp();
  client
    .update(notifications)
    .set({ read: true, readAt: now })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .run();
  const [row] = client
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .limit(1)
    .all();
  return row ?? null;
}

export function clearReadForOwner(userId: string, tx?: Database): void {
  const client = tx ?? db;
  client
    .delete(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, true)))
    .run();
}
```

#### Due/overdue trigger with concrete de-dup

De-dup is per (user, task, type, *current day*). "Current day" is the start of
today in the user's timezone, expressed as a UTC ISO string via the existing
`startOfDayInUtc()` helper. This prevents both write amplification (one
notification per task per type per day) and duplicate sends when a task is
edited repeatedly.

```typescript
// Returns true if a notification of this type already exists for this task
// today (since the start-of-day boundary).
function hasNotificationToday(
  tx: Database,
  userId: string,
  taskId: string,
  type: string,
  sinceIso: string,
): boolean {
  const [row] = tx
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.taskId, taskId),
        eq(notifications.type, type),
        sql`${notifications.createdAt} >= ${sinceIso}`,
      ),
    )
    .limit(1)
    .all();
  return !!row;
}

// Called from task-service inside the task create/update transaction.
// `tz` is the user's IANA timezone (passed as ?tz= on requests, same source
// as the existing task filtering). `sinceIso` = startOfDayInUtc(tz).
export function createDueNotificationIfNeeded(
  tx: Database,
  userId: string,
  task: { id: string; title: string; dueDate: string | null; completed: boolean },
  tz?: string,
): void {
  if (!task.dueDate || task.completed) return;

  const dueDateKey = task.dueDate.slice(0, 10); // YYYY-MM-DD
  const todayKey = todayInTimezone(tz);
  const sinceIso = startOfDayInUtc(tz);

  let type: 'due_today' | 'overdue' | null = null;
  if (dueDateKey === todayKey) type = 'due_today';
  else if (dueDateKey < todayKey) type = 'overdue';

  if (!type) return;
  if (hasNotificationToday(tx, userId, task.id, type, sinceIso)) return;

  createNotification(
    userId,
    type,
    type === 'due_today' ? 'Task due today' : 'Task overdue',
    task.title,
    task.id,
    tx,
  );
}
```

### 1.4 Triggers — `apps/api/src/services/task-service.ts`

**Restrict to dueDate changes to avoid write amplification.** The trigger must
NOT run on every task write — only when a task is created with a `dueDate`, or
when `dueDate` changes on update. Run it **inside the existing task
create/update transaction**, passing `tx` so the notification insert commits
atomically with the task write (taste: multi-table transactional ops use
`db.transaction(..., { behavior: 'immediate' })`).

- On `createTask`: if the new task has a `dueDate` → call
  `createDueNotificationIfNeeded(tx, userId, task, tz)`.
- On `updateTask`: compute the *previous* `dueDate` before applying the update.
  Only call `createDueNotificationIfNeeded` if the new `dueDate` differs from
  the previous one (or the task transitioned from incomplete → complete →
  incomplete and is now due/overdue). Do not fire on edits that don't touch
  `dueDate` or completion state.
- `tz` comes from the request's `?tz=` query param (same source as existing
  task filtering). Thread it through to the trigger.

### 1.5 Shared types — `packages/shared/src/index.ts`

Add the domain type consumed by both apps (routes import response types from
`@yotara/shared`, matching the `Label` / `Task` pattern):

```typescript
export type NotificationType = 'due_today' | 'overdue';

export interface Notification {
  id: string;
  taskId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}
```

### 1.6 OpenAPI schema — `apps/api/src/docs/openapi.ts`

Register a `Notification#` component schema (mirrors how `Label#` / `Task#`
are registered) so the route schemas can `$ref` it. Include `read`,
`readAt`, `taskId`, `type`, `title`, `body`, `createdAt`.

### 1.7 Routes — `apps/api/src/routes/notifications.ts`

Default export, `preHandler: requireAuthenticatedUser`, OpenAPI schemas via
`withJsonResponse`. All endpoints throw `UnauthorizedError` if `request.userId`
is missing (matches `labels.ts`). Static path `/notifications/unread-count` is
distinct from any `:id` route, so registration order is not load-bearing, but
register it before any parametric route for readability.

- `GET /notifications?limit=50` → `getNotificationsForOwner(userId, limit)`
  (clamp `limit` to 1–200, default 50)
- `GET /notifications/unread-count` → `{ count: number }`
- `PATCH /notifications/:id/read` → `markNotificationRead(id, userId)`; 404 via
  `sendNotFound` if missing
- `DELETE /notifications/read` → `clearReadForOwner(userId)` → `{ ok: true }`

### 1.8 Register — `apps/api/src/server.ts`

```typescript
import notificationRoutes from './routes/notifications.js';
// ...
await app.register(notificationRoutes);
```

### 1.9 Tests — `apps/api/src/routes/notifications.test.ts`

Co-located route test (matches the `routes/*.test.ts` convention):
- 401 without auth on every endpoint
- create → list → unread count → mark read → count drops → clear read → empty
- `limit` is clamped (e.g. `?limit=999` behaves as 200; `?limit=0` as 50)
- 404 when marking a non-existent or other-user's notification read
- cascade delete when the user is deleted (all notifications removed)

Trigger scenarios are covered by extending `apps/api/src/routes/tasks.test.ts`:
- create a task due today → a `due_today` notification appears
- update the same task (non-dueDate field) → no second notification (dedup /
  no write amplification)
- move dueDate to an overdue date → an `overdue` notification appears; moving
  it back then forward again on the same day does not create a duplicate
- complete the task → no new due/overdue notification fires on subsequent edits

**Deliverables:** schema, bootstrap SQL, service (with `tx` support), shared
types, OpenAPI schema, routes, server registration, route + trigger tests
passing.

---

## Phase 2: Frontend

### 2.1 Service — `apps/frontend/src/app/core/services/notification.service.ts`

Dual responsibility: HTTP calls to the notifications API + a thin wrapper over
the browser `Notification` API (tab-open only; no service worker). Keep both in
one service — they share the `desktopNotifications` preference gate.

```typescript
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private prefs = inject(PreferencesStore);

  private readonly _notifications = signal<Notification[]>([]);
  private readonly _unreadCount = signal(0);
  private readonly _permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly permission = this._permission.asReadonly();
  readonly isSupported = typeof Notification !== 'undefined';

  fetchNotifications(limit = 50) { /* GET /notifications?limit= */ }
  fetchUnreadCount()              { /* GET /notifications/unread-count */ }
  markAsRead(id: string)          { /* PATCH /notifications/:id/read */ }
  clearRead()                     { /* DELETE /notifications/read */ }

  // Browser Notification API — gated by the preference (default false).
  showBrowserNotification(title: string, body: string): void {
    if (!this.isSupported) return;
    if (this._permission() !== 'granted') return;
    if (!this.prefs.desktopNotifications()) return;
    new Notification(title, { body, icon: '/logo.svg' });
  }
}
```

### 2.2 Notifications page —
`apps/frontend/src/app/features/personal/pages/notifications-page.component.ts`

Standalone component. Route `/notifications` added to the personal shell
children in `app.routes.ts`. Lists the last 50 (newest-first), read/unread
styling, click-to-mark-read, "Clear read" button, empty state.

### 2.3 Route — `apps/frontend/src/app/app.routes.ts`

Add `/notifications` to the personal-mode shell children.

### 2.4 Bell icon — `personal-shell.component.ts` + `.html`

Inject `NotificationService`. Bell button opens a dropdown showing recent
notifications; unread count badge; "View all" links to `/notifications`.
Refresh unread count on shell init and after marking read.

### 2.5 Settings toggle — `settings-page.component.ts`

Replace the "Coming soon" placeholder with a live toggle + permission status.
**Default `desktopNotifications` to `false`** (see 2.6) — a user who granted
browser permission once should not get notifications they did not explicitly
opt into via the toggle.

```typescript
protected async onDesktopNotificationsChange(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked;
  if (enabled && this.notificationService.permission() === 'default') {
    await this.notificationService.requestPermission();
  }
  this.preferences.setDesktopNotifications(enabled);
}
```

Show permission state: "Granted" / "Denied (enable in browser settings)" /
"Not supported in this browser".

### 2.6 Preferences — `preferences-store.service.ts`

Add `desktopNotifications` signal + setter + localStorage key
`yotara_desktopNotifications`. **Default `false`** (opt-in). The previous
draft defaulted to `true`, which would surprise users with notifications after
a single permission grant.

### 2.7 Task cards

`personal-task-card.component.ts` and `personal-task-workspace.component.ts`:
on task completion, call
`notificationService.showBrowserNotification('Task completed', task.title)`
alongside the existing in-app toast. The call is a no-op unless permission is
granted **and** the toggle is on.

**Deliverables:** frontend service, notifications page, route, bell dropdown,
settings toggle, preferences signal, task-card browser notifications.

---

## Phase 3: Testing & Fixing

### 3.1 Unit tests
- `notification.service.spec.ts` — mock `HttpClient`, test all HTTP methods
  and the `showBrowserNotification` guard (no-op when unsupported / not
  granted / toggle off).
- `notifications-page.component.spec.ts` — mock service, test rendering and
  mark-read.
- Update `personal-shell.component.spec.ts` — bell icon, dropdown, unread
  badge.
- Update `settings-page.component.spec.ts` — toggle + permission states.

### 3.2 E2E tests
`apps/frontend/e2e/specs/authenticated/notifications.spec.ts` — full flow:
create a task due today → notification appears in the bell → mark read →
`/notifications` page reflects state.

### 3.3 Integration / cascade
- All API routes require auth (401 without session).
- Deleting a user cascades to delete their notifications (covered in 1.9).
- Deleting a task sets `taskId` to null on its notifications (covered in 1.9);
  notifications remain visible.

### 3.4 Manual testing
- Create a task due today → `due_today` notification in the bell.
- Edit the task's title (not dueDate) → no duplicate notification.
- Click a notification → marks read, badge count drops.
- `/notifications` page shows the list; "Clear read" empties read items.
- Settings toggle on → grant browser permission → complete a task → browser
  notification fires. Toggle off → no browser notification even if permission
  is still granted.

### 3.5 Regression
- All existing API and frontend test suites pass (referenced by suite name, not
  by a hard-coded count — counts go stale as tests are added).
- No new TypeScript errors, no new lint warnings.

**Deliverables:** all unit, e2e, and integration tests passing; no regressions.

---

## File Summary

### New files
| File | Purpose |
|------|---------|
| `apps/api/src/routes/notifications.ts` | CRUD endpoints |
| `apps/api/src/routes/notifications.test.ts` | API route + cascade tests |
| `apps/api/src/services/notification-service.ts` | Service layer (with `tx` support + dedup) |
| `apps/frontend/src/app/core/services/notification.service.ts` | Client service (HTTP + browser) |
| `apps/frontend/src/app/core/services/notification.service.spec.ts` | Unit tests |
| `apps/frontend/src/app/features/personal/pages/notifications-page.component.ts` | Page |
| `apps/frontend/src/app/features/personal/pages/notifications-page.component.spec.ts` | Unit tests |
| `apps/frontend/e2e/specs/authenticated/notifications.spec.ts` | E2E tests |

### Modified files
| File | Changes |
|------|---------|
| `apps/api/src/db/schema.ts` | Add `notifications` table + `DbNotification` / `NewDbNotification` types |
| `apps/api/src/db/client.ts` | Add `notifications` table + indexes to `SQLITE_BOOTSTRAP_SQL` |
| `apps/api/src/server.ts` | Register notification routes |
| `apps/api/src/services/task-service.ts` | Add due/overdue triggers inside create/update transactions (dueDate-change-gated) |
| `apps/api/src/routes/tasks.test.ts` | Add trigger + dedup scenarios |
| `apps/api/src/docs/openapi.ts` | Register `Notification#` component schema |
| `packages/shared/src/index.ts` | Add `Notification`, `NotificationType` |
| `apps/frontend/src/app/app.routes.ts` | Add `/notifications` route |
| `apps/frontend/src/app/core/services/preferences-store.service.ts` | Add `desktopNotifications` (default `false`) |
| `apps/frontend/src/app/features/personal/pages/settings-page.component.ts` | Replace "Coming soon" with live toggle |
| `apps/frontend/src/app/features/personal/shell/personal-shell.component.ts` | Inject service, bell dropdown state |
| `apps/frontend/src/app/features/personal/shell/personal-shell.component.html` | Bell icon, badge, dropdown |
| `apps/frontend/src/app/features/personal/components/personal-task-card.component.ts` | Browser notification on completion |
| `apps/frontend/src/app/features/personal/components/personal-task-workspace.component.ts` | Browser notification on completion |

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Backend | 1 day |
| Phase 2: Frontend | 1.5 days |
| Phase 3: Testing | 1 day |
| **Total** | **3.5 days** |

---

## Dependencies

- Drizzle ORM for schema (text ISO timestamps, app-table convention)
- `SQLITE_BOOTSTRAP_SQL` in `db/client.ts` for table creation (no migration runner)
- Fastify for routes (`requireAuthenticatedUser`, OpenAPI schemas)
- `@yotara/shared` for the `Notification` domain type
- Angular standalone components + signals
- FontAwesome icons (already in project)
- `HttpClient` for API calls
- Native `Notification` API (browser) — tab-open only, no service worker
