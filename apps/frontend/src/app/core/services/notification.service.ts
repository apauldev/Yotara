import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { Notification } from '@yotara/shared';
import { PreferencesStore } from './preferences-store.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private prefs = inject(PreferencesStore);
  private baseUrl = environment.apiBaseUrl;

  private readonly _notifications = signal<Notification[]>([]);
  private readonly _unreadCount = signal(0);
  private readonly _permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly permission = this._permission.asReadonly();
  readonly isSupported = typeof Notification !== 'undefined';

  async fetchNotifications(limit = 50): Promise<void> {
    const result = await firstValueFrom(
      this.http.get<Notification[]>(`${this.baseUrl}/notifications`, {
        params: { limit: String(limit) },
        withCredentials: true,
      }),
    );
    this._notifications.set(result);
  }

  async fetchUnreadCount(): Promise<void> {
    const result = await firstValueFrom(
      this.http.get<{ count: number }>(`${this.baseUrl}/notifications/unread-count`, {
        withCredentials: true,
      }),
    );
    this._unreadCount.set(result.count);
  }

  async markAsRead(id: string): Promise<void> {
    await firstValueFrom(
      this.http.patch<Notification>(`${this.baseUrl}/notifications/${id}/read`, null, {
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
    const result = await Notification.requestPermission();
    this._permission.set(result);
    return result;
  }

  showBrowserNotification(title: string, body: string): void {
    if (!this.isSupported) return;
    if (this._permission() !== 'granted') return;
    if (!this.prefs.desktopNotifications()) return;
    new Notification(title, { body, icon: '/logo.svg' });
  }
}
