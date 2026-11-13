import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createDbClient } from './client.js';

type SqliteDatabase = import('better-sqlite3').Database;

function seedUser(db: SqliteDatabase, id: string): void {
  db.prepare(
    `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)`,
  ).run(id, `User ${id}`, `${id}@example.com`, Date.now(), Date.now());
}

function insertSource(db: SqliteDatabase, id: string, userId: string, urlHash: string): void {
  db.prepare(
    `INSERT INTO calendar_sources
       (id, user_id, name, url_ciphertext, url_hash, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    'Work',
    'v1.cipher',
    urlHash,
    'teal',
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00Z',
  );
}

function insertEvent(
  db: SqliteDatabase,
  id: string,
  sourceId: string,
  userId: string,
  uid: string,
  recurrenceId: string,
): void {
  db.prepare(
    `INSERT INTO calendar_events
       (id, source_id, user_id, uid, recurrence_id, summary, start_at, end_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    sourceId,
    userId,
    uid,
    recurrenceId,
    'Standup',
    '2026-03-02T14:00:00.000Z',
    '2026-03-02T14:30:00.000Z',
    '2026-01-01T00:00:00Z',
  );
}

function columnNames(db: SqliteDatabase, table: string): string[] {
  return (db.prepare(`PRAGMA table_info('${table}')`).all() as Array<{ name: string }>).map(
    (column) => column.name,
  );
}

test('a fresh bootstrap creates the calendar tables', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    const tables = (
      sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{
        name: string;
      }>
    ).map((row) => row.name);
    assert.ok(tables.includes('calendar_sources'));
    assert.ok(tables.includes('calendar_events'));

    assert.deepEqual(columnNames(sqlite, 'calendar_sources'), [
      'id',
      'user_id',
      'name',
      'url_ciphertext',
      'url_hash',
      'color',
      'enabled',
      'etag',
      'last_modified',
      'last_fetched_at',
      'last_success_at',
      'last_error',
      'next_attempt_at',
      'failure_count',
      'created_at',
      'updated_at',
    ]);

    assert.deepEqual(columnNames(sqlite, 'calendar_events'), [
      'id',
      'source_id',
      'user_id',
      'uid',
      'recurrence_id',
      'summary',
      'description',
      'location',
      'start_at',
      'end_at',
      'all_day',
      'start_date',
      'end_date',
      'timezone',
      'floating',
      'status',
      'updated_at',
    ]);
  } finally {
    sqlite.close();
  }
});

test('recurrence_id is NOT NULL with an empty-string default', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    const columns = sqlite.prepare(`PRAGMA table_info('calendar_events')`).all() as Array<{
      name: string;
      notnull: number;
      dflt_value: string | null;
    }>;
    const recurrenceId = columns.find((column) => column.name === 'recurrence_id');
    assert.ok(recurrenceId);
    assert.equal(recurrenceId.notnull, 1, 'recurrence_id may never be NULL');
    assert.equal(recurrenceId.dflt_value, "''", 'the default is the empty string');
  } finally {
    sqlite.close();
  }
});

test('the event uniqueness index rejects a duplicate instance', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    seedUser(sqlite, 'u1');
    insertSource(sqlite, 's1', 'u1', 'hash-1');

    insertEvent(sqlite, 'e1', 's1', 'u1', 'uid-1', '');

    assert.throws(
      () => insertEvent(sqlite, 'e2', 's1', 'u1', 'uid-1', ''),
      /UNIQUE constraint failed/,
      'the same master event cannot be stored twice',
    );

    insertEvent(sqlite, 'e3', 's1', 'u1', 'uid-1', '2026-03-02T14:00:00.000Z');
    assert.throws(
      () => insertEvent(sqlite, 'e4', 's1', 'u1', 'uid-1', '2026-03-02T14:00:00.000Z'),
      /UNIQUE constraint failed/,
      'the same instance cannot be stored twice',
    );
  } finally {
    sqlite.close();
  }
});

test('the source uniqueness index is scoped to the owner', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    seedUser(sqlite, 'u1');
    seedUser(sqlite, 'u2');
    insertSource(sqlite, 's1', 'u1', 'same-hash');

    assert.throws(
      () => insertSource(sqlite, 's2', 'u1', 'same-hash'),
      /UNIQUE constraint failed/,
      'one user cannot add the same URL twice',
    );

    insertSource(sqlite, 's3', 'u2', 'same-hash');
    const count = sqlite
      .prepare(`SELECT COUNT(*) AS n FROM calendar_sources WHERE url_hash = 'same-hash'`)
      .get() as { n: number };
    assert.equal(count.n, 2, 'another user may add the same URL');
  } finally {
    sqlite.close();
  }
});

test('deleting a source deletes its events', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    seedUser(sqlite, 'u1');
    insertSource(sqlite, 's1', 'u1', 'hash-1');
    insertEvent(sqlite, 'e1', 's1', 'u1', 'uid-1', '');

    sqlite.prepare(`DELETE FROM calendar_sources WHERE id = ?`).run('s1');

    const count = sqlite
      .prepare(`SELECT COUNT(*) AS n FROM calendar_events WHERE source_id = ?`)
      .get('s1') as { n: number };
    assert.equal(count.n, 0);
  } finally {
    sqlite.close();
  }
});

test('deleting a user deletes their sources and events', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    seedUser(sqlite, 'u1');
    insertSource(sqlite, 's1', 'u1', 'hash-1');
    insertEvent(sqlite, 'e1', 's1', 'u1', 'uid-1', '');

    sqlite.prepare(`DELETE FROM user WHERE id = ?`).run('u1');

    const sources = sqlite.prepare(`SELECT COUNT(*) AS n FROM calendar_sources`).get() as {
      n: number;
    };
    const events = sqlite.prepare(`SELECT COUNT(*) AS n FROM calendar_events`).get() as {
      n: number;
    };
    assert.equal(sources.n, 0);
    assert.equal(events.n, 0);
  } finally {
    sqlite.close();
  }
});

test('the window query index exists on the instant columns', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    const indexes = (
      sqlite
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'calendar_events'`,
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    assert.ok(indexes.includes('idx_calendar_events_user_start_end'));
    assert.ok(indexes.includes('idx_calendar_events_source'));
    assert.ok(indexes.includes('idx_calendar_events_source_uid_recurrence'));
  } finally {
    sqlite.close();
  }
});

test('a second bootstrap over the same file is a no-op', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    seedUser(sqlite, 'u1');
    insertSource(sqlite, 's1', 'u1', 'hash-1');
    insertEvent(sqlite, 'e1', 's1', 'u1', 'uid-1', '');
  } finally {
    sqlite.close();
  }

  const { sqlite: reopened } = createDbClient(':memory:');
  try {
    const tables = (
      reopened
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'calendar_%'`)
        .all() as Array<{ name: string }>
    ).map((row) => row.name);
    assert.deepEqual(tables.sort(), ['calendar_events', 'calendar_sources']);
  } finally {
    reopened.close();
  }
});

test('a source id that is not a uuid is still accepted', () => {
  const { sqlite } = createDbClient(':memory:');
  try {
    seedUser(sqlite, 'u1');
    insertSource(sqlite, randomUUID(), 'u1', 'hash-1');
  } finally {
    sqlite.close();
  }
});
