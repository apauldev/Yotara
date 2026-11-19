import test from 'node:test';
import assert from 'node:assert/strict';
import { toTask, type TaskRow } from './task-mapper.js';

test('task-mapper: toTask maps complete database row to Task model', () => {
  const row: TaskRow = {
    id: 'task-1',
    userId: 'user-1',
    title: 'Test Task',
    description: 'Detailed description',
    status: 'today',
    priority: 'high',
    completed: true,
    dueDate: '2026-11-20',
    dueTime: '14:30',
    simpleMode: false,
    projectId: 'project-1',
    sectionId: 'section-1',
    parentId: 'parent-1',
    recurrenceRule: JSON.stringify({ frequency: 'daily', interval: 1 }),
    baseTaskId: 'base-1',
    archivedAt: '2026-11-19T10:00:00.000Z',
    deletedAt: null,
    permanentArchive: true,
    order: 5,
    createdAt: '2026-11-19T08:00:00.000Z',
    updatedAt: '2026-11-19T09:00:00.000Z',
  };

  const result = toTask(row, ['label-1', 'label-2']);

  assert.equal(result.id, 'task-1');
  assert.equal(result.title, 'Test Task');
  assert.equal(result.description, 'Detailed description');
  assert.equal(result.status, 'today');
  assert.equal(result.priority, 'high');
  assert.equal(result.completed, true);
  assert.equal(result.dueDate, '2026-11-20');
  assert.equal(result.dueTime, '14:30');
  assert.equal(result.simpleMode, false);
  assert.equal(result.projectId, 'project-1');
  assert.equal(result.sectionId, 'section-1');
  assert.equal(result.parentId, 'parent-1');
  assert.deepEqual(result.recurrenceRule, { frequency: 'daily', interval: 1 });
  assert.equal(result.baseTaskId, 'base-1');
  assert.equal(result.archivedAt, '2026-11-19T10:00:00.000Z');
  assert.equal(result.deletedAt, undefined);
  assert.equal(result.permanentArchive, true);
  assert.deepEqual(result.labels, ['label-1', 'label-2']);
  assert.equal(result.order, 5);
  assert.equal(result.createdAt, '2026-11-19T08:00:00.000Z');
  assert.equal(result.updatedAt, '2026-11-19T09:00:00.000Z');
});

test('task-mapper: toTask converts null values to undefined and handles missing recurrence', () => {
  const row: TaskRow = {
    id: 'task-2',
    userId: 'user-1',
    title: 'Minimal Task',
    description: null,
    status: 'inbox',
    priority: 'medium',
    completed: false,
    dueDate: null,
    dueTime: null,
    simpleMode: true,
    projectId: null,
    sectionId: null,
    parentId: null,
    recurrenceRule: null,
    baseTaskId: null,
    archivedAt: null,
    deletedAt: null,
    permanentArchive: false,
    order: 0,
    createdAt: '2026-11-19T08:00:00.000Z',
    updatedAt: '2026-11-19T08:00:00.000Z',
  };

  const result = toTask(row);

  assert.equal(result.id, 'task-2');
  assert.equal(result.title, 'Minimal Task');
  assert.equal(result.description, undefined);
  assert.equal(result.status, 'inbox');
  assert.equal(result.dueDate, undefined);
  assert.equal(result.dueTime, undefined);
  assert.equal(result.projectId, undefined);
  assert.equal(result.sectionId, undefined);
  assert.equal(result.parentId, undefined);
  assert.equal(result.recurrenceRule, undefined);
  assert.equal(result.baseTaskId, undefined);
  assert.equal(result.archivedAt, undefined);
  assert.equal(result.deletedAt, undefined);
  assert.deepEqual(result.labels, []);
});
