import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { eq } from 'drizzle-orm';

const dbFile = join(tmpdir(), `yotara-calendar-source-service-${randomUUID()}.db`);
const calendarSecret = randomUUID() + randomUUID();
process.env['DATABASE_URL'] = dbFile;
process.env['CALENDAR_ENCRYPTION_KEY'] = calendarSecret;

const { db, sqlite } = await import('../db/client.js');
const { calendarSources, users } = await import('../db/schema.js');
const { decryptUrl, hashUrl } = await import('../lib/calendar-encryption.js');
const { ConflictError } = await import('../lib/app-error.js');
const { createCalendarSourceForOwner } = await import('./calendar-source-service.js');

after(() => {
  sqlite.close();
  rmSync(dbFile, { force: true });
  delete process.env['DATABASE_URL'];
  delete process.env['CALENDAR_ENCRYPTION_KEY'];
});

test('connecting with a webcal URL normalizes and stores the HTTPS feed URL', async () => {
  const ownerId = randomUUID();
  await db.insert(users).values({
    id: ownerId,
    name: 'Test User',
    email: `${ownerId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const webcalUrl = 'webcal://calendar.example.test/private/feed.ics';
  const httpsUrl = 'https://calendar.example.test/private/feed.ics';
  const fetchedUrls: string[] = [];
  const source = await createCalendarSourceForOwner(
    ownerId,
    { url: webcalUrl, name: 'Work', color: 'teal' },
    {
      fetchFeed: async (url) => {
        fetchedUrls.push(url);
        return {
          body: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n',
          notModified: false,
          status: 200,
          etag: null,
          lastModified: null,
        };
      },
    },
  );

  assert.deepEqual(fetchedUrls, [httpsUrl]);
  assert.equal(source.host, 'calendar.example.test');

  const stored = db.select().from(calendarSources).where(eq(calendarSources.id, source.id)).get();
  assert.ok(stored);
  assert.equal(decryptUrl(stored.urlCiphertext), httpsUrl);
  assert.equal(stored.urlHash, hashUrl(httpsUrl));

  await assert.rejects(
    createCalendarSourceForOwner(
      ownerId,
      { url: httpsUrl },
      { fetchFeed: async () => assert.fail() },
    ),
    ConflictError,
    'the normalized URL should participate in duplicate detection',
  );

  assert.equal(
    db.select({ id: calendarSources.id }).from(calendarSources).all().length,
    1,
    'a second source should not be stored for the same HTTPS feed',
  );
});
