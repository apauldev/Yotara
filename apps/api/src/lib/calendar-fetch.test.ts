import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CalendarFetchError,
  assertFetchableCalendarUrl,
  fetchCalendarFeed,
  isBlockedAddress,
  normalizeCalendarFeedUrl,
  resolveCalendarTargets,
  type CalendarFetchTarget,
} from './calendar-fetch.js';

const servers: Server[] = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});

/**
 * Start a local server and return its origin plus a resolver that points a
 * chosen hostname at it.
 *
 * The guard refuses loopback addresses, so exercising the transport end to end
 * needs a seam. The seam only replaces the *resolution* of one hostname —
 * every other host, including a redirect target, still goes through the real
 * policy.
 */
async function startLocalServer(
  handler: Parameters<typeof createServer>[1],
): Promise<{ origin: string; port: number }> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;
  return { origin: `http://127.0.0.1:${address.port}`, port: address.port };
}

/**
 * Resolve only the test hostname to the local server.
 *
 * Every other host — including a redirect target — goes through the real
 * policy, so a redirect to a private address is still refused.
 */
function resolveTestHost(hostname: string): Promise<CalendarFetchTarget[]> {
  if (hostname === 'feed.example.test') {
    return Promise.resolve([{ address: '127.0.0.1', family: 4 }]);
  }
  return resolveCalendarTargets(hostname);
}

describe('isBlockedAddress', () => {
  it('blocks the loopback range', () => {
    assert.equal(isBlockedAddress('127.0.0.1'), true);
    assert.equal(isBlockedAddress('127.255.255.254'), true);
    assert.equal(isBlockedAddress('::1'), true);
  });

  it('blocks the private IPv4 ranges', () => {
    assert.equal(isBlockedAddress('10.0.0.1'), true);
    assert.equal(isBlockedAddress('172.16.0.1'), true);
    assert.equal(isBlockedAddress('172.31.255.255'), true);
    assert.equal(isBlockedAddress('192.168.1.1'), true);
  });

  it('does not block the public neighbours of the private ranges', () => {
    assert.equal(isBlockedAddress('172.15.0.1'), false);
    assert.equal(isBlockedAddress('172.32.0.1'), false);
    assert.equal(isBlockedAddress('9.255.255.255'), false);
    assert.equal(isBlockedAddress('11.0.0.1'), false);
  });

  it('blocks the link-local range, including the cloud metadata address', () => {
    assert.equal(isBlockedAddress('169.254.169.254'), true);
    assert.equal(isBlockedAddress('169.254.0.1'), true);
    assert.equal(isBlockedAddress('fe80::1'), true);
  });

  it('blocks the carrier-grade NAT range used by some metadata services', () => {
    assert.equal(isBlockedAddress('100.100.100.200'), true);
    assert.equal(isBlockedAddress('100.127.255.255'), true);
  });

  it('blocks the private IPv6 ranges', () => {
    assert.equal(isBlockedAddress('fc00::1'), true);
    assert.equal(isBlockedAddress('fd00:ec2::254'), true);
    assert.equal(isBlockedAddress('fdff::1'), true);
  });

  it('blocks an IPv4 address hidden inside an IPv6 one', () => {
    assert.equal(isBlockedAddress('::ffff:127.0.0.1'), true);
    assert.equal(isBlockedAddress('::ffff:169.254.169.254'), true);
    assert.equal(isBlockedAddress('::ffff:10.0.0.1'), true);
    assert.equal(isBlockedAddress('::ffff:8.8.8.8'), false);
  });

  it('blocks an IPv4 address hidden inside a 6to4 or NAT64 address', () => {
    assert.equal(isBlockedAddress('2002:7f00:0001::'), true);
    assert.equal(isBlockedAddress('64:ff9b::7f00:1'), true);
  });

  it('blocks the unspecified, multicast, and reserved ranges', () => {
    assert.equal(isBlockedAddress('0.0.0.0'), true);
    assert.equal(isBlockedAddress('::'), true);
    assert.equal(isBlockedAddress('224.0.0.1'), true);
    assert.equal(isBlockedAddress('255.255.255.255'), true);
    assert.equal(isBlockedAddress('240.0.0.1'), true);
  });

  it('allows ordinary public addresses', () => {
    assert.equal(isBlockedAddress('8.8.8.8'), false);
    assert.equal(isBlockedAddress('1.1.1.1'), false);
    assert.equal(isBlockedAddress('2606:4700:4700::1111'), false);
  });

  it('blocks anything it cannot parse', () => {
    assert.equal(isBlockedAddress('not-an-address'), true);
    assert.equal(isBlockedAddress(''), true);
  });
});

