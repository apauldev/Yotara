/**
 * The browser's local timezone, or `null` when it cannot be resolved.
 * Callers that hand the zone to the API must use this: sending a made-up
 * zone makes the server judge due times against the wrong clock.
 */
export function tryGetUserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Get the current user's local timezone.
 * Falls back to UTC if the timezone cannot be resolved. Only safe for
 * display formatting, never for timezone-aware server requests.
 */
export function getUserTimezone(): string {
  return tryGetUserTimezone() ?? 'UTC';
}
