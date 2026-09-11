# Yotara Website

The static marketing site at [yotara.website](https://yotara.website).

Plain HTML, CSS, and JavaScript — no framework, no build step, and no package
manifest. Open a page in a browser, or serve the directory, and it works.

## Pages

| File | Path |
|:---|:---|
| `index.html` | `/` — landing page |
| `features.html` | `/features` |
| `install.html` | `/install` — install instructions for the public site |
| `blog.html` | `/blog` — index, rendered from `data/blog.json` |
| `privacy/index.html` | `/privacy` |
| `404.html` | Not-found page |

## Content

- `data/blog.json` — every blog post, as an array of `{date, title, image, author, excerpt, content}`. Post images live in `assets/blog/`. Adding a post means adding an entry here; `blog.html` needs no changes.
- `js/blog.js` — renders the blog index and individual posts from that JSON
- `js/scripts.js` — shared page behaviour
- `css/` — styles
- `assets/` — images, fonts, and the logo

## Deployment

Hosted on Cloudflare Pages, which reads two conventions from this directory:

- `_headers` — response headers applied to every route (nosniff, DENY framing, strict-origin-when-cross-origin referrer policy)
- `functions/api/stars.js` — a Pages Function serving `GET /api/stars`, which proxies the GitHub star count with a one-hour in-memory cache. It uses an optional `GITHUB_TOKEN` environment variable; without it, the unauthenticated GitHub rate limit applies server-side.

`robots.txt` and `sitemap.xml` are served as-is. Update `sitemap.xml` when adding a page.

## Release version badge

The footer badge and the `softwareVersion` JSON-LD value in `index.html` are
written by [`scripts/sync-website-version.mjs`](../../scripts/sync-website-version.mjs).
That script runs automatically during releases via the `postbump` hook in
[`.versionrc.json`](../../.versionrc.json), so the footer tracks the monorepo
version without manual edits.

Do not hand-edit the version badge — it will be overwritten at the next release.

## Local preview

Any static server works:

```bash
cd apps/yotara-website
python3 -m http.server 8080
# Then open http://localhost:8080
```

The `/api/stars` function only runs on Cloudflare Pages, so the star count will
not resolve locally. That is expected.

There is no test suite for this app; the CI pipeline ignores it.
