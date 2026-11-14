import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { eq } from 'drizzle-orm';

async function createAuthedApp() {
  const dbFile = join(tmpdir(), `yotara-calendar-test-${randomUUID()}.db`);
  process.env['DATABASE_URL'] = dbFile;
  process.env['BETTER_AUTH_SECRET'] = 'test-secret-with-enough-entropy-1234567890';
  process.env['APP_BASE_URL'] = 'http://localhost:3000';

  const { buildApp } = await import('../server.js');
  const app = await buildApp();

  return {
    app,
    cleanup() {
      return Promise.resolve()
        .then(() => app.close())
        .finally(() => {
          rmSync(dbFile, { force: true });
          delete process.env['DATABASE_URL'];
          delete process.env['BETTER_AUTH_SECRET'];
          delete process.env['APP_BASE_URL'];
        });
    },
  };
}

async function signUpAndGetCookie(email: string) {
  const { auth } = await import('../lib/auth.js');
  const response = await auth.api.signUpEmail({
    body: {
      email,
      password: 'Password123!',
      name: email.split('@')[0],
    },
    asResponse: true,
  });

  assert.equal(response.status, 200);

  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  return cookie;
}

const SECRET_URL = 'https://calendar.google.com/calendar/ical/secret-token/basic.ics';

test('calendar routes require auth', async () => {
  const ctx = await createAuthedApp();

  try {
    const sources = await ctx.app.inject({ method: 'GET', url: '/calendar/sources' });
    assert.equal(sources.statusCode, 401);

    const events = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/events?from=2026-03-01&to=2026-03-31&tz=UTC',
    });
    assert.equal(events.statusCode, 401);

    const create = await ctx.app.inject({
      method: 'POST',
      url: '/calendar/sources',
      payload: { url: SECRET_URL, name: 'Work' },
    });
    assert.equal(create.statusCode, 401);

    // The second test in this file needs the first app fully settled.
    const cookie = await signUpAndGetCookie(`probe-${randomUUID()}@example.com`);
    const authed = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/sources',
      headers: { cookie },
    });
    assert.equal(authed.statusCode, 200);
  } finally {
    await ctx.cleanup();
  }
});

test('calendar events validate the range', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`range-${randomUUID()}@example.com`);

    const missingTo = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/events?from=2026-03-01&tz=UTC',
      headers: { cookie },
    });
    assert.equal(missingTo.statusCode, 400);

    const badFrom = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/events?from=not-a-date&to=2026-03-31&tz=UTC',
      headers: { cookie },
    });
    assert.equal(badFrom.statusCode, 400);

    const tooWide = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/events?from=2026-01-01&to=2027-03-01&tz=UTC',
      headers: { cookie },
    });
    assert.equal(tooWide.statusCode, 400);

    const inverted = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/events?from=2026-03-31&to=2026-03-01&tz=UTC',
      headers: { cookie },
    });
    assert.equal(inverted.statusCode, 200);
    assert.deepEqual(inverted.json(), []);

    const empty = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/events?from=2026-03-01&to=2026-03-31&tz=UTC',
      headers: { cookie },
    });
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(empty.json(), []);
  } finally {
    await ctx.cleanup();
  }
});

test('connecting collects the secret URL and keeps it out of every response', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`create-${randomUUID()}@example.com`);

    const blank = await ctx.app.inject({
      method: 'POST',
      url: '/calendar/sources',
      headers: { cookie },
      payload: { url: '' },
    });
    assert.equal(blank.statusCode, 400);

    const missing = await ctx.app.inject({
      method: 'POST',
      url: '/calendar/sources',
      headers: { cookie },
      payload: {},
    });
    assert.equal(missing.statusCode, 400);

    // The URL points at `localhost` so the SSRF guard rejects it without a
    // network call, and the error must not echo the secret back.
    const refused = await ctx.app.inject({
      method: 'POST',
      url: '/calendar/sources',
      headers: { cookie },
      payload: { url: 'https://localhost:3000/feed.ics', name: 'Broken' },
    });
    assert.equal(refused.statusCode, 422);
    assert.ok(!refused.body.includes('feed.ics'), 'the error must not contain the URL');

    const { db } = await import('../db/client.js');
    const { calendarSources } = await import('../db/schema.js');
    const leftBehind = db.select({ id: calendarSources.id }).from(calendarSources).all();
    assert.equal(leftBehind.length, 0, 'a source that cannot be read is not stored');
  } finally {
    await ctx.cleanup();
  }
});

