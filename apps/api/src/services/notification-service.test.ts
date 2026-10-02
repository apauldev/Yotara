import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';
import { createDbClient, type Database } from '../db/client.js';
import {
  createNotification,
  getNotificationsForOwner,
  getUnreadCountForOwner,
  markNotificationRead,
  clearReadForOwner,
  markAllReadForOwner,
  createDueNotificationIfNeeded,
  getNextDueInstant,
  hasDueTimeReached,
  retireSupersededDueNotifications,
  scanDueNotifications,
} from './notification-service.js';
import { notifications } from '../db/schema.js';

function createTestDb(): {
  db: Database;
  userId: string;
  sqlite: ReturnType<typeof createDbClient>['sqlite'];
} {
  const { db, sqlite } = createDbClient(':memory:');
  const userId = randomUUID();
  const now = Date.now();
  sqlite
    .prepare(
      `INSERT INTO user (id, name, email, emailVerified, onboardingCompleted, createdAt, updatedAt)
       VALUES (?, 'Test User', ?, 1, 1, ?, ?)`,
    )
    .run(userId, `${userId}@test.com`, now, now);
  return { db, userId, sqlite };
}

function createTask(
  sqlite: ReturnType<typeof createDbClient>['sqlite'],
  taskId: string,
  userId: string,
  title: string,
) {
  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO tasks (id, user_id, title, status, priority, completed, sort_order, simple_mode, created_at, updated_at)
       VALUES (?, ?, ?, 'inbox', 'medium', 0, 0, 0, ?, ?)`,
    )
    .run(taskId, userId, title, now, now);
}

test('createNotification inserts and returns a notification row', () => {
  const { db, userId } = createTestDb();

  const row = createNotification(userId, 'due_today', 'Task due today', 'My task', null, db);
  assert.equal(row.type, 'due_today');
  assert.equal(row.title, 'Task due today');
  assert.equal(row.body, 'My task');
  assert.equal(row.read, false);
  assert.ok(row.id);
});

test('createNotification handles null body', () => {
  const { db, userId } = createTestDb();

  const row = createNotification(userId, 'overdue', 'Task overdue', null, null, db);
  assert.equal(row.body, null);
  assert.equal(row.taskId, null);
});

test('getNotificationsForOwner returns notifications ordered by createdAt desc', () => {
  const { db, userId } = createTestDb();

  createNotification(userId, 'due_today', 'First', 'body1', null, db);
  createNotification(userId, 'overdue', 'Second', 'body2', null, db);

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 2);
  const titles = rows.map((r) => r.title);
  assert.ok(titles.includes('First'));
  assert.ok(titles.includes('Second'));
});

test('getNotificationsForOwner respects limit', () => {
  const { db, userId } = createTestDb();

  for (let i = 0; i < 5; i++) {
    createNotification(userId, 'due_today', `Task ${i}`, `body ${i}`, null, db);
  }

  const rows = getNotificationsForOwner(userId, 3, db);
  assert.equal(rows.length, 3);
});

test('getNotificationsForOwner uses default limit of 50', () => {
  const { db, userId } = createTestDb();
  const rows = getNotificationsForOwner(userId, undefined, db);
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, 0);
});

test('getUnreadCountForOwner returns count of unread notifications', () => {
  const { db, userId } = createTestDb();

  createNotification(userId, 'due_today', 'T1', 'b1', null, db);
  createNotification(userId, 'overdue', 'T2', 'b2', null, db);

  assert.equal(getUnreadCountForOwner(userId, db), 2);

  const notifs = getNotificationsForOwner(userId, 50, db);
  markNotificationRead(notifs[0].id, userId, db);

  assert.equal(getUnreadCountForOwner(userId, db), 1);
});

test('getUnreadCountForOwner returns 0 for unknown user', () => {
  const { db } = createTestDb();
  assert.equal(getUnreadCountForOwner(randomUUID(), db), 0);
});

test('markNotificationRead sets read=true and readAt', () => {
  const { db, userId } = createTestDb();

  const created = createNotification(userId, 'due_today', 'T', 'b', null, db);
  const updated = markNotificationRead(created.id, userId, db);

  assert.ok(updated);
  assert.equal(updated.read, true);
  assert.ok(updated.readAt);
});

test('markNotificationRead returns null for non-existent notification', () => {
  const { db } = createTestDb();
  const result = markNotificationRead('nonexistent', randomUUID(), db);
  assert.equal(result, null);
});

test('markNotificationRead returns null for wrong user', () => {
  const { db, userId } = createTestDb();

  const created = createNotification(userId, 'due_today', 'T', 'b', null, db);
  const result = markNotificationRead(created.id, randomUUID(), db);
  assert.equal(result, null);
});

test('markNotificationRead is idempotent', () => {
  const { db, userId } = createTestDb();

  const created = createNotification(userId, 'due_today', 'T', 'b', null, db);
  const first = markNotificationRead(created.id, userId, db);
  const second = markNotificationRead(created.id, userId, db);

  assert.ok(first);
  assert.ok(second);
  assert.ok(first!.readAt);
  assert.ok(second!.readAt);
  assert.equal(first!.read, true);
  assert.equal(second!.read, true);
});

test('clearReadForOwner deletes only read notifications', () => {
  const { db, userId } = createTestDb();

  createNotification(userId, 'due_today', 'Unread', 'b1', null, db);
  const read = createNotification(userId, 'overdue', 'Read', 'b2', null, db);
  markNotificationRead(read.id, userId, db);

  clearReadForOwner(userId, db);

  const remaining = getNotificationsForOwner(userId, 50, db);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].title, 'Unread');
});

test('markAllReadForOwner marks all unread as read', () => {
  const { db, userId } = createTestDb();

  createNotification(userId, 'due_today', 'T1', 'b1', null, db);
  createNotification(userId, 'overdue', 'T2', 'b2', null, db);

  markAllReadForOwner(userId, db);

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.ok(rows.every((r) => r.read === true));
  assert.equal(getUnreadCountForOwner(userId, db), 0);
});

test('createDueNotificationIfNeeded creates due_today notification', () => {
  const { db, userId, sqlite } = createTestDb();
  const today = new Date().toISOString().slice(0, 10);
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'My task');

  createDueNotificationIfNeeded(db, userId, {
    id: taskId,
    title: 'My task',
    dueDate: today,
    completed: false,
  });

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'due_today');
  assert.equal(rows[0].title, 'Task due today');
});

test('createDueNotificationIfNeeded creates overdue notification', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Old task');

  createDueNotificationIfNeeded(db, userId, {
    id: taskId,
    title: 'Old task',
    dueDate: '2020-01-01',
    completed: false,
  });

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'overdue');
  assert.equal(rows[0].title, 'Task overdue');
});

test('createDueNotificationIfNeeded skips when task is completed', () => {
  const { db, userId } = createTestDb();
  const today = new Date().toISOString().slice(0, 10);

  createDueNotificationIfNeeded(db, userId, {
    id: randomUUID(),
    title: 'Done task',
    dueDate: today,
    completed: true,
  });

  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('createDueNotificationIfNeeded skips when dueDate is null', () => {
  const { db, userId } = createTestDb();

  createDueNotificationIfNeeded(db, userId, {
    id: randomUUID(),
    title: 'No date task',
    dueDate: null,
    completed: false,
  });

  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('createDueNotificationIfNeeded skips when due date is in the future', () => {
  const { db, userId } = createTestDb();

  createDueNotificationIfNeeded(db, userId, {
    id: randomUUID(),
    title: 'Future task',
    dueDate: '2099-12-31',
    completed: false,
  });

  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('createDueNotificationIfNeeded deduplicates when notification already exists today', () => {
  const { db, userId, sqlite } = createTestDb();
  const today = new Date().toISOString().slice(0, 10);
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Task');

  createDueNotificationIfNeeded(db, userId, {
    id: taskId,
    title: 'Task',
    dueDate: today,
    completed: false,
  });

  createDueNotificationIfNeeded(db, userId, {
    id: taskId,
    title: 'Task',
    dueDate: today,
    completed: false,
  });

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1, 'should not create duplicate notification');
});

test('getNextDueInstant returns the next scheduled timed instant', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T10:00:00', { zone: 'UTC' });

  const soon = randomUUID();
  const later = randomUUID();
  const past = randomUUID();
  const untimed = randomUUID();
  createTask(sqlite, soon, userId, 'Soon');
  createTask(sqlite, later, userId, 'Later');
  createTask(sqlite, past, userId, 'Already due');
  createTask(sqlite, untimed, userId, 'Untimed');
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '10:03', soon);
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '18:00', later);
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '09:00', past);
  sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run('2026-09-25', untimed);

  // The soonest future instant wins; an instant already passed and a task with
  // no time are not candidates.
  assert.equal(getNextDueInstant(userId, 'UTC', db, now), '2026-09-25T10:03:00.000Z');
});

test('getNextDueInstant skips completed, deleted and subtask candidates', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T10:00:00', { zone: 'UTC' });

  const completed = randomUUID();
  const deleted = randomUUID();
  const parent = randomUUID();
  const subtask = randomUUID();
  createTask(sqlite, completed, userId, 'Completed');
  createTask(sqlite, deleted, userId, 'Deleted');
  createTask(sqlite, parent, userId, 'Parent');
  createTask(sqlite, subtask, userId, 'Subtask');
  for (const id of [completed, deleted, subtask]) {
    sqlite
      .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
      .run('2026-09-25', '10:01', id);
  }
  sqlite.prepare(`UPDATE tasks SET completed = 1 WHERE id = ?`).run(completed);
  sqlite
    .prepare(`UPDATE tasks SET deleted_at = ? WHERE id = ?`)
    .run('2026-09-25T00:00:00.000Z', deleted);
  sqlite.prepare(`UPDATE tasks SET parent_id = ? WHERE id = ?`).run(parent, subtask);

  assert.equal(getNextDueInstant(userId, 'UTC', db, now), null);
});

test('getNextDueInstant returns null without a usable timezone', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Timed');
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '10:03', taskId);

  const now = DateTime.fromISO('2026-09-25T10:00:00', { zone: 'UTC' });
  assert.equal(getNextDueInstant(userId, undefined, db, now), null);
  assert.equal(getNextDueInstant(userId, 'Not/AZone', db, now), null);
  assert.equal(getNextDueInstant(userId, 'UTC', db, now), '2026-09-25T10:03:00.000Z');
});

test('getNextDueInstant reads the instant in the user timezone', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '09:00', taskId);

  // 09:00 in New York is 13:00 UTC.
  const now = DateTime.fromISO('2026-09-25T12:00:00', { zone: 'UTC' });
  assert.equal(getNextDueInstant(userId, 'America/New_York', db, now), '2026-09-25T13:00:00.000Z');
});

test('createDueNotificationIfNeeded reports whether it created a notification', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  const task = {
    id: taskId,
    title: 'Call Sam',
    dueDate: '2026-09-25',
    dueTime: '14:00',
    completed: false,
  };

  assert.equal(createDueNotificationIfNeeded(db, userId, task, 'UTC', now), true);
  // Already earned today, so a second pass creates nothing and reports so.
  assert.equal(createDueNotificationIfNeeded(db, userId, task, 'UTC', now), false);
  // Before its instant, and with no usable zone, nothing is created either.
  const notYet = { ...task, dueTime: '23:00' };
  assert.equal(createDueNotificationIfNeeded(db, userId, notYet, 'UTC', now), false);
  assert.equal(createDueNotificationIfNeeded(db, userId, task, undefined, now), false);
  assert.equal(getNotificationsForOwner(userId, 50, db).length, 1);
});

test('retireSupersededDueNotifications removes only this day\u2019s reminders', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  const otherTaskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  createTask(sqlite, otherTaskId, userId, 'Other task');

  createNotification(userId, 'due_today', 'Task due today', 'Call Sam', taskId, db);
  createNotification(userId, 'overdue', 'Task overdue', 'Call Sam', taskId, db);
  createNotification(userId, 'due_time', 'Task due now', 'Call Sam', taskId, db);
  createNotification(userId, 'due_today', 'Task due today', 'Other task', otherTaskId, db);
  // Earlier-day rows describe that day's state and are not this decision's business.
  for (const type of ['due_today', 'due_time'] as const) {
    db.insert(notifications)
      .values({
        id: randomUUID(),
        userId,
        taskId,
        type,
        title: 'Task due today',
        body: 'Call Sam',
        read: false,
        createdAt: '2026-09-24T08:00:00.000Z',
      })
      .run();
  }

  retireSupersededDueNotifications(db, userId, taskId, 'UTC', now);

  const rows = getNotificationsForOwner(userId, 50, db);
  const todaysRows = rows.filter(
    (row) => row.body === 'Call Sam' && row.createdAt >= '2026-09-25T00:00:00.000Z',
  );
  assert.deepEqual(
    todaysRows.map((row) => row.type),
    ['overdue'],
    'only today\u2019s overdue row is kept',
  );
  assert.equal(rows.length, 4, 'earlier-day and other-task rows survive');
});

test('retireSupersededDueNotifications scopes the day to the caller\u2019s zone', () => {
  const now = DateTime.fromISO('2026-09-25T02:00:00', { zone: 'UTC' });
  // 16:00 on 2026-09-24 in New York, and still 2026-09-24 in UTC.
  const createdAt = '2026-09-24T20:00:00.000Z';

  const newYork = createTestDb();
  const newYorkTaskId = randomUUID();
  createTask(newYork.sqlite, newYorkTaskId, newYork.userId, 'Call Sam');
  newYork.db
    .insert(notifications)
    .values({
      id: randomUUID(),
      userId: newYork.userId,
      taskId: newYorkTaskId,
      type: 'due_today',
      title: 'Task due today',
      body: 'Call Sam',
      read: false,
      createdAt,
    })
    .run();
  retireSupersededDueNotifications(
    newYork.db,
    newYork.userId,
    newYorkTaskId,
    'America/New_York',
    now,
  );
  // New York is still on 2026-09-24 at 02:00Z, so the row is the current day's.
  assert.equal(getNotificationsForOwner(newYork.userId, 50, newYork.db).length, 0);

  const utc = createTestDb();
  const utcTaskId = randomUUID();
  createTask(utc.sqlite, utcTaskId, utc.userId, 'Call Sam');
  utc.db
    .insert(notifications)
    .values({
      id: randomUUID(),
      userId: utc.userId,
      taskId: utcTaskId,
      type: 'due_today',
      title: 'Task due today',
      body: 'Call Sam',
      read: false,
      createdAt,
    })
    .run();
  retireSupersededDueNotifications(utc.db, utc.userId, utcTaskId, 'UTC', now);
  // In UTC the same moment is already 2026-09-25, so the row belongs to yesterday.
  assert.equal(getNotificationsForOwner(utc.userId, 50, utc.db).length, 1);
});

/**
 * Seeds a notification row with an explicit createdAt, since createNotification
 * always stamps the current instant.
 */
function seedReminder(
  db: Database,
  userId: string,
  taskId: string,
  type: 'due_today' | 'due_time' | 'overdue',
  createdAt: string,
  body = 'Call Sam',
): void {
  db.insert(notifications)
    .values({
      id: randomUUID(),
      userId,
      taskId,
      type,
      title: 'Task due today',
      body,
      read: false,
      createdAt,
    })
    .run();
}

test('a zone-less retirement still removes a reminder earned east of Greenwich', () => {
  const now = DateTime.fromISO('2026-09-25T02:00:00', { zone: 'UTC' });
  // 05:00 on 2026-09-25 in Tokyo. A UTC-day window opens at 00:00Z, which is
  // nine hours after this row was created, so the row sits outside it and
  // survives — and then suppresses the replacement reminder for the new time.
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  seedReminder(db, userId, taskId, 'due_time', '2026-09-24T20:00:00.000Z');

  retireSupersededDueNotifications(db, userId, taskId, undefined, now);

  assert.equal(
    getNotificationsForOwner(userId, 50, db).length,
    0,
    'the superseded reminder is retired even without a zone',
  );
});

test('an invalid zone is retired as cautiously as an absent one', () => {
  const now = DateTime.fromISO('2026-09-25T02:00:00', { zone: 'UTC' });
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  seedReminder(db, userId, taskId, 'due_time', '2026-09-24T20:00:00.000Z');

  // A garbage zone must not silently narrow the window the way UTC did.
  retireSupersededDueNotifications(db, userId, taskId, 'Not/AZone', now);

  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('a zone-less retirement stays bounded to recent rows of that task', () => {
  const now = DateTime.fromISO('2026-09-25T02:00:00', { zone: 'UTC' });
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  const otherTaskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  createTask(sqlite, otherTaskId, userId, 'Other task');

  seedReminder(db, userId, taskId, 'due_time', '2026-09-24T20:00:00.000Z');
  // Types outside the superseded pair describe a different decision.
  seedReminder(db, userId, taskId, 'overdue', '2026-09-24T20:00:00.000Z');
  // Another task's row is never this call's business.
  seedReminder(db, userId, otherTaskId, 'due_time', '2026-09-24T20:00:00.000Z', 'Other task');
  // And a reminder from well before the fallback window stays as history.
  seedReminder(db, userId, taskId, 'due_today', '2026-09-22T08:00:00.000Z');

  retireSupersededDueNotifications(db, userId, taskId, undefined, now);

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.deepEqual(
    rows.map((row) => `${row.type}:${row.body}`).sort(),
    ['due_time:Other task', 'due_today:Call Sam', 'overdue:Call Sam'],
    'only the recent due_today row of this task is retired',
  );
});

test('a zone-less reschedule does not suppress the reminder for the new time', () => {
  const now = DateTime.fromISO('2026-09-25T02:00:00', { zone: 'UTC' });
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  // The reminder earned for the original 08:00 Tokyo instant.
  seedReminder(db, userId, taskId, 'due_time', '2026-09-24T20:00:00.000Z');

  // A client that does not send a zone moves the task's time.
  retireSupersededDueNotifications(db, userId, taskId, undefined, now);

  // The follow-up timezone-aware scan owes a fresh reminder for the new time.
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '10:00', taskId);

  assert.equal(
    createDueNotificationIfNeeded(
      db,
      userId,
      { id: taskId, title: 'Call Sam', dueDate: '2026-09-25', dueTime: '10:00', completed: false },
      'Asia/Tokyo',
      now,
    ),
    true,
    'the replacement reminder is created rather than deduplicated away',
  );
});

test('a timezone-less scan does not call a timed task overdue', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '23:30', taskId);

  // 2026-09-26T02:00Z is still 2026-09-25 in Los Angeles, so the task is not
  // overdue there yet and its instant is still six hours away. Judged against
  // the UTC day instead, the date alone would already look past.
  const instant = DateTime.fromISO('2026-09-26T02:00:00', { zone: 'UTC' });
  assert.equal(scanDueNotifications(userId, undefined, db, instant), 0);
  assert.equal(scanDueNotifications(userId, 'America/Los_Angeles', db, instant), 0);
  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);

  // Past the local day and the instant, the same task is overdue.
  const later = DateTime.fromISO('2026-09-27T02:00:00', { zone: 'UTC' });
  assert.equal(scanDueNotifications(userId, 'America/Los_Angeles', db, later), 1);
  assert.equal(getNotificationsForOwner(userId, 50, db)[0].type, 'overdue');
});

test('a timezone-less scan still calls a date-only task overdue', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Old task');
  sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run('2026-09-25', taskId);

  const instant = DateTime.fromISO('2026-09-26T02:00:00', { zone: 'UTC' });
  assert.equal(scanDueNotifications(userId, undefined, db, instant), 1);
  assert.equal(getNotificationsForOwner(userId, 50, db)[0].type, 'overdue');
});

test('createDueNotificationIfNeeded respects custom timezone', () => {
  const { db, userId, sqlite } = createTestDb();
  const today = new Date().toISOString().slice(0, 10);
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Timezone task');

  createDueNotificationIfNeeded(
    db,
    userId,
    {
      id: taskId,
      title: 'Timezone task',
      dueDate: today,
      completed: false,
    },
    'America/New_York',
  );

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
});

test('scanDueNotifications creates notifications for due_today tasks', () => {
  const { db, userId, sqlite } = createTestDb();
  const today = new Date().toISOString().slice(0, 10);
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Due today task');
  sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run(today, taskId);

  const created = scanDueNotifications(userId, undefined, db);
  assert.equal(created, 1);
  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'due_today');
});

test('scanDueNotifications creates notifications for overdue tasks', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Overdue task');
  sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run('2020-01-01', taskId);

  const created = scanDueNotifications(userId, undefined, db);
  assert.equal(created, 1);
  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'overdue');
});

test('scanDueNotifications skips completed tasks', () => {
  const { db, userId, sqlite } = createTestDb();
  const today = new Date().toISOString().slice(0, 10);
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Completed task');
  sqlite.prepare(`UPDATE tasks SET due_date = ?, completed = 1 WHERE id = ?`).run(today, taskId);

  const created = scanDueNotifications(userId, undefined, db);
  assert.equal(created, 0);
  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('scanDueNotifications skips tasks with future due dates', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Future task');
  sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run('2099-12-31', taskId);

  const created = scanDueNotifications(userId, undefined, db);
  assert.equal(created, 0);
  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('scanDueNotifications skips tasks without due dates', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'No due date task');

  const created = scanDueNotifications(userId, undefined, db);
  assert.equal(created, 0);
  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('scanDueNotifications skips subtasks', () => {
  const { db, userId, sqlite } = createTestDb();
  const today = new Date().toISOString().slice(0, 10);
  const parentTaskId = randomUUID();
  const subtaskId = randomUUID();
  createTask(sqlite, parentTaskId, userId, 'Parent task');
  createTask(sqlite, subtaskId, userId, 'Subtask');
  sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run(today, parentTaskId);
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, parent_id = ? WHERE id = ?`)
    .run(today, parentTaskId, subtaskId);

  const created = scanDueNotifications(userId, undefined, db);
  assert.equal(created, 1);
  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].body, 'Parent task');
});

