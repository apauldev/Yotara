import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type {
  CreateTaskDto,
  PaginatedResponse,
  Priority,
  RecurrenceRule,
  Task,
  TaskStatus,
  UpdateTaskDto,
} from '@yotara/shared';
import { db } from '../db/client.js';
import { tasks, users } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { getTaskLabels, syncTaskLabels } from './label-service.js';
import { getDefaultProjectForOwner } from './project-service.js';

type TaskRow = typeof tasks.$inferSelect;

function normalizeCreatePayload(body: CreateTaskDto): CreateTaskDto {
  return {
    ...body,
    title: body.title.trim(),
    status: body.status ?? 'inbox',
    priority: body.priority ?? 'medium',
    dueDate: body.simpleMode ? undefined : body.dueDate,
  };
}

function normalizeStatusOnCompletion(currentStatus: TaskStatus, completed: boolean): TaskStatus {
  if (completed) {
    return 'done';
  }

  if (currentStatus === 'done') {
    return 'today';
  }

  return currentStatus;
}

async function getArchiveAutoDeleteForOwner(ownerId: string) {
  const [row] = await db
    .select({ archiveAutoDelete: users.archiveAutoDelete })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  return row?.archiveAutoDelete ?? true;
}

export function toTask(task: TaskRow, labelIds: string[] = []): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status as TaskStatus,
    priority: task.priority as 'low' | 'medium' | 'high',
    completed: task.completed,
    dueDate: task.dueDate ?? undefined,
    simpleMode: task.simpleMode,
    projectId: task.projectId ?? undefined,
    parentId: task.parentId ?? undefined,
    recurrenceRule: task.recurrenceRule
      ? (JSON.parse(task.recurrenceRule) as RecurrenceRule)
      : undefined,
    baseTaskId: task.baseTaskId ?? undefined,
    archivedAt: task.archivedAt ?? undefined,
    permanentArchive: task.permanentArchive,
    labels: labelIds,
    order: task.order,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function cleanupExpiredArchivedTasks(ownerId: string) {
  await db.delete(tasks).where(and(eq(tasks.userId, ownerId), isNotNull(tasks.deletedAt)));

  const archiveAutoDelete = await getArchiveAutoDeleteForOwner(ownerId);
  if (!archiveAutoDelete) {
    return 0;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.userId, ownerId),
        eq(tasks.completed, true),
        eq(tasks.permanentArchive, false),
        isNotNull(tasks.archivedAt),
        isNull(tasks.deletedAt),
        sql`${tasks.archivedAt} < ${cutoffIso}`,
      ),
    );

  return 1;
}

export async function listTasksForOwner(
  ownerId: string,
  page: number,
  pageSize: number,
  includeSubtasks = false,
  parentId?: string,
): Promise<PaginatedResponse<Task[]>> {
  const offset = (page - 1) * pageSize;
  const baseWhere = and(eq(tasks.userId, ownerId), isNull(tasks.deletedAt));

  // If parentId is provided, we specifically want subtasks for that parent.
  // If parentId is NOT provided, we filter based on the includeSubtasks toggle.
  const whereClause = parentId
    ? and(baseWhere, eq(tasks.parentId, parentId))
    : includeSubtasks
      ? baseWhere
      : and(baseWhere, isNull(tasks.parentId));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(tasks)
    .where(whereClause);

  const rows = await db
    .select()
    .from(tasks)
    .where(whereClause)
    .orderBy(asc(tasks.order), asc(tasks.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const data = await Promise.all(
    rows.map(async (row) =>
      toTask(
        row,
        (await getTaskLabels(row.id)).map((label) => label.id),
      ),
    ),
  );

  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  };
}

export async function getTaskForOwner(taskId: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, ownerId), isNull(tasks.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...row,
    labels: (await getTaskLabels(row.id)).map((label) => label.id),
  } as TaskRow & { labels: string[] };
}

export async function listSubtasks(parentId: string, ownerId: string): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.parentId, parentId), eq(tasks.userId, ownerId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  return Promise.all(
    rows.map(async (row) =>
      toTask(
        row,
        (await getTaskLabels(row.id)).map((l) => l.id),
      ),
    ),
  );
}

