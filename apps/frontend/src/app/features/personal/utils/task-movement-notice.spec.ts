import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import type { Task } from '@yotara/shared';
import { DateTime } from 'luxon';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { ProjectService } from '../../../core/services/project.service';
import { StatusService } from '../../../core/services/status.service';
import {
  TaskMovementNoticeService,
  isInboxTask,
  taskCompletionMovementNotice,
  taskMovementNotice,
} from './task-movement-notice';

describe('task movement notice', () => {
  const reference = DateTime.fromISO('2026-10-23T12:00:00');
  const projects = [
    { id: 'project-1', name: 'Work' },
    { id: 'project-2', name: 'Personal' },
  ];

  function task(overrides: Partial<Task> = {}): Task {
    return {
      id: 'task-1',
      title: 'Plan launch',
      status: 'inbox',
      priority: 'medium',
      completed: false,
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-20T09:00:00.000Z',
      order: 0,
      ...overrides,
    };
  }

  describe('isInboxTask', () => {
    it('matches the Inbox query shape', () => {
      expect(isInboxTask(task())).toBeTrue();
      expect(isInboxTask(task({ dueDate: '2026-10-23' }))).toBeFalse();
      expect(isInboxTask(task({ projectId: 'project-1' }))).toBeFalse();
      expect(isInboxTask(task({ completed: true }))).toBeFalse();
      expect(isInboxTask(task({ status: 'today' }))).toBeFalse();
      expect(isInboxTask(task({ parentId: 'parent-1' }))).toBeFalse();
    });
  });

  describe('taskMovementNotice', () => {
    it('names the project when an undated task is filed', () => {
      const notice = taskMovementNotice(
        task(),
        task({ projectId: 'project-1' }),
        projects,
        reference,
      );

      expect(notice?.message).toBe('"Plan launch" moved to Work');
      expect(notice?.route).toEqual({ commands: ['/projects', 'project-1'] });
      expect(notice?.key).toBe('task-movement:task-1');
    });

    it('names Today when an undated task is scheduled for today', () => {
      const notice = taskMovementNotice(
        task(),
        task({ dueDate: '2026-10-23' }),
        projects,
        reference,
      );

      expect(notice?.message).toBe('"Plan launch" moved to Today');
      expect(notice?.route).toEqual({ commands: ['/tasks'], queryParams: { view: 'today' } });
    });

    it('names Upcoming when a task is scheduled ahead', () => {
      const notice = taskMovementNotice(
        task(),
        task({ dueDate: '2026-10-25' }),
        projects,
        reference,
      );

      expect(notice?.message).toBe('"Plan launch" moved to Upcoming');
      expect(notice?.route).toEqual({ commands: ['/tasks'], queryParams: { view: 'upcoming' } });
    });

    it('names Overdue and opens Today for a past date', () => {
      const notice = taskMovementNotice(
        task(),
        task({ dueDate: '2026-10-22' }),
        projects,
        reference,
      );

      expect(notice?.message).toBe('"Plan launch" moved to Overdue');
      expect(notice?.route).toEqual({ commands: ['/tasks'], queryParams: { view: 'today' } });
    });

    it('names both destinations when a save files and schedules the task', () => {
      const notice = taskMovementNotice(
        task(),
        task({ projectId: 'project-1', dueDate: '2026-10-25' }),
        projects,
        reference,
      );

      expect(notice?.message).toBe('"Plan launch" moved to Upcoming (Work)');
      // The scheduled view is the most specific destination for a dated task.
      expect(notice?.route).toEqual({ commands: ['/tasks'], queryParams: { view: 'upcoming' } });
    });

    it('uses the project destination when a stored status leaves Inbox undated', () => {
      const notice = taskMovementNotice(
        task(),
        task({ status: 'today', projectId: 'project-1' }),
        projects,
        reference,
      );

      expect(notice?.message).toBe('"Plan launch" moved to Today (Work)');
      expect(notice?.route).toEqual({ commands: ['/tasks'], queryParams: { view: 'today' } });
    });

    it('falls back to a readable project destination when the list is stale', () => {
      const notice = taskMovementNotice(task(), task({ projectId: 'missing' }), [], reference);

      expect(notice?.message).toBe('"Plan launch" moved to its project');
      expect(notice?.route).toEqual({ commands: ['/projects', 'missing'] });
    });

    it('returns null when the task stays in Inbox', () => {
      expect(taskMovementNotice(task(), task(), projects, reference)).toBeNull();
      expect(
        taskMovementNotice(task(), task({ title: 'Renamed' }), projects, reference),
      ).toBeNull();
    });

    it('returns null when the task was not in Inbox before the save', () => {
      expect(
        taskMovementNotice(
          task({ projectId: 'project-1' }),
          task({ projectId: 'project-2' }),
          projects,
          reference,
        ),
      ).toBeNull();
    });

    it('returns null when the task leaves Inbox without a destination', () => {
      expect(
        taskMovementNotice(task(), task({ status: 'archived' }), projects, reference),
      ).toBeNull();
    });

    it('truncates long titles', () => {
      const title = 'This is a very long task title that should be shortened for the toast';
      const notice = taskMovementNotice(
        task({ title }),
        task({ title, projectId: 'project-1' }),
        projects,
        reference,
      );

      expect(notice?.message).toContain('…"');
      expect(notice?.message.length).toBeLessThan(`"${title}" moved to Work`.length);
    });
  });

  describe('taskCompletionMovementNotice', () => {
    it('names Archive and keeps the task key', () => {
      const notice = taskCompletionMovementNotice(task());

      expect(notice?.message).toBe('"Plan launch" completed and moved to Archive');
      expect(notice?.route).toEqual({ commands: ['/archive'] });
      expect(notice?.key).toBe('task-movement:task-1');
    });

    it('returns null for tasks that were not in Inbox', () => {
      expect(taskCompletionMovementNotice(task({ dueDate: '2026-10-23' }))).toBeNull();
      expect(taskCompletionMovementNotice(task({ projectId: 'project-1' }))).toBeNull();
      expect(taskCompletionMovementNotice(task({ completed: true }))).toBeNull();
    });
  });
});

