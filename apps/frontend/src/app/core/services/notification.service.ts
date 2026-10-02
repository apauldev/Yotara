import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Notification as AppNotification } from '@yotara/shared';
import { PreferencesStore } from './preferences-store.service';
import { tryGetUserTimezone } from '../../shared/utils/timezone';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private prefs = inject(PreferencesStore);
  private baseUrl = environment.apiBaseUrl;

  private readonly _notifications = signal<AppNotification[]>([]);
  private readonly _unreadCount = signal(0);
  private readonly _permission = signal<NotificationPermission>(
    typeof globalThis.Notification !== 'undefined' ? globalThis.Notification.permission : 'default',
  );

  private readonly _timezoneUnavailable = signal(false);

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly permission = this._permission.asReadonly();
  readonly isSupported = typeof globalThis.Notification !== 'undefined';
  /**
   * True while the browser cannot resolve a timezone, which is when the
   * server holds back time-based reminders and the UI says so.
   */
  readonly timezoneUnavailable = this._timezoneUnavailable.asReadonly();

  /**
   * The zone every notification call must carry, or null when the browser
   * cannot resolve one. An unresolvable zone is never guessed as UTC: the
   * parameter is omitted so the server skips time-dependent reminders rather
   * than judging them against the wrong clock, and the state is recorded so
   * the UI can explain the gap.
   */
  private dueZone(): string | null {
    const zone = tryGetUserTimezone();
    this._timezoneUnavailable.set(zone === null);
    return zone;
  }

  async fetchNotifications(limit = 50): Promise<void> {
    // The server evaluates due-state in the user's timezone, so every
    // notification call must carry it when the browser knows one.
    const zone = this.dueZone();
    const result = await firstValueFrom(
      this.http.get<AppNotification[]>(`${this.baseUrl}/notifications`, {
        params: zone ? { limit: String(limit), tz: zone } : { limit: String(limit) },
        withCredentials: true,
      }),
    );
    this._notifications.set(result);
  }

  async fetchUnreadCount(): Promise<void> {
    const zone = this.dueZone();
    const result = await firstValueFrom(
      this.http.get<{ count: number }>(`${this.baseUrl}/notifications/unread-count`, {
        params: zone ? { tz: zone } : {},
        withCredentials: true,
      }),
    );
    this._unreadCount.set(result.count);
  }

  /**
   * When the next timed task becomes due, so the scheduler can wake up for that
   * moment instead of waiting for its next tick. Read-only: this endpoint does
   * not materialize notifications.
   */
  async fetchNextDueAt(): Promise<string | null> {
    const zone = this.dueZone();
    const result = await firstValueFrom(
      this.http.get<{ at: string | null }>(`${this.baseUrl}/notifications/next-due`, {
        params: zone ? { tz: zone } : {},
        withCredentials: true,
      }),
    );
    return result.at ?? null;
  }

  async markAsRead(id: string): Promise<void> {
    await firstValueFrom(
      this.http.patch<AppNotification>(`${this.baseUrl}/notifications/${id}/read`, null, {
        withCredentials: true,
      }),
    );
    await this.fetchUnreadCount();
    const current = this._notifications();
    this._notifications.set(
      current.map((n) =>
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
      ),
    );
  }

  async markAllAsRead(): Promise<void> {
    await firstValueFrom(
      this.http.patch<{ ok: boolean }>(`${this.baseUrl}/notifications/read-all`, null, {
        withCredentials: true,
      }),
    );
    this._notifications.set(
      this._notifications().map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })),
    );
    this._unreadCount.set(0);
  }

  async clearRead(): Promise<void> {
    await firstValueFrom(
      this.http.delete<{ ok: boolean }>(`${this.baseUrl}/notifications/read`, {
        withCredentials: true,
      }),
    );
    this._notifications.set(this._notifications().filter((n) => !n.read));
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) return 'denied';
    const result = await globalThis.Notification.requestPermission();
    this._permission.set(result);
    return result;
  }

  showBrowserNotification(title: string, body: string): void {
    if (!this.isSupported) return;
    if (this._permission() !== 'granted') return;
    if (!this.prefs.desktopNotifications()) return;
    new globalThis.Notification(title, { body, icon: '/logo.svg' });
  }
}
