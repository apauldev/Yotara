import { DateTime } from 'luxon';
import {
  getTaskViewDestination,
  resolveProjectName,
  taskCreationNotification,
} from './task-creation-notification';

describe('task creation notifications', () => {
  const reference = DateTime.local(2026, 9, 25);
  const projects = [
    { id: 'inbox-1', name: 'Inbox' },
    { id: 'home-1', name: 'Home' },
  ];

  it('maps due dates to the task views', () => {
    expect(getTaskViewDestination(undefined, 'inbox', reference)).toBe('inbox');
    expect(getTaskViewDestination('2026-09-25', 'inbox', reference)).toBe('today');
    expect(getTaskViewDestination('2026-09-26', 'inbox', reference)).toBe('upcoming');
    expect(getTaskViewDestination('2026-09-24', 'inbox', reference)).toBe('overdue');
  });

  it('uses an explicit status when there is no due date', () => {
    expect(getTaskViewDestination(undefined, 'today', reference)).toBe('today');
    expect(getTaskViewDestination(undefined, 'upcoming', reference)).toBe('upcoming');
  });

  it('names the task, the view, the project, and the due date', () => {
    expect(
      taskCreationNotification({
        title: 'Plan the garden',
        dueDate: '2026-09-25',
        projectId: 'home-1',
        projects,
        reference,
      }),
    ).toBe('"Plan the garden" added to Today (Home) · due Fri, Sep 25, 2026');
  });

  it('shows the resolved time when one was set', () => {
    expect(
      taskCreationNotification({
        title: 'Call Sam',
        dueDate: '2026-09-25',
        dueTime: '15:00',
        projectId: 'home-1',
        projects,
        reference,
      }),
    ).toBe('"Call Sam" added to Today (Home) · due Fri, Sep 25, 2026, 3:00 PM');
  });

  it('omits the time when none was set', () => {
    expect(
      taskCreationNotification({
        title: 'Plan the garden',
        dueDate: '2026-09-25',
        dueTime: null,
        projectId: 'home-1',
        projects,
        reference,
      }),
    ).toBe('"Plan the garden" added to Today (Home) · due Fri, Sep 25, 2026');
  });

  it('reports the project as the destination without a due date', () => {
    expect(
      taskCreationNotification({ title: 'Buy milk', projectId: 'home-1', projects, reference }),
    ).toBe('"Buy milk" added to Home');
  });

  it('omits the project when no project was resolved', () => {
    expect(taskCreationNotification({ title: 'Buy milk', reference })).toBe(
      '"Buy milk" added to Inbox',
    );
    expect(
      taskCreationNotification({ title: 'Buy milk', projectId: 'missing', projects, reference }),
    ).toBe('"Buy milk" added to Inbox');
  });

  it('omits a project that repeats the destination label', () => {
    expect(
      taskCreationNotification({ title: 'Buy milk', projectId: 'inbox-1', projects, reference }),
    ).toBe('"Buy milk" added to Inbox');
  });

  it('names an explicitly chosen project for a dated task', () => {
    expect(
      taskCreationNotification({
        title: 'Pay rent in 15 days',
        dueDate: '2026-10-10',
        projectId: 'home-1',
        projects,
        reference,
      }),
    ).toBe('"Pay rent in 15 days" added to Upcoming (Home) · due Sat, Oct 10, 2026');
  });

  it('names a dated project even when its name matches a task view', () => {
    expect(
      taskCreationNotification({
        title: 'Pay rent in 15 days',
        dueDate: '2026-10-10',
        projectId: 'inbox-1',
        projects,
        reference,
      }),
    ).toBe('"Pay rent in 15 days" added to Upcoming (Inbox) · due Sat, Oct 10, 2026');
  });

  it('truncates a long title so the toast stays readable', () => {
    const message = taskCreationNotification({
      title: 'Renew the passport and ship the quarterly report before Friday',
      projectId: 'home-1',
      projects,
      reference,
    });

    expect(message).toBe('"Renew the passport and ship the quarter…" added to Home');
  });

  it('resolves a project name from the project list', () => {
    expect(resolveProjectName(projects, 'home-1')).toBe('Home');
    expect(resolveProjectName(projects, 'inbox-1')).toBe('Inbox');
    expect(resolveProjectName(projects, 'nope')).toBeNull();
    expect(resolveProjectName(projects, null)).toBeNull();
  });
});