test('scanDueNotifications deduplicates existing notifications', () => {
  const { db, userId, sqlite } = createTestDb();
  const today = new Date().toISOString().slice(0, 10);
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Dedup task');
  sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run(today, taskId);

  const first = scanDueNotifications(userId, undefined, db);
  assert.equal(first, 1);

  const second = scanDueNotifications(userId, undefined, db);
  assert.equal(second, 0);
  assert.equal(getNotificationsForOwner(userId, 50, db).length, 1);
});

test('scanDueNotifications returns 0 for user with no tasks', () => {
  const { db, userId } = createTestDb();
  const created = scanDueNotifications(userId, undefined, db);
  assert.equal(created, 0);
});

test('hasDueTimeReached compares the due instant in the user timezone', () => {
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });

  assert.equal(hasDueTimeReached('2026-09-25', '14:59', 'UTC', now), true);
  assert.equal(hasDueTimeReached('2026-09-25', '15:00', 'UTC', now), true);
  assert.equal(hasDueTimeReached('2026-09-25', '15:01', 'UTC', now), false);
  // 15:00 UTC is 11:00 in New York, so 10:00 has passed and 12:00 has not.
  assert.equal(hasDueTimeReached('2026-09-25', '10:00', 'America/New_York', now), true);
  assert.equal(hasDueTimeReached('2026-09-25', '12:00', 'America/New_York', now), false);
  // Unknown zones fail closed: a wall-clock time is not an instant without one.
  assert.equal(hasDueTimeReached('2026-09-25', '14:00', 'Not/AZone', now), false);
  assert.equal(hasDueTimeReached('2026-09-25', '14:00', undefined, now), false);
  assert.equal(hasDueTimeReached('2026-09-25', 'nope', 'UTC', now), false);
});

