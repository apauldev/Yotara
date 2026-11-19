import type { RecurrenceRule, Task, TaskStatus } from '@yotara/shared';
import { tasks } from '../db/schema.js';

export type TaskRow = typeof tasks.$inferSelect;

export function toTask(task: TaskRow, labelIds: string[] = []): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status as TaskStatus,
    priority: task.priority as 'low' | 'medium' | 'high',
    completed: task.completed,
    dueDate: task.dueDate ?? undefined,
    dueTime: task.dueTime ?? undefined,
    simpleMode: task.simpleMode,
    projectId: task.projectId ?? undefined,
    sectionId: task.sectionId ?? undefined,
    parentId: task.parentId ?? undefined,
    recurrenceRule: task.recurrenceRule
      ? (JSON.parse(task.recurrenceRule) as RecurrenceRule)
      : undefined,
    baseTaskId: task.baseTaskId ?? undefined,
    archivedAt: task.archivedAt ?? undefined,
    deletedAt: task.deletedAt ?? undefined,
    permanentArchive: task.permanentArchive,
    labels: labelIds,
    order: task.order,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