describe('assertFetchableCalendarUrl', () => {
  it('accepts an https URL', () => {
    assert.equal(assertFetchableCalendarUrl('https://example.com/a.ics').hostname, 'example.com');
  });

  it('refuses http by default', () => {
    assert.throws(
      () => assertFetchableCalendarUrl('http://example.com/a.ics'),
      (error: unknown) =>
        error instanceof CalendarFetchError && error.reason === 'scheme-not-allowed',
    );
  });

  it('accepts http behind the explicit opt-in', () => {
    assert.equal(assertFetchableCalendarUrl('http://example.com/a.ics', true).protocol, 'http:');
  });

  it('refuses a non-HTTP scheme', () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com/a.ics', 'gopher://example.com']) {
      assert.throws(
        () => assertFetchableCalendarUrl(url),
        (error: unknown) =>
          error instanceof CalendarFetchError && error.reason === 'scheme-not-allowed',
      );
    }
  });

  it('refuses credentials in the URL', () => {
    assert.throws(
      () => assertFetchableCalendarUrl('https://user:pass@example.com/a.ics'),
      (error: unknown) =>
        error instanceof CalendarFetchError && error.reason === 'credentials-in-url',
    );
  });

  it('refuses a value that is not a URL', () => {
    assert.throws(
      () => assertFetchableCalendarUrl('not a url'),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'invalid-url',
    );
  });
});

describe('normalizeCalendarFeedUrl', () => {
  it('converts webcal links to HTTPS and trims surrounding whitespace', () => {
    assert.equal(
      normalizeCalendarFeedUrl('  WEBCAL://calendar.example.com/private/feed.ics  '),
      'https://calendar.example.com/private/feed.ics',
    );
  });

  it('leaves other URL schemes unchanged for normal validation', () => {
    assert.equal(
      normalizeCalendarFeedUrl('https://calendar.example.com/feed.ics'),
      'https://calendar.example.com/feed.ics',
    );
    assert.equal(
      normalizeCalendarFeedUrl('http://calendar.example.com/feed.ics'),
      'http://calendar.example.com/feed.ics',
    );
  });
});

describe('fetchCalendarFeed — the guard', () => {
  it('refuses to fetch a loopback address', async () => {
    await assert.rejects(
      fetchCalendarFeed('https://127.0.0.1/a.ics'),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'blocked-address',
    );
  });

  it('refuses to fetch the cloud metadata address', async () => {
    await assert.rejects(
      fetchCalendarFeed('https://169.254.169.254/latest/meta-data/'),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'blocked-address',
    );
  });

  it('refuses a host that resolves to a private address', async () => {
    await assert.rejects(
      fetchCalendarFeed('https://localhost/a.ics'),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'blocked-address',
    );
  });

  it('refuses http even when the host would be reachable', async () => {
    await assert.rejects(
      fetchCalendarFeed('http://example.com/a.ics'),
      (error: unknown) =>
        error instanceof CalendarFetchError && error.reason === 'scheme-not-allowed',
    );
  });

  it('refuses http pointing at a private address even with the opt-in', async () => {
    await assert.rejects(
      fetchCalendarFeed('http://127.0.0.1/a.ics', { allowInsecureUrls: true }),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'blocked-address',
    );
  });

  it('refuses a redirect that points at a private host', async () => {
    const { port } = await startLocalServer((_request, response) => {
      response.writeHead(302, { Location: `http://localhost:${port}/private.ics` });
      response.end();
    });

    await assert.rejects(
      fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
        allowInsecureUrls: true,
        resolveHost: resolveTestHost,
      }),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'blocked-address',
    );
  });

  it('refuses a redirect that points at a literal private address', async () => {
    const { port } = await startLocalServer((_request, response) => {
      response.writeHead(301, { Location: `http://127.0.0.1:${port}/private.ics` });
      response.end();
    });

    await assert.rejects(
      fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
        allowInsecureUrls: true,
        resolveHost: resolveTestHost,
      }),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'blocked-address',
    );
  });

  it('refuses a redirect chain that ends at a private address', async () => {
    const { port } = await startLocalServer((_request, response) => {
      response.writeHead(302, { Location: `http://127.0.0.1:${port}/again.ics` });
      response.end();
    });

    await assert.rejects(
      fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
        allowInsecureUrls: true,
        resolveHost: resolveTestHost,
      }),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'blocked-address',
    );
  });
});

