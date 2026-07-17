import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
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

export function createDueNotificationIfNeeded(
  tx: Database,
  userId: string,
  task: { id: string; title: string; dueDate: string | null; completed: boolean },
  tz?: string,
): void {
  if (!task.dueDate || task.completed) return;

  const dueDateKey = task.dueDate.slice(0, 10);
  const todayKey = todayInTimezone(tz);

  let type: 'due_today' | 'overdue' | null = null;
  if (dueDateKey === todayKey) type = 'due_today';
  else if (dueDateKey < todayKey) type = 'overdue';

  if (!type) return;

  const sinceIso = startOfDayInUtc(todayKey, tz);
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

export function scanDueNotifications(userId: string, tz?: string, tx?: Database): number {
  const client = tx ?? db;
  const todayKey = todayInTimezone(tz);
  const tasksWithDueDate = client
    .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
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
    createDueNotificationIfNeeded(client, userId, { ...task, completed: false }, tz);
    const after = getUnreadCountForOwner(userId, client);
    if (after > before) created++;
  }
  return created;
}
