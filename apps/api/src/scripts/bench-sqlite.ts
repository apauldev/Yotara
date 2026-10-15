import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDbClient } from '../db/client.js';

/**
 * Opt-in SQLite write-throughput benchmark. Not part of CI or `pnpm test`.
 *
 * Reuses the app's own client (`createDbClient`), so the pragmas under
 * measurement (WAL, busy_timeout = 5000, synchronous = NORMAL) are exactly
 * what the API ships. Reports:
 *
 *   1. single-connection immediate-transaction throughput with
 *      synchronous = NORMAL (shipped default) vs synchronous = FULL;
 *   2. aggregate throughput when several processes write to one file
 *      (the busy_timeout contention path). Workers wait for a `go` signal on
 *      stdin so process startup is not counted.
 *
 * Usage: pnpm --filter @yotara/api bench:sqlite [-- --txns=20000 --multi=20000 --workers=4]
 * Results are machine-specific; treat them as relative, not absolute.
 */

type BenchOptions = { txns: number; multi: number; workers: number };

const options: BenchOptions = { txns: 20000, multi: 20000, workers: 4 };

const print = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

for (const arg of process.argv.slice(2)) {
  const match = /^--(txns|multi|workers)=(\d+)$/.exec(arg);
  const key = match?.[1];
  const value = match?.[2];
  if (key !== 'txns' && key !== 'multi' && key !== 'workers') {
    print(`unknown argument: ${arg}`);
    print('usage: tsx src/scripts/bench-sqlite.ts [--txns=N] [--multi=N] [--workers=N]');
    process.exit(1);
  }
  options[key] = Number(value);
}

const dir = mkdtempSync(join(tmpdir(), 'yotara-bench-'));
const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fmt = (value: number): string => formatter.format(value);

const CREATE_BENCH_TABLE = `CREATE TABLE bench (
  id INTEGER PRIMARY KEY,
  payload TEXT
)`;

function benchSingle(label: string, synchronous: 'NORMAL' | 'FULL', txns: number) {
  const { sqlite } = createDbClient(join(dir, `${label}.db`));
  sqlite.exec(CREATE_BENCH_TABLE);
  sqlite.pragma(`synchronous = ${synchronous}`);

  const insert = sqlite.prepare(`INSERT INTO bench (payload) VALUES ('x')`);
  const run = (count: number): number => {
    const started = process.hrtime.bigint();
    for (let i = 0; i < count; i += 1) {
      sqlite.exec('BEGIN IMMEDIATE');
      insert.run();
      sqlite.exec('COMMIT');
    }
    return Number(process.hrtime.bigint() - started) / 1e6;
  };

  run(Math.min(500, Math.floor(txns / 10))); // warm-up, not measured
  const elapsedMs = run(txns);
  sqlite.close();

  return { elapsedMs, writesPerSecond: (txns / elapsedMs) * 1000 };
}

const WORKER_SCRIPT = `
  const Database = require('better-sqlite3');
  const db = new Database(process.argv[1]);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  const txns = Number(process.argv[2]);
  const insert = db.prepare("INSERT INTO bench (payload) VALUES ('x')");
  console.log('READY');
  process.stdin.once('data', () => {
    for (let i = 0; i < txns; i += 1) {
      db.exec('BEGIN IMMEDIATE');
      insert.run();
      db.exec('COMMIT');
    }
    process.exit(0);
  });
`;

type Worker = { start: () => void; done: Promise<void> };

function startWorker(file: string, txns: number): Promise<Worker> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', WORKER_SCRIPT, file, String(txns)], {
      // The apps/api package root, so the child can require('better-sqlite3').
      cwd: new URL('../../', import.meta.url),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    let ready = false;
    let finish: (error?: Error) => void = () => undefined;

    const done = new Promise<void>((resolvePromise, rejectPromise) => {
      finish = (error) => {
        if (error) {
          rejectPromise(error);
        } else {
          resolvePromise();
        }
      };
    });

    const fail = (message: string): void => {
      const error = new Error(`${message}${stderr ? `:\n${stderr}` : ''}`);
      // Errors after READY belong to the worker's result; errors before it
      // mean the worker never became usable, so settle the outer promise.
      if (ready) {
        finish(error);
      } else {
        reject(error);
      }
    };

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => fail(`worker failed to spawn: ${error.message}`));
    child.once('exit', (code) => {
      if (code === 0 && ready) {
        finish();
        return;
      }
      fail(
        code === 0 ? 'worker exited before signaling readiness' : `worker exited with code ${code}`,
      );
    });

    child.stdout?.on('data', (chunk: Buffer) => {
      if (!ready && chunk.toString().includes('READY')) {
        ready = true;
        resolve({ start: () => child.stdin?.write('go\n'), done });
      }
    });
  });
}

async function benchMulti(file: string, txns: number, workerCount: number) {
  const { sqlite } = createDbClient(file);
  sqlite.exec(CREATE_BENCH_TABLE);
  sqlite.close();

  const writesPerWorker = Math.ceil(txns / workerCount);
  const workers = await Promise.all(
    Array.from({ length: workerCount }, () => startWorker(file, writesPerWorker)),
  );

  const started = process.hrtime.bigint();
  for (const worker of workers) {
    worker.start();
  }
  await Promise.all(workers.map((worker) => worker.done));
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  const totalWrites = writesPerWorker * workerCount;
  const { sqlite: check } = createDbClient(file);
  const { n } = check.prepare('SELECT COUNT(*) AS n FROM bench').get() as { n: number };
  check.close();

  return { elapsedMs, totalWrites, rowCount: n };
}

async function main(): Promise<void> {
  print(
    `SQLite write benchmark (${fmt(options.txns)} / ${fmt(options.multi)} immediate transactions)`,
  );
  print('');

  try {
    const normal = benchSingle('normal', 'NORMAL', options.txns);
    const full = benchSingle('full', 'FULL', options.txns);

    print('Single connection (createDbClient pragmas):');
    print(
      `  synchronous = NORMAL : ${fmt(normal.writesPerSecond)} writes/s (${fmt(normal.elapsedMs)} ms)`,
    );
    print(
      `  synchronous = FULL   : ${fmt(full.writesPerSecond)} writes/s (${fmt(full.elapsedMs)} ms)`,
    );
    print('');

    const multi = await benchMulti(join(dir, 'multi.db'), options.multi, options.workers);
    if (multi.rowCount !== multi.totalWrites) {
      throw new Error(
        `lost writes under contention: ${multi.rowCount} rows for ${multi.totalWrites} transactions`,
      );
    }

    print(`Multi-process contention (${options.workers} workers, busy_timeout = 5000 ms):`);
    print(
      `  ${fmt(multi.totalWrites)} writes in ${fmt(multi.elapsedMs)} ms -> ${fmt((multi.totalWrites / multi.elapsedMs) * 1000)} writes/s aggregate, 0 lost`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await main();
