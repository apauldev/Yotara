import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Notification as AppNotification } from '@yotara/shared';
import { DueTimeSchedulerService } from './due-time-scheduler.service';
import { NotificationService } from './notification.service';
import { AuthStateService } from './auth-state.service';

function dueTimeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    taskId: 't1',
    type: 'due_time',
    title: 'Task due now',
    body: 'Call Sam',
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
}

describe('DueTimeSchedulerService', () => {
  let service: DueTimeSchedulerService;
  let notifications: WritableSignal<AppNotification[]>;
  let fetchNotifications: jasmine.Spy;
  let fetchUnreadCount: jasmine.Spy;
  let showBrowserNotification: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    notifications = signal<AppNotification[]>([]);
    fetchNotifications = jasmine.createSpy('fetchNotifications').and.resolveTo(undefined);
    fetchUnreadCount = jasmine.createSpy('fetchUnreadCount').and.resolveTo(undefined);
    showBrowserNotification = jasmine.createSpy('showBrowserNotification');

    TestBed.configureTestingModule({
      providers: [
        DueTimeSchedulerService,
        {
          provide: NotificationService,
          useValue: {
            notifications,
            fetchNotifications,
            fetchUnreadCount,
            showBrowserNotification,
          },
        },
        { provide: AuthStateService, useValue: { user: signal({ id: 'user-1' }) } },
      ],
    });

    service = TestBed.inject(DueTimeSchedulerService);
  });

  afterEach(() => {
    service.stop();
  });

  it('announces an unread due_time notification from today exactly once', async () => {
    notifications.set([dueTimeNotification()]);

    await service.check();

    expect(showBrowserNotification).toHaveBeenCalledWith('Task due now', 'Call Sam');

    await service.check();
    expect(showBrowserNotification).toHaveBeenCalledTimes(1);
  });

  it('skips read rows, other types, and rows from earlier days', async () => {
    notifications.set([
      dueTimeNotification({ id: 'read', read: true, readAt: '2026-09-25T10:00:00.000Z' }),
      dueTimeNotification({ id: 'other-type', type: 'due_today' }),
      dueTimeNotification({ id: 'old', createdAt: '2020-01-01T10:00:00.000Z' }),
    ]);

    await service.check();

    expect(showBrowserNotification).not.toHaveBeenCalled();
  });

  it('does not re-announce ids recorded for the current user', async () => {
    localStorage.setItem('yotara_due_time_announced_user-1', JSON.stringify(['n1']));
    notifications.set([dueTimeNotification()]);

    await service.check();

    expect(showBrowserNotification).not.toHaveBeenCalled();
  });

  it('does not announce anything when the browser has no timezone', async () => {
    spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').and.returnValue(
      {} as Intl.ResolvedDateTimeFormatOptions,
    );
    notifications.set([dueTimeNotification()]);

    await service.check();

    expect(showBrowserNotification).not.toHaveBeenCalled();
  });

  it('checks on focus and on becoming visible, and stops listening after stop()', async () => {
    service.start();
    await flush();

    const initial = fetchNotifications.calls.count();
    expect(initial).toBe(1);

    window.dispatchEvent(new Event('focus'));
    await flush();
    expect(fetchNotifications.calls.count()).toBe(initial + 1);

    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(fetchNotifications.calls.count()).toBe(initial + 2);

    service.stop();
    window.dispatchEvent(new Event('focus'));
    await flush();
    expect(fetchNotifications.calls.count()).toBe(initial + 2);
  });
});
