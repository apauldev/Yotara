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
  let fetchNextDueAt: jasmine.Spy;
  let showBrowserNotification: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    notifications = signal<AppNotification[]>([]);
    fetchNotifications = jasmine.createSpy('fetchNotifications').and.resolveTo(undefined);
    fetchUnreadCount = jasmine.createSpy('fetchUnreadCount').and.resolveTo(undefined);
    fetchNextDueAt = jasmine.createSpy('fetchNextDueAt').and.resolveTo(null);
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
            fetchNextDueAt,
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

  it('polls every five minutes rather than every minute', () => {
    spyOn(globalThis, 'setInterval').and.callThrough();

    service.start();

    expect(setInterval).toHaveBeenCalledWith(jasmine.any(Function), 300_000);
  });

  describe('waking up for the next due instant', () => {
    /** An instant the given number of seconds from now, as the API returns it. */
    function atIn(seconds: number): string {
      return new Date(Date.now() + seconds * 1000).toISOString();
    }

    it('schedules a check for an instant inside the poll interval', async () => {
      // Due shortly, and within the five-minute window.
      fetchNextDueAt.and.resolveTo(atIn(180));
      const spy = spyOn(globalThis, 'setTimeout').and.callThrough();

      await service.check();

      expect(fetchNextDueAt).toHaveBeenCalled();
      const delay = spy.calls.mostRecent().args[1] as number;
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(300_000);
      service.stop();
    });

    it('runs a check when that instant arrives', async () => {
      fetchNextDueAt.and.resolveTo(atIn(0.05));
      await service.check();
      const before = fetchNotifications.calls.count();

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(fetchNotifications.calls.count()).toBeGreaterThan(before);
      service.stop();
    });

    it('does not arm a timer for an instant beyond the poll interval', async () => {
      // Far beyond the window: the interval will come into range on its own.
      fetchNextDueAt.and.resolveTo(atIn(3_600));
      const spy = spyOn(globalThis, 'setTimeout').and.callThrough();

      await service.check();

      expect(spy).not.toHaveBeenCalled();
      service.stop();
    });

    it('does not arm a timer for an instant that already passed', async () => {
      fetchNextDueAt.and.resolveTo(atIn(-30));
      const spy = spyOn(globalThis, 'setTimeout').and.callThrough();

      await service.check();

      expect(spy).not.toHaveBeenCalled();
      service.stop();
    });

    it('does not arm a timer without a browser timezone', async () => {
      spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').and.returnValue(
        {} as Intl.ResolvedDateTimeFormatOptions,
      );
      fetchNextDueAt.and.resolveTo(atIn(60));
      const spy = spyOn(globalThis, 'setTimeout').and.callThrough();

      await service.check();

      expect(fetchNextDueAt).not.toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
      service.stop();
    });

    it('clears the pending timer when the scheduler stops', async () => {
      fetchNextDueAt.and.resolveTo(atIn(120));
      await service.check();
      const spy = spyOn(globalThis, 'clearTimeout').and.callThrough();

      service.stop();

      expect(spy).toHaveBeenCalled();
    });
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
