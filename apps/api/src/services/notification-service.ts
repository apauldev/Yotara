import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { db, type Database } from '../db/client.js';
import { notifications, tasks, type DbNotification } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { startOfDayInUtc, resolveTimezone, todayInTimezone } from '../lib/timezone.js';

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
 * timezone) has been reached. Fails closed for an invalid date or time, and
 * for an unknown timezone: a wall-clock time cannot be turned into an instant
 * without knowing the zone, so guessing UTC would fire the reminder early for
 * anyone west of Greenwich.
 */
export function hasDueTimeReached(
  dueDate: string,
  dueTime: string,
  tz?: string,
  now: DateTime = DateTime.now(),
): boolean {
  const zone = resolveTimezone(tz, now);
  if (!zone) return false;

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
): boolean {
  const sinceIso = startOfDayInUtc(todayKey, tz);
  if (hasNotificationToday(tx, userId, task.id, type, sinceIso)) return false;

  createNotification(userId, type, title, task.title, task.id, tx);
  return true;
}

/**
 * Drop the current local day's reminders for a task whose timing just changed,
 * so the new timing is the only one the user hears about: a task that just
 * became timed no longer owes its date-only reminder, and one that just lost
 * its time no longer owes the exact-time reminder for the old instant. The day
 * window matches the reminder logic below, so rows from earlier days — which
 * describe that day's state — are left alone.
 *
 * A caller without a usable zone cannot be trusted to name that day. Falling
 * back to UTC is not a safe approximation: the UTC day begins after the local
 * day for anyone east of Greenwich, so a reminder they earned earlier that same
 * evening would fall outside the window, survive, and then suppress the
 * replacement in hasNotificationToday — the user would silently never hear
 * about the time they just set. Without a zone the window widens to the widest
 * real offset instead, which over-retires rather than under-retires. That is
 * safe here because only a genuine schedule change reaches this function: the
 * rows it removes describe a timing the task no longer has.
 */
export function retireSupersededDueNotifications(
  tx: Database,
  userId: string,
  taskId: string,
  tz?: string,
  now: DateTime = DateTime.now(),
): void {
  const zone = resolveTimezone(tz, now);
  const sinceIso = zone
    ? startOfDayInUtc(todayInTimezone(zone, now), zone)
    : now.minus({ hours: 26 }).toUTC().toISO() || now.minus({ hours: 26 }).toUTC().toString();

  tx.delete(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.taskId, taskId),
        inArray(notifications.type, ['due_today', 'due_time']),
        sql`${notifications.createdAt} >= ${sinceIso}`,
      ),
    )
    .run();
}

/**
 * Materialize the notifications a task is owed for the current local day, and
 * report whether one was created. A task with an exact time waits for its
 * instant and never also fires due_today on the same day; date-only tasks keep
 * their existing behavior. Timed tasks are skipped entirely when the caller's
 * timezone is missing or invalid, including the overdue branch: their day is
 * the user's local day, so a UTC comparison can put them in the past before
 * their instant has passed.
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
): boolean {
  if (!task.dueDate || task.completed) return false;

  // Without a zone a timed task's wall-clock time cannot be placed on a
  // timeline at all, and neither can its due date be compared to a local day:
  // at 02:00Z it is still yesterday in Los Angeles. Rather than announce such a
  // task early, leave it for the first timezone-aware scan.
  if (task.dueTime && !resolveTimezone(tz, now)) return false;

  const dueDateKey = task.dueDate.slice(0, 10);
  const todayKey = todayInTimezone(tz, now);

  if (dueDateKey < todayKey) {
    return createDueNotificationOnce(tx, userId, task, 'overdue', 'Task overdue', todayKey, tz);
  }

  if (dueDateKey > todayKey) return false;

  if (task.dueTime) {
    if (!hasDueTimeReached(dueDateKey, task.dueTime, tz, now)) return false;
    return createDueNotificationOnce(tx, userId, task, 'due_time', 'Task due now', todayKey, tz);
  }

  return createDueNotificationOnce(tx, userId, task, 'due_today', 'Task due today', todayKey, tz);
}

/**
 * Create any due/overdue notification the user is currently owed. Date-only
 * tasks are handled on the UTC day boundary when no timezone is supplied;
 * timed tasks are skipped in that case because their instant is zone-dependent.
 */
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
    // The insert itself reports whether it added a row, so the scan costs one
    // existence query per candidate instead of also counting unread rows twice.
    if (createDueNotificationIfNeeded(client, userId, { ...task, completed: false }, tz, now)) {
      created++;
    }
  }
  return created;
}

/**
 * The next instant at which a timed task becomes due, as a UTC ISO timestamp,
 * or null when nothing is scheduled ahead. Lets a client sleep until the moment
 * a reminder is actually owed instead of polling on a fixed cadence and firing
 * late. Returns null without a usable timezone: the instant cannot be placed
 * on a timeline without one.
 */
export function getNextDueInstant(
  userId: string,
  tz?: string,
  tx?: Database,
  now: DateTime = DateTime.now(),
): string | null {
  const client = tx ?? db;
  const zone = resolveTimezone(tz, now);
  if (!zone) return null;

  const todayKey = todayInTimezone(tz, now);
  // Bounded so a long history of finished timed tasks cannot make every poll
  // expensive; the earliest candidates come first.
  const candidates = client
    .select({ dueDate: tasks.dueDate, dueTime: tasks.dueTime })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.completed, false),
        isNull(tasks.deletedAt),
        isNull(tasks.parentId),
        isNotNull(tasks.dueTime),
        sql`date(${tasks.dueDate}) >= ${todayKey}`,
      ),
    )
    .orderBy(asc(tasks.dueDate))
    .limit(200)
    .all();

  let earliest: DateTime | null = null;
  for (const task of candidates) {
    if (!task.dueDate || !task.dueTime) continue;

    const due = DateTime.fromISO(`${task.dueDate.slice(0, 10)}T${task.dueTime}`, { zone });
    if (!due.isValid || due <= now) continue;
    if (!earliest || due < earliest) earliest = due;
  }

  return earliest ? earliest.toUTC().toISO() : null;
}
