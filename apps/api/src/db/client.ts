import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const DEFAULT_DATABASE_URL = './data/yotara.db';

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

export function createDbClient(databaseUrl = process.env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL) {
  const databasePath = resolveDbPath(databaseUrl);
  ensureDatabasePath(databasePath);

  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');


  const db = drizzle(sqlite, { schema });
  return { db, sqlite, databasePath };
}

export const { db, sqlite, databasePath } = createDbClient();
