import { Injectable, inject } from '@angular/core';
import { DateTime } from 'luxon';
import { NotificationService } from './notification.service';
import { AuthStateService } from './auth-state.service';
import { tryGetUserTimezone } from '../../shared/utils/timezone';

const ANNOUNCED_KEY_PREFIX = 'yotara_due_time_announced_';
const MAX_ANNOUNCED_IDS = 100;
const POLL_INTERVAL_MS = 60_000;

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
    } catch {
      // A failed poll is retried on the next tick; the in-app list stays
      // authoritative either way.
    } finally {
      this.checking = false;
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
