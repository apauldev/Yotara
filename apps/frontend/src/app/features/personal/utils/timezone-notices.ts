/**
 * Copy for the surfaces that depend on the browser's timezone. One place so the
 * capture bar, the task modal, and the notification surfaces all say the same
 * thing when the zone cannot be resolved and timed reminders are held back.
 */

/** Shown where reminders are listed rather than edited. */
export const TIMED_REMINDERS_UNAVAILABLE =
  'Timezone not detected — timed reminders are paused until your browser reports one.';

/** Shown where a due time is being set, naming the time that was picked up. */
export function timedTaskTimezoneNotice(timeLabel?: string | null): string {
  return timeLabel
    ? `Couldn't detect your timezone — the ${timeLabel} reminder may not arrive on time.`
    : "Couldn't detect your timezone — this task's time reminder may not arrive on time.";
}
