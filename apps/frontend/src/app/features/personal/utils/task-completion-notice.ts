import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { StatusService } from '../../../core/services/status.service';

/**
 * The single place that announces a completed task, so the task card, the task
 * modal, and the calendar all give identical feedback. It raises the in-app
 * toast only (gated by the action-notification preference) — completing a task
 * deliberately does not pop an OS/browser notification, which is jarring.
 * Due-time reminders still use browser notifications separately.
 */
export function notifyTaskCompleted(status: StatusService, preferences: PreferencesStore): void {
  if (preferences.actionNotifications()) {
    status.success('Task completed');
  }
}
