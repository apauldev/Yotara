import { NotificationService } from '../../../core/services/notification.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { StatusService } from '../../../core/services/status.service';

/**
 * The single place that announces a completed task, so the task card, the task
 * modal, and the calendar all give identical feedback. The toast respects the
 * user's action-notification preference; the browser notification self-gates on
 * permission and the desktop-notification preference.
 */
export function notifyTaskCompleted(
  status: StatusService,
  preferences: PreferencesStore,
  notifications: NotificationService,
  title: string,
): void {
  if (preferences.actionNotifications()) {
    status.success('Task completed');
  }
  notifications.showBrowserNotification('Task completed', title);
}
