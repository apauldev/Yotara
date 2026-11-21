/**
 * Shared email syntax helpers.
 *
 * The pattern is intentionally the same one Zod v4 uses for `z.email()`
 * (the validator Better Auth applies server-side). Keeping one copy here means
 * the login/forgot-password forms cannot accept an address that signup later
 * rejects with a 400.
 */
const EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+-]+\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

/** Whether `value` is a syntactically valid email address. */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

/**
 * Canonical form used as the key for rate limits, validation caches, and
 * account lookups. Email addresses are case-insensitive, and the server
 * lowercases them before storing, so every consumer must use this same form.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