describe('TaskMovementNoticeService', () => {
  let service: TaskMovementNoticeService;
  let status: jasmine.SpyObj<StatusService>;
  let router: jasmine.SpyObj<Router>;
  let preferences: { actionNotifications: ReturnType<typeof signal<boolean>> };
  let projects: { projects: ReturnType<typeof signal<{ id: string; name: string }[]>> };

  function task(overrides: Partial<Task> = {}): Task {
    return {
      id: 'task-1',
      title: 'Plan launch',
      status: 'inbox',
      priority: 'medium',
      completed: false,
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-20T09:00:00.000Z',
      order: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    status = jasmine.createSpyObj<StatusService>('StatusService', ['success']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    preferences = { actionNotifications: signal(true) };
    projects = { projects: signal([{ id: 'project-1', name: 'Work' }]) };

    TestBed.configureTestingModule({
      providers: [
        TaskMovementNoticeService,
        { provide: StatusService, useValue: status },
        { provide: Router, useValue: router },
        { provide: PreferencesStore, useValue: preferences },
        { provide: ProjectService, useValue: projects },
      ],
    });

    service = TestBed.inject(TaskMovementNoticeService);
  });

  it('does not notify for saves outside the visible Inbox', () => {
    service.notifyMoved(task(), task({ projectId: 'project-1' }), false);

    expect(status.success).not.toHaveBeenCalled();
  });

  it('does not notify when action notifications are disabled', () => {
    preferences.actionNotifications.set(false);
    service.notifyMoved(task(), task({ projectId: 'project-1' }), true);
    service.notifyCompleted(task(), true);

    expect(status.success).not.toHaveBeenCalled();
  });

  it('shows a three-second movement toast with a View action', () => {
    service.notifyMoved(task(), task({ projectId: 'project-1' }), true);

    expect(status.success).toHaveBeenCalledWith(
      '"Plan launch" moved to Work',
      3000,
      jasmine.objectContaining({
        key: 'task-movement:task-1',
        action: jasmine.objectContaining({ label: 'View' }),
      }),
    );
  });

  it('navigates to the destination from the View action', () => {
    service.notifyMoved(task(), task({ projectId: 'project-1' }), true);
    const options = status.success.calls.mostRecent().args[2]!;

    options.action?.callback();

    expect(router.navigate).toHaveBeenCalledWith(['/projects', 'project-1'], undefined);
  });

  it('shows one destination-aware toast for an Inbox completion', () => {
    service.notifyCompleted(task(), true);

    expect(status.success).toHaveBeenCalledTimes(1);
    expect(status.success).toHaveBeenCalledWith(
      '"Plan launch" completed and moved to Archive',
      3000,
      jasmine.objectContaining({
        key: 'task-movement:task-1',
        action: jasmine.objectContaining({ label: 'View' }),
      }),
    );
  });

  it('keeps the generic completion toast outside Inbox', () => {
    service.notifyCompleted(task({ status: 'today', dueDate: '2026-10-23' }), false);

    expect(status.success).toHaveBeenCalledOnceWith('Task completed');
  });

  it('falls back to the generic completion toast when the task was not actually in Inbox', () => {
    service.notifyCompleted(task({ dueDate: '2026-10-23' }), true);

    expect(status.success).toHaveBeenCalledOnceWith('Task completed');
  });
});
