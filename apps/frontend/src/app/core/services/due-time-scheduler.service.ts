import { Injectable, inject } from '@angular/core';
import { DateTime } from 'luxon';
import { NotificationService } from './notification.service';
import { AuthStateService } from './auth-state.service';
import { tryGetUserTimezone } from '../../shared/utils/timezone';

const ANNOUNCED_KEY_PREFIX = 'yotara_due_time_announced_';
const MAX_ANNOUNCED_IDS = 100;
/**
 * How often the list and unread count are refreshed while the site is open.
 * Reminders do not rely on this cadence: when the next due instant falls inside
 * it, a one-shot timer wakes the scheduler at that moment instead, so a task due
 * at 10:03 is still announced at 10:03 rather than at the next tick.
 */
const POLL_INTERVAL_MS = 300_000;

/**
 * Announces due-time notifications while the site is open: checks on start,
 * polls while the tab is visible, and re-checks on focus. Each notification
 * is announced at most once per browser, tracked per user in localStorage,
 * and rows from earlier days never pop up retroactively.
 */
@Injectable({ providedIn: 'root' })
export class DueTimeSchedulerService {
  private readonly notificationService = inject(NotificationService);
  private readonly authState = inject(AuthStateService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private dueTimer: ReturnType<typeof setTimeout> | null = null;
  private checking = false;

  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void this.check();
    }
  };

  private readonly onWindowFocus = () => {
    void this.check();
  };

  start(): void {
    if (this.timer !== null) return;

    void this.check();
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void this.check();
      }
    }, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    globalThis.addEventListener('focus', this.onWindowFocus);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.clearDueTimer();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    globalThis.removeEventListener('focus', this.onWindowFocus);
  }

  async check(): Promise<void> {
    if (this.checking) return;
    this.checking = true;

    try {
      await this.notificationService.fetchNotifications();
      await this.notificationService.fetchUnreadCount();
      this.announceNewDueTimeNotifications();
      await this.scheduleNextDueCheck();
    } catch {
      // A failed poll is retried on the next tick; the in-app list stays
      // authoritative either way.
    } finally {
      this.checking = false;
    }
  }

  /**
   * Ask the server when the next timed task becomes due and wake up for it. The
   * server owns the instants, so this only needs the zone to read the instant in
   * the user's local time. Nothing is scheduled without a zone or when the next
   * instant is beyond this poll interval: the interval will come into range on
   * its own and schedule it then.
   */
  private async scheduleNextDueCheck(): Promise<void> {
    this.clearDueTimer();

    const zone = tryGetUserTimezone();
    if (!zone) return;

    const at = await this.notificationService.fetchNextDueAt();
    if (!at) return;

    const dueAt = DateTime.fromISO(at).setZone(zone);
    if (!dueAt.isValid) return;

    const delayMs = dueAt.diffNow('milliseconds').milliseconds;
    if (!Number.isFinite(delayMs) || delayMs <= 0 || delayMs > POLL_INTERVAL_MS) return;

    if (this.dueTimer !== null) return;
    this.dueTimer = setTimeout(() => {
      this.dueTimer = null;
      void this.check();
    }, delayMs);
  }

  private clearDueTimer(): void {
    if (this.dueTimer !== null) {
      clearTimeout(this.dueTimer);
      this.dueTimer = null;
    }
  }

  private announceNewDueTimeNotifications(): void {
    const rows = this.notificationService.notifications();
    const announced = this.readAnnouncedIds();
    let changed = false;

    for (const row of rows) {
      if (row.type !== 'due_time' || row.read) continue;
      if (announced.has(row.id) || !this.isFromToday(row.createdAt)) continue;

      this.notificationService.showBrowserNotification(row.title, row.body ?? '');
      announced.add(row.id);
      changed = true;
    }

    if (changed) {
      this.writeAnnouncedIds(announced);
    }
  }

  private isFromToday(createdAtIso: string): boolean {
    const zone = tryGetUserTimezone();
    // Without a zone there is no reliable "today", so nothing is announced
    // rather than guessed at.
    if (!zone) return false;

    const created = DateTime.fromISO(createdAtIso, { zone: 'utc' }).setZone(zone);
    const now = DateTime.now().setZone(zone);

    return created.isValid && created.hasSame(now, 'day');
  }

  private storageKey(): string {
    return `${ANNOUNCED_KEY_PREFIX}${this.authState.user()?.id ?? 'anonymous'}`;
  }

  private readAnnouncedIds(): Set<string> {
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey());
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return new Set();

      return new Set(parsed.filter((value): value is string => typeof value === 'string'));
    } catch {
      return new Set();
    }
  }

  private writeAnnouncedIds(ids: Set<string>): void {
    try {
      const values = Array.from(ids).slice(-MAX_ANNOUNCED_IDS);
      globalThis.localStorage?.setItem(this.storageKey(), JSON.stringify(values));
    } catch {
      // Storage can be unavailable (private mode); announcements then repeat
      // at most once per session.
    }
  }
}