test('changes to another user\u2019s source are answered 404', async () => {
  const ctx = await createAuthedApp();

  try {
    const firstCookie = await signUpAndGetCookie(`first-${randomUUID()}@example.com`);
    const secondCookie = await signUpAndGetCookie(`second-${randomUUID()}@example.com`);

    const { db } = await import('../db/client.js');
    const { calendarSources } = await import('../db/schema.js');
    const { encryptUrl, hashUrl } = await import('../lib/calendar-encryption.js');
    const { auth } = await import('../lib/auth.js');

    const firstSession = await auth.api.getSession({
      headers: new Headers({ cookie: firstCookie }),
    });
    const firstUserId = firstSession?.user?.id;
    assert.ok(firstUserId);

    const sourceId = randomUUID();
    const now = new Date().toISOString();
    db.insert(calendarSources)
      .values({
        id: sourceId,
        userId: firstUserId,
        name: 'Work',
        urlCiphertext: encryptUrl(SECRET_URL),
        urlHash: hashUrl(SECRET_URL),
        color: 'teal',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const listed = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/sources',
      headers: { cookie: firstCookie },
    });
    assert.equal(listed.statusCode, 200);
    const [listedSource] = listed.json();
    assert.equal(listedSource.host, 'calendar.google.com');
    assert.ok(!listed.body.includes('secret-token'), 'the secret URL must not appear');
    assert.ok(!listed.body.includes(SECRET_URL), 'the full URL must not appear');

    const otherList = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/sources',
      headers: { cookie: secondCookie },
    });
    assert.equal(otherList.statusCode, 200);
    assert.deepEqual(otherList.json(), []);

    const patched = await ctx.app.inject({
      method: 'PATCH',
      url: `/calendar/sources/${sourceId}`,
      headers: { cookie: secondCookie },
      payload: { name: 'Hijacked' },
    });
    assert.equal(patched.statusCode, 404);

    const refreshed = await ctx.app.inject({
      method: 'POST',
      url: `/calendar/sources/${sourceId}/refresh`,
      headers: { cookie: secondCookie },
    });
    assert.equal(refreshed.statusCode, 404);

    const removed = await ctx.app.inject({
      method: 'DELETE',
      url: `/calendar/sources/${sourceId}`,
      headers: { cookie: secondCookie },
    });
    assert.equal(removed.statusCode, 404);

    const renamed = await ctx.app.inject({
      method: 'PATCH',
      url: `/calendar/sources/${sourceId}`,
      headers: { cookie: firstCookie },
      payload: { name: 'Work (renamed)', enabled: false },
    });
    assert.equal(renamed.statusCode, 200);
    assert.equal(renamed.json().name, 'Work (renamed)');
    assert.equal(renamed.json().enabled, false);

    const missingPatch = await ctx.app.inject({
      method: 'PATCH',
      url: `/calendar/sources/${randomUUID()}`,
      headers: { cookie: firstCookie },
      payload: { name: 'Nope' },
    });
    assert.equal(missingPatch.statusCode, 404);

    const secondRow = db
      .select({ name: calendarSources.name })
      .from(calendarSources)
      .where(eq(calendarSources.id, sourceId))
      .all();
    assert.equal(secondRow[0].name, 'Work (renamed)');

    const deleted = await ctx.app.inject({
      method: 'DELETE',
      url: `/calendar/sources/${sourceId}`,
      headers: { cookie: firstCookie },
    });
    assert.equal(deleted.statusCode, 200);
    assert.deepEqual(deleted.json(), { ok: true });

    const deletedAgain = await ctx.app.inject({
      method: 'DELETE',
      url: `/calendar/sources/${sourceId}`,
      headers: { cookie: firstCookie },
    });
    assert.equal(deletedAgain.statusCode, 404);
  } finally {
    await ctx.cleanup();
  }
});

test('events are projected onto the reader\u2019s zone and never carry the URL', async () => {
  const ctx = await createAuthedApp();

  try {
    const cookie = await signUpAndGetCookie(`events-${randomUUID()}@example.com`);
    const { db } = await import('../db/client.js');
    const { calendarEvents, calendarSources } = await import('../db/schema.js');
    const { encryptUrl, hashUrl } = await import('../lib/calendar-encryption.js');
    const { replaceCalendarEventsForSource } =
      await import('../services/calendar-event-service.js');
    const { auth } = await import('../lib/auth.js');

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    const userId = session?.user?.id;
    assert.ok(userId);

    const sourceId = randomUUID();
    const now = new Date().toISOString();
    db.insert(calendarSources)
      .values({
        id: sourceId,
        userId,
        name: 'Work',
        urlCiphertext: encryptUrl(SECRET_URL),
        urlHash: hashUrl(SECRET_URL),
        color: 'teal',
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    replaceCalendarEventsForSource(
      userId,
      sourceId,
      { start: '2026-03-01T00:00:00.000Z', end: '2026-04-01T00:00:00.000Z' },
      [
        {
          uid: 'standup@example.com',
          recurrenceId: '',
          summary: 'Standup',
          description: null,
          location: 'Room 3',
          startAt: '2026-03-02T14:00:00.000Z',
          endAt: '2026-03-02T14:30:00.000Z',
          allDay: false,
          startDate: null,
          endDate: null,
          timezone: 'America/New_York',
          floating: false,
          status: 'CONFIRMED',
        },
      ],
    );

    const response = await ctx.app.inject({
      method: 'GET',
      url: '/calendar/events?from=2026-03-01&to=2026-03-31&tz=America/New_York',
      headers: { cookie },
    });
    assert.equal(response.statusCode, 200);
    const [event] = response.json();
    assert.equal(event.summary, 'Standup');
    assert.equal(event.sourceName, 'Work');
    assert.equal(event.sourceColor, 'teal');
    assert.deepEqual(event.dayKeys, ['2026-03-02']);
    assert.equal(event.startTime, '09:00');
    assert.equal(event.endTime, '09:30');
    assert.ok(!response.body.includes('secret-token'), 'the secret URL must not appear in events');

    const rows = db.select({ id: calendarEvents.id }).from(calendarEvents).all();
    assert.equal(rows.length, 1);
  } finally {
    await ctx.cleanup();
  }
});