function advanceDueDate(from: string, rule: RecurrenceRule): string {
  const d = new Date(from);
  const { frequency, interval, daysOfWeek } = rule;
  const n = interval || 1;

  let year = d.getUTCFullYear();
  let month = d.getUTCMonth();
  let day = d.getUTCDate();

  // Helper: find the next date from a given date that matches one of the target days
  function nextOnDay(fromDay: number, targetDays: number[]): { y: number; m: number; d: number } {
    const cursor = new Date(Date.UTC(year, month, fromDay));
    for (let i = 0; i < 8; i++) {
      if (targetDays.includes(cursor.getUTCDay())) {
        return {
          y: cursor.getUTCFullYear(),
          m: cursor.getUTCMonth(),
          d: cursor.getUTCDate(),
        };
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    // Fallback (shouldn't reach here with valid input)
    return { y: year, m: month, d: day + 1 };
  }

  switch (frequency) {
    case 'daily': {
      const next = new Date(Date.UTC(year, month, day + n));
      year = next.getUTCFullYear();
      month = next.getUTCMonth();
      day = next.getUTCDate();
      break;
    }
    case 'weekdays': {
      // Start from tomorrow, skip Sat(6) and Sun(0)
      const next = nextOnDay(day + 1, [1, 2, 3, 4, 5]);
      year = next.y;
      month = next.m;
      day = next.d;
      break;
    }
    case 'weekly': {
      if (daysOfWeek && daysOfWeek.length > 0) {
        // Repeat on specific days of the week — find the next one
        const next = nextOnDay(day + 1, daysOfWeek);
        year = next.y;
        month = next.m;
        day = next.d;
      } else {
        // Standard interval-based weekly
        const next = new Date(Date.UTC(year, month, day + 7 * n));
        year = next.getUTCFullYear();
        month = next.getUTCMonth();
        day = next.getUTCDate();
      }
      break;
    }
    case 'monthly': {
      month += n;
      while (month > 11) {
        year++;
        month -= 12;
      }
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      day = Math.min(day, lastDay);
      break;
    }
    case 'yearly': {
      year += n;
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      day = Math.min(day, lastDay);
      break;
    }
  }

  return new Date(Date.UTC(year, month, day)).toISOString().split('.')[0] + 'Z';
}

export async function createTaskForOwner(ownerId: string, body: CreateTaskDto) {
  const payload = normalizeCreatePayload(body);
  const now = nowIsoTimestamp();
  const id = randomUUID();

  if (payload.parentId) {
    if (payload.parentId === id) {
      throw new Error('A task cannot be its own parent');
    }
    const parent = await getTaskForOwner(payload.parentId, ownerId);
    if (!parent) {
      throw new Error('Parent task not found');
    }
    if (!payload.projectId) {
      payload.projectId = parent.projectId ?? undefined;
    }
  }

  const defaultProject = payload.projectId ? null : await getDefaultProjectForOwner(ownerId);
  const projectId = payload.projectId ?? defaultProject?.id ?? null;

  await db.insert(tasks).values({
    id,
    userId: ownerId,
    title: payload.title,
    description: payload.description,
    status: payload.status,
    priority: payload.priority,
    dueDate: payload.dueDate,
    simpleMode: payload.simpleMode ?? false,
    projectId,
    parentId: payload.parentId ?? null,
    recurrenceRule: payload.recurrenceRule ? JSON.stringify(payload.recurrenceRule) : null,
    baseTaskId: payload.baseTaskId ?? null,
    completed: false,
    archivedAt: null,
    permanentArchive: false,
    order: 0,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  await syncTaskLabels(ownerId, id, payload.labels);

  // Bulk create subtasks if provided
  if (payload.subtasks?.length) {
    for (const sub of payload.subtasks) {
      const subId = randomUUID();
      await db.insert(tasks).values({
        id: subId,
        userId: ownerId,
        title: sub.title,
        status: payload.status, // Inherit status for visibility
        priority: 'medium',
        projectId,
        parentId: id,
        completed: sub.completed ?? false,
        archivedAt: sub.completed ? now : null,
        order: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return getTaskForOwner(id, ownerId);
}

export async function updateTaskForOwner(
  ownerId: string,
  taskId: string,
  body: UpdateTaskDto,
  existing?: TaskRow | null,
) {
  const current = existing ?? (await getTaskForOwner(taskId, ownerId));
  if (!current) {
    return null;
  }

  const status = body.status ?? current.status;
  const completed = body.completed ?? current.completed;
  const simpleMode = body.simpleMode ?? current.simpleMode;
  const archiveAutoDelete = await getArchiveAutoDeleteForOwner(ownerId);
  const nextPermanentArchive =
    body.permanentArchive ??
    (completed && !current.completed ? !archiveAutoDelete : current.permanentArchive);
  const nextArchivedAt =
    completed && !current.completed
      ? nowIsoTimestamp()
      : completed
        ? (current.archivedAt ?? nowIsoTimestamp())
        : null;
  const nextProjectId =
    body.projectId === null
      ? ((await getDefaultProjectForOwner(ownerId))?.id ?? current.projectId ?? null)
      : (body.projectId ??
        current.projectId ??
        (await getDefaultProjectForOwner(ownerId))?.id ??
        null);
  const nextParentId =
    body.parentId === null ? null : (body.parentId ?? current.parentId ?? undefined);
  const nextRecurrenceRule =
    body.recurrenceRule === null
      ? null
      : body.recurrenceRule !== undefined
        ? JSON.stringify(body.recurrenceRule)
        : (current.recurrenceRule ?? undefined);

  // Recurrence materialization: create next instance when a recurring task is completed
  if (completed && !current.completed && current.recurrenceRule) {
    const rule: RecurrenceRule = JSON.parse(current.recurrenceRule);

    const useNow =
      rule.frequency === 'daily' ||
      rule.frequency === 'weekdays' ||
      (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0);
    const anchorDate = useNow ? nowIsoTimestamp() : (current.dueDate ?? nowIsoTimestamp());

    const nextDueDate = advanceDueDate(anchorDate, rule);

    // Stop recurring if the next instance would be past the end date
    // Compare just the date portion since endDate is YYYY-MM-DD
    if (rule.endDate && nextDueDate.split('T')[0] > rule.endDate) {
      // Recurrence ends here — no more instances
    } else {
      // Hard cap: at most 365 instances per template to prevent runaway DB growth
      const templateId = current.baseTaskId ?? current.id;
      const [{ instanceCount }] = await db
        .select({ instanceCount: sql<number>`count(*)` })
        .from(tasks)
        .where(eq(tasks.baseTaskId, templateId));

      if (instanceCount >= 365) {
        // Max instances reached — stop recurring
      } else {
        const currentLabels = (await getTaskLabels(current.id)).map((l) => l.id);

        await createTaskForOwner(ownerId, {
          title: current.title,
          description: current.description ?? undefined,
          priority: (current.priority ?? 'medium') as Priority,
          dueDate: nextDueDate,
          simpleMode: current.simpleMode,
          projectId: current.projectId ?? undefined,
          recurrenceRule: rule,
          baseTaskId: current.baseTaskId ?? current.id, // link to template
          labels: currentLabels,
        });
      }
    }
  }

  await db
    .update(tasks)
    .set({
      title: body.title?.trim() || current.title,
      description: body.description ?? current.description,
      priority: body.priority ?? current.priority,
      dueDate: simpleMode ? null : (body.dueDate ?? current.dueDate),
      simpleMode,
      projectId: nextProjectId,
      parentId: nextParentId,
      recurrenceRule: nextRecurrenceRule,
      order: body.order ?? current.order,
      completed,
      status: normalizeStatusOnCompletion(status, completed),
      archivedAt: nextArchivedAt,
      permanentArchive: completed ? nextPermanentArchive : false,
      updatedAt: nowIsoTimestamp(),
    })
    .where(eq(tasks.id, taskId));

  await syncTaskLabels(ownerId, taskId, body.labels);

  // Bulk create NEW subtasks if provided during update
  if (body.subtasks?.length) {
    const now = nowIsoTimestamp();
    for (const sub of body.subtasks) {
      const subId = randomUUID();
      await db.insert(tasks).values({
        id: subId,
        userId: ownerId,
        title: sub.title,
        status: status, // Match current task status
        priority: 'medium',
        projectId: nextProjectId,
        parentId: taskId,
        completed: sub.completed ?? false,
        archivedAt: sub.completed ? now : null,
        order: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return getTaskForOwner(taskId, ownerId);
}

export async function deleteTaskForOwner(
  ownerId: string,
  taskId: string,
  existing?: TaskRow | null,
) {
  const row = existing ?? (await getTaskForOwner(taskId, ownerId));
  if (!row) {
    return null;
  }

  // Cascade-delete subtasks
  await db.delete(tasks).where(and(eq(tasks.parentId, taskId), eq(tasks.userId, ownerId)));

  // Cascade-delete materialized instances (if this is a recurring template)
  await db.delete(tasks).where(and(eq(tasks.baseTaskId, taskId), eq(tasks.userId, ownerId)));

  await db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, ownerId)));

  return true;
}
