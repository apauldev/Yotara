import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createDbClient, type Database } from '../db/client.js';
import {
  createNotification,
  getNotificationsForOwner,
  getUnreadCountForOwner,
  markNotificationRead,
  clearReadForOwner,
  markAllReadForOwner,
  createDueNotificationIfNeeded,
  scanDueNotifications,
} from './notification-service.js';

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
  assert.equal(first!.readAt, second!.readAt);
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
