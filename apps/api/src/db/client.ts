import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema.js';
import { labelNameKey } from '../lib/label-name.js';
import { nowIsoTimestamp, toIsoTimestamp } from '../lib/timestamps.js';

const DEFAULT_DATABASE_URL = './data/yotara.db';
const SQLITE_BOOTSTRAP_SQL = `
  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    emailVerified INTEGER NOT NULL,
    passwordSetupRequired INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    workspaceMode TEXT,
    onboardingCompleted INTEGER NOT NULL DEFAULT 0,
    archiveAutoDelete INTEGER NOT NULL DEFAULT 1,
    captureBehavior TEXT NOT NULL DEFAULT 'quick',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user (email);

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    token TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE NO ACTION
  );

  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userIdToken TEXT,
    userRefreshToken TEXT,
    accessToken TEXT,
    refreshToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    idToken TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES user(id) ON DELETE NO ACTION
  );

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY NOT NULL,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    retired_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES user(id) ON DELETE NO ACTION
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'inbox',
    priority TEXT NOT NULL DEFAULT 'medium',
    completed INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    due_time TEXT,
    simple_mode INTEGER NOT NULL DEFAULT 0,
    project_id TEXT,
    parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    recurrence_rule TEXT,
    base_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    deleted_at TEXT,
    archived_at TEXT,
    permanent_archive INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    name_norm TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'tag',
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS task_labels (
    task_id TEXT NOT NULL,
    label_id TEXT NOT NULL,
    PRIMARY KEY (task_id, label_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT NOT NULL,
    email TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    last_attempt_at INTEGER NOT NULL,
    PRIMARY KEY (ip, email)
  );

  CREATE TABLE IF NOT EXISTS email_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('signup', 'reset', 'verify')),
    ip TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_email_sends_email ON email_sends(email);
  CREATE INDEX IF NOT EXISTS idx_email_sends_created ON email_sends(created_at);

  CREATE TABLE IF NOT EXISTS blocked_ips (
    ip TEXT PRIMARY KEY NOT NULL,
    blocked_until INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

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

  CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
    ON notifications(user_id, read, created_at);

  CREATE INDEX IF NOT EXISTS idx_notifications_task_type_created
    ON notifications(task_id, type, created_at);
`;

function normalizeTextTimestamp(value: unknown, fallback: string): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === '') {
    return fallback;
  }

  try {
    return toIsoTimestamp(raw as string | number | Date);
  } catch {
    return fallback;
  }
}

function normalizeNullableTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === '') {
    return null;
  }

  try {
    return toIsoTimestamp(raw as string | number | Date);
  } catch {
    return null;
  }
}

function normalizeAppTimestampStorage(sqlite: Database.Database): void {
  const fallbackNow = nowIsoTimestamp();

  const projectRows = sqlite
    .prepare(`SELECT id, created_at, updated_at FROM projects`)
    .all() as Array<{ id: string; created_at: unknown; updated_at: unknown }>;
  const updateProject = sqlite.prepare(
    `UPDATE projects SET created_at = ?, updated_at = ? WHERE id = ?`,
  );
  for (const row of projectRows) {
    const createdAt = normalizeTextTimestamp(row.created_at, fallbackNow);
    const updatedAt = normalizeTextTimestamp(row.updated_at, fallbackNow);

    if (row.created_at === createdAt && row.updated_at === updatedAt) {
      continue;
    }

    updateProject.run(createdAt, updatedAt, row.id);
  }

  const taskRows = sqlite
    .prepare(`SELECT id, created_at, updated_at, archived_at, deleted_at, completed FROM tasks`)
    .all() as Array<{
    id: string;
    created_at: unknown;
    updated_at: unknown;
    archived_at: unknown;
    deleted_at: unknown;
    completed: number;
  }>;
  const updateTask = sqlite.prepare(
    `UPDATE tasks SET created_at = ?, updated_at = ?, archived_at = ?, deleted_at = ? WHERE id = ?`,
  );
  for (const row of taskRows) {
    const updatedAt = normalizeTextTimestamp(row.updated_at, fallbackNow);
    const createdAt = normalizeTextTimestamp(row.created_at, fallbackNow);
    const archivedAt =
      row.archived_at === null ||
      row.archived_at === undefined ||
      String(row.archived_at).trim() === ''
        ? row.completed === 1
          ? updatedAt
          : null
        : normalizeNullableTimestamp(row.archived_at);
    const deletedAt = normalizeNullableTimestamp(row.deleted_at);

    if (
      row.created_at === createdAt &&
      row.updated_at === updatedAt &&
      row.archived_at === archivedAt &&
      row.deleted_at === deletedAt
    ) {
      continue;
    }

    updateTask.run(createdAt, updatedAt, archivedAt, deletedAt, row.id);
  }

  const labelRows = sqlite.prepare(`SELECT id, created_at, updated_at FROM labels`).all() as Array<{
    id: string;
    created_at: unknown;
    updated_at: unknown;
  }>;
  const updateLabel = sqlite.prepare(
    `UPDATE labels SET created_at = ?, updated_at = ? WHERE id = ?`,
  );
  for (const row of labelRows) {
    const createdAt = normalizeNullableTimestamp(row.created_at);
    const updatedAt = normalizeNullableTimestamp(row.updated_at);
    const nextCreatedAt = createdAt ?? updatedAt ?? fallbackNow;
    const nextUpdatedAt = updatedAt ?? createdAt ?? fallbackNow;

    if (row.created_at === nextCreatedAt && row.updated_at === nextUpdatedAt) {
      continue;
    }

    updateLabel.run(nextCreatedAt, nextUpdatedAt, row.id);
  }
}

