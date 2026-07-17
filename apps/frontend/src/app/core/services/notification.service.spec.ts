import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { PreferencesStore } from './preferences-store.service';
import { environment } from '../../../environments/environment';
import type { Notification } from '@yotara/shared';

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    taskId: 't1',
    type: 'due_today',
    title: 'Task due today',
    body: 'Test task',
    read: false,
    readAt: null,
    createdAt: '2026-07-17T10:00:00.000Z',
  },
  {
    id: 'n2',
    taskId: 't2',
    type: 'overdue',
    title: 'Task overdue',
    body: 'Old task',
    read: true,
    readAt: '2026-07-17T11:00:00.000Z',
    createdAt: '2026-07-16T10:00:00.000Z',
  },
];

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;
  let prefs: PreferencesStore;
  const baseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), NotificationService],
    });

    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
    prefs = TestBed.inject(PreferencesStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetchNotifications populates the signal', async () => {
    const promise = service.fetchNotifications(10);
    const req = httpMock.expectOne(`${baseUrl}/notifications?limit=10`);
    req.flush(mockNotifications);
    await promise;

    expect(service.notifications()).toEqual(mockNotifications);
  });

  it('fetchUnreadCount populates the signal', async () => {
    const promise = service.fetchUnreadCount();
    const req = httpMock.expectOne(`${baseUrl}/notifications/unread-count`);
    req.flush({ count: 3 });
    await promise;

    expect(service.unreadCount()).toBe(3);
  });

  it('clearRead sends DELETE and removes read notifications', async () => {
    service['_notifications'].set([...mockNotifications]);

    const promise = service.clearRead();
    const req = httpMock.expectOne(`${baseUrl}/notifications/read`);
    req.flush({ ok: true });
    await promise;

    expect(service.notifications().length).toBe(1);
    expect(service.notifications()[0].id).toBe('n1');
  });

  it('clearRead does not change unread count', async () => {
    service['_notifications'].set([...mockNotifications]);
    service['_unreadCount'].set(1);

    const promise = service.clearRead();
    const req = httpMock.expectOne(`${baseUrl}/notifications/read`);
    req.flush({ ok: true });
    await promise;

    expect(service.unreadCount()).toBe(1);
  });

  it('markAllAsRead sends PATCH and marks all notifications as read', async () => {
    service['_notifications'].set([...mockNotifications]);
    service['_unreadCount'].set(1);

    const promise = service.markAllAsRead();
    const req = httpMock.expectOne(`${baseUrl}/notifications/read-all`);
    req.flush({ ok: true });
    await promise;

    expect(service.notifications().every((n) => n.read)).toBeTrue();
    expect(service.unreadCount()).toBe(0);
  });

  it('markAsRead sends PATCH and updates the notification and unread count', fakeAsync(() => {
    service['_notifications'].set([...mockNotifications]);
    service['_unreadCount'].set(1);

    service.markAsRead('n1').then(() => {});

    // Flush the PATCH request
    const req = httpMock.expectOne(`${baseUrl}/notifications/n1/read`);
    req.flush({ ...mockNotifications[0], read: true, readAt: '2026-07-17T12:00:00.000Z' });
    tick();

    // flush fetchUnreadCount GET inside markAsRead
    const countReq = httpMock.expectOne(`${baseUrl}/notifications/unread-count`);
    countReq.flush({ count: 0 });
    tick();

    expect(service.notifications()[0].read).toBeTrue();
  }));

  it('requestPermission returns granted when Notification API grants', async () => {
    const original = Notification.requestPermission;
    Notification.requestPermission = () => Promise.resolve('granted' as NotificationPermission);
    try {
      const result = await service.requestPermission();
      expect(result).toBe('granted');
      expect(service.permission()).toBe('granted');
    } finally {
      Notification.requestPermission = original;
    }
  });

  it('requestPermission returns denied when Notification API denies', async () => {
    const original = Notification.requestPermission;
    Notification.requestPermission = () => Promise.resolve('denied' as NotificationPermission);
    try {
      const result = await service.requestPermission();
      expect(result).toBe('denied');
    } finally {
      Notification.requestPermission = original;
    }
  });

  describe('showBrowserNotification', () => {
    it('does nothing when permission is not granted', () => {
      service['_permission'].set('denied');
      expect(() => service.showBrowserNotification('Test', 'Body')).not.toThrow();
    });

    it('does nothing when desktopNotifications preference is false', () => {
      service['_permission'].set('granted');
      prefs.setDesktopNotifications(false);
      expect(() => service.showBrowserNotification('Test', 'Body')).not.toThrow();
    });

    it('creates a Notification when supported, granted, and prefs enabled', () => {
      if (typeof (globalThis as any).Notification === 'undefined') return;

      service['_permission'].set('granted');
      prefs.setDesktopNotifications(true);

      const spy = jasmine.createSpy('Notification');
      const OriginalNotification = (globalThis as any).Notification;
      (globalThis as any).Notification = spy;

      try {
        service.showBrowserNotification('Title', 'Body text');
        expect(spy).toHaveBeenCalledWith('Title', { body: 'Body text', icon: '/logo.svg' });
      } finally {
        (globalThis as any).Notification = OriginalNotification;
      }
    });
  });
});
