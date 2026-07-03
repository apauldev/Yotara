import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const testDbFile = join(tmpdir(), `yotara-test-${randomUUID()}.db`);
process.env['DATABASE_URL'] = testDbFile;

await import('./client.js');

export function cleanupTestDb() {
  delete process.env['DATABASE_URL'];
  rmSync(testDbFile, { force: true });
}
