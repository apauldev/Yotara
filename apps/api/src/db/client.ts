import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

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
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );
`;

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
