import { isLocalDevMode } from './dev-mode.js';

/**
 * In-memory store for password-reset URLs generated during dev mode.
 *
 * The `sendResetPassword` callback in auth.ts captures the URL here so the
 * frontend can retrieve it via the dev-only `/api/dev/reset-link` endpoint
 * instead of forcing the developer to dig through server logs.
 *
 * Entries are consumed on read (single-use) and expire after 10 minutes to
 * prevent stale links from lingering.
 */

interface StoredLink {
  url: string;
  expiresAt: number;
}

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const store = new Map<string, StoredLink>();

export function storeResetLink(email: string, url: string): void {
  if (!isLocalDevMode()) {
    return;
  }

  const key = email.toLowerCase();
  store.set(key, { url, expiresAt: Date.now() + EXPIRY_MS });
}

/** Retrieve and consume a stored reset link. Returns `null` if missing or expired. */
export function consumeResetLink(email: string): string | null {
  if (!isLocalDevMode()) {
    return null;
  }

  const key = email.toLowerCase();
  const entry = store.get(key);
  if (!entry) {
    return null;
  }
  store.delete(key);
  if (Date.now() > entry.expiresAt) {
    return null;
  }
  return entry.url;
}