describe('fetchCalendarFeed — the transport', () => {
  it('bounds DNS resolution by the request deadline', async () => {
    const startedAt = Date.now();

    await assert.rejects(
      fetchCalendarFeed('https://feed.example.test/a.ics', {
        timeoutMs: 30,
        resolveHost: () => new Promise<CalendarFetchTarget[]>(() => {}),
      }),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'timeout',
    );

    assert.ok(Date.now() - startedAt < 500, 'the stalled DNS lookup should not hold the fetch');
  });

  it('returns the body and the validators', async () => {
    const { port } = await startLocalServer((_request, response) => {
      response.writeHead(200, {
        'Content-Type': 'text/calendar',
        ETag: '"abc123"',
        'Last-Modified': 'Wed, 11 Nov 2026 09:00:00 GMT',
      });
      response.end('BEGIN:VCALENDAR\nEND:VCALENDAR\n');
    });

    const result = await fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
      allowInsecureUrls: true,
      resolveHost: resolveTestHost,
    });

    assert.equal(result.notModified, false);
    assert.equal(result.status, 200);
    assert.ok(result.body.startsWith('BEGIN:VCALENDAR'));
    assert.equal(result.etag, '"abc123"');
    assert.equal(result.lastModified, 'Wed, 11 Nov 2026 09:00:00 GMT');
  });

  it('treats 304 as a success and leaves the body empty', async () => {
    const { port } = await startLocalServer((_request, response) => {
      response.writeHead(304, { ETag: '"abc123"' });
      response.end();
    });

    const result = await fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
      allowInsecureUrls: true,
      resolveHost: resolveTestHost,
      etag: '"abc123"',
    });

    assert.equal(result.notModified, true);
    assert.equal(result.status, 304);
    assert.equal(result.body, '');
    assert.equal(result.etag, '"abc123"');
  });

  it('sends the conditional headers', async () => {
    let seen: Record<string, string | string[] | undefined> = {};
    const { port } = await startLocalServer((request, response) => {
      seen = request.headers;
      response.writeHead(200);
      response.end('ok');
    });

    await fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
      allowInsecureUrls: true,
      resolveHost: resolveTestHost,
      etag: '"abc123"',
      lastModified: 'Wed, 11 Nov 2026 09:00:00 GMT',
    });

    assert.equal(seen['if-none-match'], '"abc123"');
    assert.equal(seen['if-modified-since'], 'Wed, 11 Nov 2026 09:00:00 GMT');
  });

  it('sends no cookies and no authorization header', async () => {
    let seen: Record<string, string | string[] | undefined> = {};
    const { port } = await startLocalServer((request, response) => {
      seen = request.headers;
      response.writeHead(200);
      response.end('ok');
    });

    await fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
      allowInsecureUrls: true,
      resolveHost: resolveTestHost,
    });

    assert.equal(seen['cookie'], undefined);
    assert.equal(seen['authorization'], undefined);
    assert.ok(seen['user-agent']);
  });

  it('refuses a body over the size cap', async () => {
    const { port } = await startLocalServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/calendar' });
      response.end('x'.repeat(5_000));
    });

    await assert.rejects(
      fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
        allowInsecureUrls: true,
        resolveHost: resolveTestHost,
        maxBytes: 1_000,
      }),
      (error: unknown) =>
        error instanceof CalendarFetchError && error.reason === 'response-too-large',
    );
  });

  it('refuses a body whose declared length is over the cap', async () => {
    const { port } = await startLocalServer((_request, response) => {
      response.writeHead(200, { 'Content-Length': '999999' });
      response.end('x'.repeat(10));
    });

    await assert.rejects(
      fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
        allowInsecureUrls: true,
        resolveHost: resolveTestHost,
        maxBytes: 1_000,
      }),
      (error: unknown) =>
        error instanceof CalendarFetchError && error.reason === 'response-too-large',
    );
  });

  it('gives up when the server does not answer in time', async () => {
    const { port } = await startLocalServer(() => {
      // Never answer.
    });

    await assert.rejects(
      fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
        allowInsecureUrls: true,
        resolveHost: resolveTestHost,
        timeoutMs: 250,
      }),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'timeout',
    );
  });

  it('reports an HTTP failure', async () => {
    const { port } = await startLocalServer((_request, response) => {
      response.writeHead(500);
      response.end('nope');
    });

    await assert.rejects(
      fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
        allowInsecureUrls: true,
        resolveHost: resolveTestHost,
      }),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'http-error',
    );
  });

  it('follows a redirect that stays on an allowed host', async () => {
    const { port } = await startLocalServer((request, response) => {
      if (request.url === '/a.ics') {
        response.writeHead(302, { Location: `http://feed.example.test:${port}/final.ics` });
        response.end();
        return;
      }
      response.writeHead(200);
      response.end('final');
    });

    const result = await fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
      allowInsecureUrls: true,
      resolveHost: resolveTestHost,
    });

    assert.equal(result.body, 'final');
  });

  it('stops after the redirect limit', async () => {
    let hops = 0;
    const { port } = await startLocalServer((request, response) => {
      hops += 1;
      response.writeHead(302, {
        Location: `http://feed.example.test:${port}/hop-${hops}.ics`,
      });
      response.end();
    });

    await assert.rejects(
      fetchCalendarFeed(`http://feed.example.test:${port}/a.ics`, {
        allowInsecureUrls: true,
        resolveHost: resolveTestHost,
        maxRedirects: 2,
      }),
      (error: unknown) =>
        error instanceof CalendarFetchError && error.reason === 'too-many-redirects',
    );
  });
});

describe('resolveCalendarTargets', () => {
  it('refuses a host that resolves to a private address', async () => {
    await assert.rejects(
      resolveCalendarTargets('localhost'),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'blocked-address',
    );
  });

  it('reports a host it cannot resolve', async () => {
    await assert.rejects(
      resolveCalendarTargets('this-host-does-not-exist.invalid'),
      (error: unknown) => error instanceof CalendarFetchError && error.reason === 'dns-failure',
    );
  });
});
