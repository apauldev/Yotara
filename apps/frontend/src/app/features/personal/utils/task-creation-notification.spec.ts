import { DateTime } from 'luxon';
import { getTaskViewDestination, taskCreationNotification } from './task-creation-notification';

describe('task creation notifications', () => {
  const reference = DateTime.local(2026, 9, 25);

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

  it('formats the destination and due date for a save confirmation', () => {
    expect(taskCreationNotification('2026-09-25', 'inbox', reference)).toBe(
      'Task added to Today · due Fri, Sep 25, 2026.',
    );
    expect(taskCreationNotification('2026-09-26', 'inbox', reference)).toBe(
      'Task added to Upcoming · due Sat, Sep 26, 2026.',
    );
    expect(taskCreationNotification(undefined, 'inbox', reference)).toBe('Task added to Inbox.');
  });
});
