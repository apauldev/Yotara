import { ApplicationRef, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Notification as AppNotification } from '@yotara/shared';
import { DueTimeSchedulerService } from './due-time-scheduler.service';
import { NotificationService } from './notification.service';
import { TaskService } from './task.service';
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

/** Drain pending microtasks without scheduling a macrotask, so a test can
 * watch a promise continuation that must not touch the real timer. */
async function drainMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await Promise.resolve();
  }
}

describe('DueTimeSchedulerService', () => {
  let service: DueTimeSchedulerService;
  let notifications: WritableSignal<AppNotification[]>;
  let taskVersion: WritableSignal<number>;
  let fetchNotifications: jasmine.Spy;
  let fetchUnreadCount: jasmine.Spy;
  let fetchNextDueAt: jasmine.Spy;
  let showBrowserNotification: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    notifications = signal<AppNotification[]>([]);
    taskVersion = signal(0);
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
        {
          provide: TaskService,
          useValue: { version: taskVersion.asReadonly() },
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

  it('announces an overlapping reminder from another tab only once', async () => {
    notifications.set([dueTimeNotification({ id: 'n1' })]);
    const announce = (
      service as unknown as { announceNewDueTimeNotifications: () => Promise<void> }
    ).announceNewDueTimeNotifications.bind(service);

    // Two tabs race the same unread row; the cross-tab lock lets exactly one
    // claim and announce it.
    await Promise.all([announce(), announce()]);

    expect(showBrowserNotification).toHaveBeenCalledTimes(1);
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

    it('re-arms when a task is created or moved to an earlier time', async () => {
      // A started scheduler with nothing scheduled leaves nothing armed.
      fetchNextDueAt.and.resolveTo(null);
      service.start();
      await flush();

      // A task is created due shortly; the server now reports that instant.
      fetchNextDueAt.and.resolveTo(atIn(30));
      fetchNextDueAt.calls.reset();
      fetchNotifications.calls.reset();
      taskVersion.set(1);
      TestBed.inject(ApplicationRef).tick();
      await flush();

      // The scheduler asked again without waiting for the next poll, and did so
      // through the read-only endpoint rather than another full scan.
      expect(fetchNextDueAt).toHaveBeenCalledTimes(1);
      expect(fetchNotifications).not.toHaveBeenCalled();
      service.stop();
    });

    it('keeps an armed timer when a re-arm lookup fails', async () => {
      fetchNextDueAt.and.resolveTo(atIn(120));
      await service.check();

      const clearSpy = spyOn(globalThis, 'clearTimeout').and.callThrough();

      // The next lookup fails. The armed timer still names the instant the
      // server last confirmed, so it must survive rather than be dropped.
      fetchNextDueAt.and.callFake(() => Promise.reject(new Error('offline')));
      await service.check();

      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('does not arm a timer when a lookup resolves after stop()', async () => {
      let resolveNextDue: (value: string | null) => void = () => {};
      fetchNextDueAt.and.callFake(
        () =>
          new Promise<string | null>((resolve) => {
            resolveNextDue = resolve;
          }),
      );

      const pending = service.check();
      await flush();

      const setSpy = spyOn(globalThis, 'setTimeout').and.callThrough();
      service.stop();

      // The in-flight lookup now resolves, but the stop has superseded it.
      resolveNextDue(atIn(60));
      await drainMicrotasks();
      await pending;

      expect(setSpy).not.toHaveBeenCalled();
    });

    it('ignores a task change once the scheduler has stopped', async () => {
      service.start();
      await flush();
      service.stop();

      fetchNextDueAt.calls.reset();
      taskVersion.set(1);
      TestBed.inject(ApplicationRef).tick();
      await flush();

      expect(fetchNextDueAt).not.toHaveBeenCalled();
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
