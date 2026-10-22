/**
 * Stable key for case/whitespace-insensitive label uniqueness.
 *
 * NFKC composes canonically equivalent forms (for example, `É` and `E` plus a
 * combining accent), then lowercasing handles Unicode case variants. SQLite's
 * built-in lower() is ASCII-only, so this must be computed in application code.
 */
export function labelNameKey(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}