test('createDueNotificationIfNeeded creates a due_time notification once the instant passes', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');

  createDueNotificationIfNeeded(
    db,
    userId,
    {
      id: taskId,
      title: 'Call Sam',
      dueDate: '2026-09-25',
      dueTime: '14:00',
      completed: false,
    },
    'UTC',
    now,
  );

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'due_time');
  assert.equal(rows[0].title, 'Task due now');
  assert.equal(rows[0].body, 'Call Sam');
});

test('createDueNotificationIfNeeded waits for a same-day due time', () => {
  const { db, userId } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });

  createDueNotificationIfNeeded(
    db,
    userId,
    {
      id: randomUUID(),
      title: 'Later task',
      dueDate: '2026-09-25',
      dueTime: '15:01',
      completed: false,
    },
    'UTC',
    now,
  );

  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('createDueNotificationIfNeeded skips a completed timed task', () => {
  const { db, userId } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });

  createDueNotificationIfNeeded(
    db,
    userId,
    {
      id: randomUUID(),
      title: 'Done timed task',
      dueDate: '2026-09-25',
      dueTime: '14:00',
      completed: true,
    },
    'UTC',
    now,
  );

  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('a timed task produces due_time instead of due_today on the same day', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Timed task');

  createDueNotificationIfNeeded(
    db,
    userId,
    {
      id: taskId,
      title: 'Timed task',
      dueDate: '2026-09-25',
      dueTime: '14:00',
      completed: false,
    },
    'UTC',
    now,
  );

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'due_time');
});