function resolveDbPath(databaseUrl: string): string {
  if (databaseUrl === ':memory:') {
    return databaseUrl;
  }

  return resolve(process.cwd(), databaseUrl);
}

function ensureDatabasePath(databasePath: string): void {
  if (databasePath === ':memory:') {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
}

function ensureSqliteSchema(sqlite: Database.Database): void {
  // PRAGMA foreign_keys must be set outside a transaction (SQLite ignores it otherwise)
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec('BEGIN IMMEDIATE');
  try {
    sqlite.exec(SQLITE_BOOTSTRAP_SQL);

    const columns = sqlite.prepare(`PRAGMA table_info('user')`).all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('workspaceMode')) {
      sqlite.exec(`ALTER TABLE user ADD COLUMN workspaceMode TEXT`);
    }

    if (!columnNames.has('onboardingCompleted')) {
      sqlite.exec(`ALTER TABLE user ADD COLUMN onboardingCompleted INTEGER NOT NULL DEFAULT 0`);
    }

    if (!columnNames.has('archiveAutoDelete')) {
      sqlite.exec(`ALTER TABLE user ADD COLUMN archiveAutoDelete INTEGER NOT NULL DEFAULT 1`);
    }

    if (!columnNames.has('captureBehavior')) {
      sqlite.exec(`ALTER TABLE user ADD COLUMN captureBehavior TEXT NOT NULL DEFAULT 'quick'`);
    }

    const taskColumns = sqlite.prepare(`PRAGMA table_info('tasks')`).all() as Array<{
      name: string;
    }>;
    const taskColumnNames = new Set(taskColumns.map((column) => column.name));

    if (!taskColumnNames.has('simple_mode')) {
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN simple_mode INTEGER NOT NULL DEFAULT 0`);
    }

    if (!taskColumnNames.has('deleted_at')) {
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN deleted_at TEXT`);
    }

    if (!taskColumnNames.has('project_id')) {
      sqlite.exec(
        `ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`,
      );
    }

    if (!taskColumnNames.has('due_time')) {
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN due_time TEXT`);
    }

    if (!taskColumnNames.has('archived_at')) {
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN archived_at TEXT`);
    }

    // Backfill archived_at for existing completed tasks if missing
    sqlite.exec(
      `UPDATE tasks SET archived_at = updated_at WHERE completed = 1 AND archived_at IS NULL`,
    );

    if (!taskColumnNames.has('permanent_archive')) {
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN permanent_archive INTEGER NOT NULL DEFAULT 0`);
    }

    if (!taskColumnNames.has('parent_id')) {
      sqlite.exec(
        `ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`,
      );
    }

    if (!taskColumnNames.has('recurrence_rule')) {
      sqlite.exec(`ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT`);
    }

    if (!taskColumnNames.has('base_task_id')) {
      sqlite.exec(
        `ALTER TABLE tasks ADD COLUMN base_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`,
      );
    }

    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_base_task_id ON tasks(base_task_id)`);

    const projectColumns = sqlite.prepare(`PRAGMA table_info('projects')`).all() as Array<{
      name: string;
    }>;
    const projectColumnNames = new Set(projectColumns.map((column) => column.name));
    if (!projectColumnNames.has('description')) {
      sqlite.exec(`ALTER TABLE projects ADD COLUMN description TEXT`);
    }
    if (!projectColumnNames.has('color')) {
      sqlite.exec(`ALTER TABLE projects ADD COLUMN color TEXT`);
    }
    if (!projectColumnNames.has('retired_at')) {
      sqlite.exec(`ALTER TABLE projects ADD COLUMN retired_at TEXT`);
    }

    // Retire the legacy seeded Inbox project rather than deleting it, so its
    // id remains a stable (but hidden) tombstone for stale clients. The seed
    // identity is the exact original name/description pair: legacy rows carry
    // no seed-ownership marker, so an account-created project with that exact
    // pair is indistinguishable and is retired too (accepted limitation).
    // Detaching tasks and marking the project retired run in this schema
    // transaction, so an interruption cannot leave only one half applied.
    sqlite.exec(`
      UPDATE tasks SET project_id = NULL
      WHERE project_id IN (
        SELECT id FROM projects
        WHERE name = 'Inbox'
          AND description = 'Default capture space for incoming tasks.'
          AND retired_at IS NULL
      );
      UPDATE projects
      SET retired_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE name = 'Inbox'
        AND description = 'Default capture space for incoming tasks.'
        AND retired_at IS NULL;
    `);

    const labelColumns = sqlite.prepare(`PRAGMA table_info('labels')`).all() as Array<{
      name: string;
    }>;
    const labelColumnNames = new Set(labelColumns.map((column) => column.name));
    if (labelColumns.length === 0) {
      sqlite.exec(`CREATE TABLE labels (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_norm TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'tag',
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    )`);
    } else {
      if (!labelColumnNames.has('created_at')) {
        sqlite.exec(`ALTER TABLE labels ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`);
      }
      if (!labelColumnNames.has('updated_at')) {
        sqlite.exec(`ALTER TABLE labels ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
      }
      if (!labelColumnNames.has('icon')) {
        sqlite.exec(`ALTER TABLE labels ADD COLUMN icon TEXT NOT NULL DEFAULT 'tag'`);
      }
      if (!labelColumnNames.has('pinned')) {
        sqlite.exec(`ALTER TABLE labels ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
      }
      if (!labelColumnNames.has('name_norm')) {
        sqlite.exec(`ALTER TABLE labels ADD COLUMN name_norm TEXT NOT NULL DEFAULT ''`);
      }
    }

    const joinColumns = sqlite.prepare(`PRAGMA table_info('task_labels')`).all() as Array<{
      name: string;
    }>;
    if (joinColumns.length === 0) {
      sqlite.exec(`CREATE TABLE task_labels (
      task_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      PRIMARY KEY (task_id, label_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
    )`);
    }

    // Label identity hygiene: Unicode case/whitespace-insensitive uniqueness.
    // name_norm is computed in application code (NFKC, lowercase, NFD/NFKC,
    // plus the case-folding overrides in labelNameKey) because SQLite's lower()
    // is ASCII-only. The unique index is rebuilt only when it is missing, does
    // not match the expected full unique (user_id, name_norm) shape (an older
    // expression-based index, a partial index, or a non-unique/wrong-column
    // variant), or the backfill below changes at least one stored key — a
    // normalization change can make previously distinct keys collide, and those
    // updates must not run while the index still enforces the old keys. The
    // dedupe MUST run before recreating the unique index — a database that still
    // contains duplicates would fail index creation. Per label group keyed by
    // (user_id, name_norm) with more than one row:
    //   1. pick the canonical label (earliest non-empty created_at, then lowest id)
    //   2. re-point task_labels rows to the canonical label (INSERT OR IGNORE
    //      dedupes against the join table's (task_id, label_id) primary key)
    //   3. delete join rows that still point at duplicates
    //   4. delete the duplicate label rows
    // Tasks are never deleted. Idempotent: once every stored key matches the
    // current normalizer and the index has the expected shape, the pre-check
    // finds nothing and nothing runs.
    const uniqueIndexEntry = (
      sqlite.prepare(`PRAGMA index_list('labels')`).all() as Array<{
        name: string;
        unique: number;
        partial: number;
      }>
    ).find((row) => row.name === 'idx_labels_user_name_unique');
    const uniqueIndexColumns =
      uniqueIndexEntry === undefined
        ? []
        : (
            sqlite.prepare(`PRAGMA index_info('idx_labels_user_name_unique')`).all() as Array<{
              name: string | null;
            }>
          ).map((column) => column.name);
    const uniqueIndexCurrent =
      uniqueIndexEntry?.unique === 1 &&
      uniqueIndexEntry.partial === 0 &&
      uniqueIndexColumns.length === 2 &&
      uniqueIndexColumns[0] === 'user_id' &&
      uniqueIndexColumns[1] === 'name_norm';

    const labelRows = sqlite.prepare(`SELECT id, name, name_norm FROM labels`).all() as Array<{
      id: string;
      name: string;
      name_norm: string | null;
    }>;
    const staleLabelRows = labelRows.filter((row) => labelNameKey(row.name) !== row.name_norm);

    if (staleLabelRows.length > 0 || !uniqueIndexCurrent) {
      sqlite.exec(`DROP INDEX IF EXISTS idx_labels_user_name_unique`);
    }
    const updateLabelNameNorm = sqlite.prepare(`UPDATE labels SET name_norm = ? WHERE id = ?`);
    for (const row of staleLabelRows) {
      updateLabelNameNorm.run(labelNameKey(row.name), row.id);
    }

    const duplicateLabelGroups = sqlite
      .prepare(
        `SELECT COUNT(*) AS groups
         FROM (
           SELECT COUNT(*) AS rows
           FROM labels
           GROUP BY user_id, name_norm
           HAVING COUNT(*) > 1
         )`,
      )
      .get() as { groups: number };
    if (duplicateLabelGroups.groups > 0) {
      const repointJoins = sqlite
        .prepare(
          `WITH ranked AS (
             SELECT id, user_id, name_norm,
                    ROW_NUMBER() OVER (
                      PARTITION BY user_id, name_norm
                      ORDER BY
                        CASE WHEN created_at IS NULL OR trim(created_at) = '' THEN 1 ELSE 0 END,
                        created_at, id
                    ) AS rn
             FROM labels
           )
           INSERT OR IGNORE INTO task_labels (task_id, label_id)
           SELECT tl.task_id, c.id
           FROM task_labels tl
           JOIN ranked d ON tl.label_id = d.id AND d.rn > 1
           JOIN ranked c
             ON c.user_id = d.user_id AND c.name_norm = d.name_norm AND c.rn = 1
           WHERE tl.label_id <> c.id`,
        )
        .run();

      sqlite
        .prepare(
          `DELETE FROM task_labels
           WHERE label_id IN (
             SELECT id FROM (
               SELECT id, ROW_NUMBER() OVER (
                        PARTITION BY user_id, name_norm
                        ORDER BY
                          CASE WHEN created_at IS NULL OR trim(created_at) = '' THEN 1 ELSE 0 END,
                          created_at, id
                      ) AS rn
               FROM labels
             ) WHERE rn > 1
           )`,
        )
        .run();

      const removedLabels = sqlite
        .prepare(
          `DELETE FROM labels
           WHERE id IN (
             SELECT id FROM (
               SELECT id, ROW_NUMBER() OVER (
                        PARTITION BY user_id, name_norm
                        ORDER BY
                          CASE WHEN created_at IS NULL OR trim(created_at) = '' THEN 1 ELSE 0 END,
                          created_at, id
                      ) AS rn
               FROM labels
             ) WHERE rn > 1
           )`,
        )
        .run();

      console.log(
        `[schema] merged duplicate labels: ${duplicateLabelGroups.groups} groups ` +
          `(${removedLabels.changes} labels deleted, ${repointJoins.changes} task ` +
          `associations re-pointed)`,
      );
    }

    // Created AFTER dedupe on purpose (see above). The normalized key is stored
    // directly, so new writes are constrained even for non-ASCII case pairs.
    // Skipped when the index is already current and nothing needed rewriting.
    if (staleLabelRows.length > 0 || !uniqueIndexCurrent) {
      sqlite.exec(
        `CREATE UNIQUE INDEX idx_labels_user_name_unique
         ON labels(user_id, name_norm)`,
      );
    }
    // Counts and label filters scan task_labels by label_id.
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_task_labels_label_id ON task_labels(label_id)`);

    // Migrate login_attempts to a composite (ip, email) primary key. The old shape
    // keyed only by email, which allowed a single attacker to lock any victim's
    // account. The table holds only transient failed-login counters, so dropping
    // and recreating it on upgrade is safe.
    const loginAttemptColumns = sqlite
      .prepare(`PRAGMA table_info('login_attempts')`)
      .all() as Array<{
      name: string;
    }>;
    const isNewShape = loginAttemptColumns.some((column) => column.name === 'ip');
    if (loginAttemptColumns.length > 0 && !isNewShape) {
      sqlite.exec(`DROP TABLE login_attempts`);
    }
    if (loginAttemptColumns.length === 0 || !isNewShape) {
      sqlite.exec(`CREATE TABLE login_attempts (
      ip TEXT NOT NULL,
      email TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER,
      last_attempt_at INTEGER NOT NULL,
      PRIMARY KEY (ip, email)
    )`);
    }

    const userColumns = sqlite.prepare(`PRAGMA table_info('user')`).all() as Array<{
      name: string;
    }>;
    if (!userColumns.some((column) => column.name === 'passwordSetupRequired')) {
      sqlite.exec(`ALTER TABLE user ADD COLUMN passwordSetupRequired INTEGER NOT NULL DEFAULT 0`);
    }

    // 3g. Add ip column to email_sends for IP-based per-email rate limiting
    const emailSendCols = sqlite.prepare(`PRAGMA table_info('email_sends')`).all() as Array<{
      name: string;
    }>;
    if (!emailSendCols.some((c) => c.name === 'ip')) {
      sqlite.exec(`ALTER TABLE email_sends ADD COLUMN ip TEXT NOT NULL DEFAULT ''`);
    }
    // Create the index after the column exists (safe for fresh and migrated DBs)
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_email_sends_ip ON email_sends(ip)`);

    // The email_sends CHECK only allowed ('signup','reset') before the 'verify'
    // resend type was added. SQLite can't alter a CHECK, so recreate the table
    // when the constraint is outdated. The rows are transient rate-limit data,
    // so dropping and recreating on upgrade is safe (matching the existing
    // login_attempts migration pattern).
    const emailSendCreateSql = sqlite
      .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'email_sends'`)
      .get() as { sql: string } | undefined;
    const hasVerifyType = emailSendCreateSql?.sql?.includes("'verify'") ?? false;
    if (!hasVerifyType) {
      sqlite.exec(`
        ALTER TABLE email_sends RENAME TO email_sends_old;
        CREATE TABLE email_sends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('signup', 'reset', 'verify')),
          ip TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL
        );
        INSERT INTO email_sends (id, email, type, ip, created_at)
          SELECT id, email, type, ip, created_at FROM email_sends_old;
        DROP TABLE email_sends_old;
        CREATE INDEX IF NOT EXISTS idx_email_sends_email ON email_sends(email);
        CREATE INDEX IF NOT EXISTS idx_email_sends_created ON email_sends(created_at);
        CREATE INDEX IF NOT EXISTS idx_email_sends_ip ON email_sends(ip);
      `);
    }

    // blocked_ips is created by the bootstrap SQL; ensure it exists on older DBs.
    sqlite.exec(`CREATE TABLE IF NOT EXISTS blocked_ips (
      ip TEXT PRIMARY KEY NOT NULL,
      blocked_until INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`);

    normalizeAppTimestampStorage(sqlite);
    sqlite.exec('COMMIT');
  } catch (err) {
    sqlite.exec('ROLLBACK');
    throw err;
  }
}

export function createDbClient(databaseUrl = process.env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL) {
  const databasePath = resolveDbPath(databaseUrl);
  ensureDatabasePath(databasePath);

  const sqlite = new Database(databasePath);

  // Queue write transactions for up to 5000ms instead of failing immediately
  // with SQLITE_BUSY when another process (backup, CLI, clustered instance)
  // holds the write lock. Set before the schema bootstrap so it benefits too.
  // (better-sqlite3's constructor default is also 5000ms; this pins the value
  // explicitly so the contract is visible, tested, and independent of it.)
  sqlite.pragma('busy_timeout = 5000');

  // 7a. Tighten permissions on the database file only (avoid chmodding shared dirs)
  if (databasePath !== ':memory:') {
    try {
      chmodSync(databasePath, 0o600);
    } catch {
      // best-effort: don't crash if permissions can't be tightened
    }
  }

  ensureSqliteSchema(sqlite);

  sqlite.pragma('journal_mode = WAL');

  // In WAL mode, synchronous = NORMAL avoids an fsync on every commit while
  // staying safe against application and OS crashes. A power loss can roll
  // back the most recent commits, but never corrupts the database.
  sqlite.pragma('synchronous = NORMAL');

  const db = drizzle(sqlite, { schema });
  return { db, sqlite, databasePath };
}

export const { db, sqlite, databasePath } = createDbClient();

export type Database = BaseSQLiteDatabase<
  'sync',
  import('better-sqlite3').RunResult,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
