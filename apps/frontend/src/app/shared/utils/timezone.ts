/**
 * Get the current user's local timezone.
 * Falls back to UTC if the timezone cannot be resolved.
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
