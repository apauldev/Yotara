/**
 * GET /api/stars — proxy GitHub star count with server-side caching.
 *
 * Environment:
 *   GITHUB_TOKEN — fine-grained PAT with read-only metadata access (optional;
 *                   without it the unauthenticated rate limit applies server-side,
 *                   which is still better than client-side).
 */

let cached = null;
let cachedAt = 0;
const TTL_MS = 60 * 60 * 1000; // 1 hour

export async function onRequest(context) {
  const { env } = context;

  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=300',
        'x-cache': 'HIT',
      },
    });
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'yotara-website/1.0',
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch('https://api.github.com/repos/apauldev/yotara', { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();

    cached = { stargazers_count: data.stargazers_count };
    cachedAt = now;

    return new Response(JSON.stringify(cached), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=300',
        'x-cache': 'MISS',
      },
    });
  } catch {
    // Return stale cache if available, otherwise 502
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=60',
          'x-cache': 'STALE',
        },
      });
    }
    return new Response(JSON.stringify({ stargazers_count: null }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
