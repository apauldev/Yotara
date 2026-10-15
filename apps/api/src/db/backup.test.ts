import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { createDbClient } from './client.js';
import { spawnNode, waitForExit, waitForLine } from './test-child-helpers.js';

/**
 * A script-friendly alternative to the sqlite3 CLI `.backup` command:
 * better-sqlite3 exposes the same SQLite Online Backup API. The snapshot must
 * be taken through that API (or a checkpointed copy), because in WAL mode the
 * newest committed rows can live only in the -wal file -- copying just the
 * .db file would silently drop them.
 */

const WRITER_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]);
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  const txns = Number(process.argv[2]);
  const insert = db.prepare("INSERT INTO backup_events (worker) VALUES ('writer')");
  db.exec('BEGIN IMMEDIATE');
  insert.run();
  db.exec('COMMIT');
  console.log('STARTED');
  for (let i = 1; i < txns; i += 1) {
    db.exec('BEGIN IMMEDIATE');
    insert.run();
    db.exec('COMMIT');
  }
`;

function countEvents(sqlite: Database.Database): number {
  const { n } = sqlite.prepare('SELECT COUNT(*) AS n FROM backup_events').get() as { n: number };
  return n;
}

test(
  'an online backup taken while another process writes is a valid, complete snapshot',
  { timeout: 30_000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'yotara-backup-'));
    const dbFile = join(dir, 'test.db');
    const backupFile = join(dir, 'snapshot.db');
    const { sqlite } = createDbClient(dbFile);
    sqlite.exec(`CREATE TABLE backup_events (
      id INTEGER PRIMARY KEY,
      worker TEXT NOT NULL
    )`);

    const seed = sqlite.prepare(`INSERT INTO backup_events (worker) VALUES ('seed')`);
    const seedRows = 10;
    for (let i = 0; i < seedRows; i += 1) seed.run();

    const writerTxns = 800;
    const { child, stdout } = spawnNode(WRITER_SCRIPT, [dbFile, String(writerTxns)]);
    const exitPromise = waitForExit(child);

    try {
      // The writer has committed its first transaction and is mid-loop. From
      // here on, every row it commits must be captured by (or come after) the
      // snapshot, which is taken without checkpointing the WAL first.
      await waitForLine(child, stdout, 'STARTED');
      const rowsBeforeBackup = countEvents(sqlite);

      await sqlite.backup(backupFile);
      const rowsWhenBackupFinished = countEvents(sqlite);

      const writer = await exitPromise;
      assert.equal(writer.code, 0, writer.stderr);

      // The writer kept committing while the online backup ran.
      assert.ok(
        rowsWhenBackupFinished > rowsBeforeBackup,
        `writer made no progress during the backup (${rowsBeforeBackup} -> ${rowsWhenBackupFinished})`,
      );

      const rowsAfterWrites = countEvents(sqlite);
      assert.equal(
        rowsAfterWrites,
        seedRows + writerTxns,
        'every committed transaction must survive the backup',
      );

      const snapshot = new Database(backupFile);
      try {
        assert.equal(snapshot.pragma('integrity_check', { simple: true }), 'ok');
        const rowsInSnapshot = countEvents(snapshot);
        assert.ok(
          rowsInSnapshot >= rowsBeforeBackup,
          `snapshot is missing committed rows (${rowsInSnapshot} < ${rowsBeforeBackup})`,
        );
        assert.ok(rowsInSnapshot <= rowsAfterWrites);
      } finally {
        snapshot.close();
      }
    } finally {
      child.kill();
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
