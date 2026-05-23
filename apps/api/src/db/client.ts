import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { nowIsoTimestamp, toIsoTimestamp } from '../lib/timestamps.js';

const DEFAULT_DATABASE_URL = './data/yotara.db';
const SQLITE_BOOTSTRAP_SQL = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    emailVerified INTEGER NOT NULL,
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
    simple_mode INTEGER NOT NULL DEFAULT 0,
    bucket TEXT DEFAULT 'personal-sanctuary',
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
    color TEXT NOT NULL,
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

  const taskColumns = sqlite.prepare(`PRAGMA table_info('tasks')`).all() as Array<{ name: string }>;
  const taskColumnNames = new Set(taskColumns.map((column) => column.name));

  if (!taskColumnNames.has('simple_mode')) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN simple_mode INTEGER NOT NULL DEFAULT 0`);
  }

  if (!taskColumnNames.has('bucket')) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN bucket TEXT DEFAULT 'personal-sanctuary'`);
  }

  if (!taskColumnNames.has('deleted_at')) {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN deleted_at TEXT`);
  }

  if (!taskColumnNames.has('project_id')) {
    sqlite.exec(
      `ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`,
    );
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

  const labelColumns = sqlite.prepare(`PRAGMA table_info('labels')`).all() as Array<{
    name: string;
  }>;
  const labelColumnNames = new Set(labelColumns.map((column) => column.name));
  if (labelColumns.length === 0) {
    sqlite.exec(`CREATE TABLE labels (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
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

  normalizeAppTimestampStorage(sqlite);
}

export function createDbClient(databaseUrl = process.env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL) {
  const databasePath = resolveDbPath(databaseUrl);
  ensureDatabasePath(databasePath);

  const sqlite = new Database(databasePath);
  ensureSqliteSchema(sqlite);
  sqlite.pragma('journal_mode = WAL');

  const db = drizzle(sqlite, { schema });
  return { db, sqlite, databasePath };
}

export const { db, sqlite, databasePath } = createDbClient();
