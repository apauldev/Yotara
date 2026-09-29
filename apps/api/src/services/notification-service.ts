import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, type Database } from '../db/client.js';
import { notifications, tasks, type DbNotification } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { startOfDayInUtc, todayInTimezone } from '../lib/timezone.js';

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

export function getNotificationsForOwner(
  userId: string,
  limit = 50,
  tx?: Database,
): DbNotification[] {
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

export function markNotificationRead(
  id: string,
  userId: string,
  tx?: Database,
): DbNotification | null {
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

export function markAllReadForOwner(userId: string, tx?: Database): void {
  const client = tx ?? db;
  const now = nowIsoTimestamp();
  client
    .update(notifications)
    .set({ read: true, readAt: now })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .run();
}

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

/**
 * True once the due instant (date plus wall-clock time in the user's
 * timezone) has been reached. Falls back to UTC for an invalid timezone and
 * fails closed for an invalid date or time.
 */
export function hasDueTimeReached(
  dueDate: string,
  dueTime: string,
  tz?: string,
  now: DateTime = DateTime.now(),
): boolean {
  const zone = tz && now.setZone(tz).isValid ? tz : 'UTC';
  const current = now.setZone(zone);
  const due = DateTime.fromISO(`${dueDate.slice(0, 10)}T${dueTime}`, { zone });

  return due.isValid && current >= due;
}

function createDueNotificationOnce(
  tx: Database,
  userId: string,
  task: { id: string; title: string },
  type: 'due_today' | 'overdue' | 'due_time',
  title: string,
  todayKey: string,
  tz?: string,
): void {
  const sinceIso = startOfDayInUtc(todayKey, tz);
  if (hasNotificationToday(tx, userId, task.id, type, sinceIso)) return;

  createNotification(userId, type, title, task.title, task.id, tx);
}

/**
 * Materialize the one notification a task is owed for the current local day.
 * A task with an exact time waits for its instant and never also fires
 * due_today on the same day; date-only tasks keep their existing behavior.
 */
export function createDueNotificationIfNeeded(
  tx: Database,
  userId: string,
  task: {
    id: string;
    title: string;
    dueDate: string | null;
    dueTime?: string | null;
    completed: boolean;
  },
  tz?: string,
  now: DateTime = DateTime.now(),
): void {
  if (!task.dueDate || task.completed) return;

  const dueDateKey = task.dueDate.slice(0, 10);
  const todayKey = todayInTimezone(tz, now);

  if (dueDateKey < todayKey) {
    createDueNotificationOnce(tx, userId, task, 'overdue', 'Task overdue', todayKey, tz);
    return;
  }

  if (dueDateKey > todayKey) return;

  if (task.dueTime) {
    if (!hasDueTimeReached(dueDateKey, task.dueTime, tz, now)) return;
    createDueNotificationOnce(tx, userId, task, 'due_time', 'Task due now', todayKey, tz);
    return;
  }

  createDueNotificationOnce(tx, userId, task, 'due_today', 'Task due today', todayKey, tz);
}

export function scanDueNotifications(
  userId: string,
  tz?: string,
  tx?: Database,
  now: DateTime = DateTime.now(),
): number {
  const client = tx ?? db;
  const todayKey = todayInTimezone(tz, now);
  const tasksWithDueDate = client
    .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, dueTime: tasks.dueTime })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.completed, false),
        isNull(tasks.deletedAt),
        isNull(tasks.parentId),
        sql`date(${tasks.dueDate}) <= ${todayKey}`,
      ),
    )
    .all();

  let created = 0;
  for (const task of tasksWithDueDate) {
    if (!task.dueDate) continue;
    const before = getUnreadCountForOwner(userId, client);
    createDueNotificationIfNeeded(client, userId, { ...task, completed: false }, tz, now);
    const after = getUnreadCountForOwner(userId, client);
    if (after > before) created++;
  }
  return created;
}