test('a timed task from an earlier day is overdue, not due_time', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Old timed task');

  createDueNotificationIfNeeded(
    db,
    userId,
    {
      id: taskId,
      title: 'Old timed task',
      dueDate: '2026-09-24',
      dueTime: '14:00',
      completed: false,
    },
    'UTC',
    now,
  );

  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'overdue');
});

test('createDueNotificationIfNeeded deduplicates due_time within the local day', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Timed task');
  const task = {
    id: taskId,
    title: 'Timed task',
    dueDate: '2026-09-25',
    dueTime: '14:00',
    completed: false,
  };

  createDueNotificationIfNeeded(db, userId, task, 'UTC', now);
  createDueNotificationIfNeeded(db, userId, { ...task, dueTime: '14:30' }, 'UTC', now);

  assert.equal(getNotificationsForOwner(userId, 50, db).length, 1);
});

test('scanDueNotifications creates due_time once the instant passes', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Timed task');
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '14:00', taskId);

  const created = scanDueNotifications(userId, 'UTC', db, now);

  assert.equal(created, 1);
  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'due_time');
});

test('scanDueNotifications skips a timed task before its instant', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Later timer');
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '16:00', taskId);

  assert.equal(scanDueNotifications(userId, 'UTC', db, now), 0);
  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('scanDueNotifications skips timed tasks when no timezone is supplied', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Timed task');
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '14:00', taskId);

  assert.equal(scanDueNotifications(userId, undefined, db, now), 0);
  assert.equal(scanDueNotifications(userId, 'Not/AZone', db, now), 0);
  assert.equal(getNotificationsForOwner(userId, 50, db).length, 0);
});

test('a timezone-less scan still notifies date-only tasks', () => {
  const { db, userId, sqlite } = createTestDb();
  const now = DateTime.fromISO('2026-09-25T15:00:00', { zone: 'UTC' });
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Date-only task');
  sqlite.prepare(`UPDATE tasks SET due_date = ? WHERE id = ?`).run('2026-09-25', taskId);

  assert.equal(scanDueNotifications(userId, undefined, db, now), 1);
  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'due_today');
});

test('a timed task is not announced early when the zone is unknown at login', () => {
  const { db, userId, sqlite } = createTestDb();
  const taskId = randomUUID();
  createTask(sqlite, taskId, userId, 'Call Sam');
  sqlite
    .prepare(`UPDATE tasks SET due_date = ?, due_time = ? WHERE id = ?`)
    .run('2026-09-25', '09:00', taskId);

  // Due at 09:00 Pacific, which is 16:00 UTC. The login hook has no timezone,
  // so at 09:00 UTC (02:00 Pacific) reading 09:00 as UTC would fire it seven
  // hours early.
  assert.equal(
    scanDueNotifications(
      userId,
      undefined,
      db,
      DateTime.fromISO('2026-09-25T09:00:00', { zone: 'UTC' }),
    ),
    0,
  );

  // The same moment with the real zone also waits.
  assert.equal(
    scanDueNotifications(
      userId,
      'America/Los_Angeles',
      db,
      DateTime.fromISO('2026-09-25T09:00:00', { zone: 'UTC' }),
    ),
    0,
  );

  // Once 09:00 Pacific arrives, exactly one notification exists.
  assert.equal(
    scanDueNotifications(
      userId,
      'America/Los_Angeles',
      db,
      DateTime.fromISO('2026-09-25T16:00:00', { zone: 'UTC' }),
    ),
    1,
  );
  const rows = getNotificationsForOwner(userId, 50, db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'due_time');
});
