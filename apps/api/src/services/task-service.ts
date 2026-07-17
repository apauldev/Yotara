import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type {
  CreateTaskDto,
  PaginatedResponse,
  Priority,
  RecurrenceRule,
  Task,
  TaskStatus,
  UpdateTaskDto,
} from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { tasks, users } from '../db/schema.js';
import { DateTime } from 'luxon';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { todayInTimezone, startOfDayInUtc } from '../lib/timezone.js';
import { AppError, BadRequestError, NotFoundError } from '../lib/app-error.js';
import { getLabelsForTasks, getTaskLabels, syncTaskLabels } from './label-service.js';
import { getDefaultProjectForOwner } from './project-service.js';
import { createDueNotificationIfNeeded } from './notification-service.js';

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

function normalizeStatusOnCompletion(
  currentStatus: TaskStatus,
  completed: boolean,
  dueDate?: string | null,
  tz?: string,
): TaskStatus {
  if (completed) {
    return 'done';
  }

  if (currentStatus === 'done') {
    if (!dueDate) {
      return 'inbox';
    }

    const dueDateKey = dueDate.slice(0, 10);
    const todayKey = todayInTimezone(tz);

    return dueDateKey > todayKey ? 'upcoming' : 'today';
  }

  return currentStatus;
}

function getArchiveAutoDeleteForOwner(ownerId: string, tx?: Database) {
  const client = tx ?? db;
  const [row] = client
    .select({ archiveAutoDelete: users.archiveAutoDelete })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1)
    .all();

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

export interface TaskFilters {
  status?: TaskStatus;
  completed?: boolean;
  overdue?: boolean; // dueDate < now AND completed = false
  hasDueDate?: boolean;
  tz?: string;
  view?: 'today' | 'inbox' | 'upcoming';
  completedSince?: string;
}

export async function listTasksForOwner(
  ownerId: string,
  page: number,
  pageSize: number,
  includeSubtasks = false,
  parentId?: string,
  filters?: TaskFilters,
): Promise<PaginatedResponse<Task[]>> {
  const offset = (page - 1) * pageSize;
  const baseWhere = and(eq(tasks.userId, ownerId), isNull(tasks.deletedAt));

  // If parentId is provided, we specifically want subtasks for that parent.
  // If parentId is NOT provided, we filter based on the includeSubtasks toggle.
  let whereClause = parentId
    ? and(baseWhere, eq(tasks.parentId, parentId))
    : includeSubtasks
      ? baseWhere
      : and(baseWhere, isNull(tasks.parentId));

  if (filters) {
    if (filters.status) {
      whereClause = and(whereClause, eq(tasks.status, filters.status));
    }
    if (filters.completed !== undefined) {
      whereClause = and(whereClause, eq(tasks.completed, filters.completed));
    }
    if (filters.hasDueDate !== undefined) {
      whereClause = filters.hasDueDate
        ? and(whereClause, isNotNull(tasks.dueDate))
        : and(whereClause, isNull(tasks.dueDate));
    }
    if (filters.overdue) {
      const today = todayInTimezone(filters.tz);
      whereClause = and(
        whereClause,
        eq(tasks.completed, false),
        sql`date(${tasks.dueDate}) < ${today}`,
      );
    }
    if (filters.view) {
      const today = todayInTimezone(filters.tz);
      switch (filters.view) {
        case 'today':
          whereClause = and(
            whereClause,
            eq(tasks.completed, false),
            or(
              and(
                eq(tasks.status, 'today'),
                or(isNull(tasks.dueDate), sql`date(${tasks.dueDate}) >= ${today}`),
              ),
              sql`date(${tasks.dueDate}) = ${today}`,
            ),
          );
          break;
        case 'inbox':
          whereClause = and(
            whereClause,
            eq(tasks.completed, false),
            and(eq(tasks.status, 'inbox'), or(isNull(tasks.dueDate), sql`${tasks.dueDate} = ''`)),
          );
          break;
        case 'upcoming':
          whereClause = and(
            whereClause,
            eq(tasks.completed, false),
            or(
              and(
                eq(tasks.status, 'upcoming'),
                or(isNull(tasks.dueDate), sql`date(${tasks.dueDate}) > ${today}`),
              ),
              sql`date(${tasks.dueDate}) > ${today}`,
            ),
          );
          break;
      }
    }
    if (filters.completedSince) {
      const startOfTodayUtc = startOfDayInUtc(filters.completedSince, filters.tz);
      whereClause = and(
        whereClause,
        eq(tasks.completed, true),
        sql`${tasks.archivedAt} >= ${startOfTodayUtc}`,
      );
    }
  }

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
  const taskIds = rows.map((r) => r.id);
  const labelsMap = await getLabelsForTasks(taskIds);
  const data = rows.map((row) => toTask(row, labelsMap.get(row.id) ?? []));

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

function getTaskForOwnerSync(taskId: string, ownerId: string, tx?: Database) {
  const client = tx ?? db;
  const [row] = client
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, ownerId), isNull(tasks.deletedAt)))
    .limit(1)
    .all();

  if (!row) {
    return null;
  }

  return {
    ...row,
    labels: getTaskLabels(row.id, tx).map((label) => label.id),
  } as TaskRow & { labels: string[] };
}

export async function getTaskForOwner(taskId: string, ownerId: string, tx?: Database) {
  return getTaskForOwnerSync(taskId, ownerId, tx);
}

export async function listSubtasks(parentId: string, ownerId: string): Promise<Task[]> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.parentId, parentId), eq(tasks.userId, ownerId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.order), asc(tasks.createdAt));

  const taskIds = rows.map((r) => r.id);
  const labelsMap = await getLabelsForTasks(taskIds);
  return rows.map((row) => toTask(row, labelsMap.get(row.id) ?? []));
}

function advanceDueDate(from: string, rule: RecurrenceRule): string {
  const dt = DateTime.fromISO(from, { zone: 'utc' });
  const { frequency, interval, daysOfWeek } = rule;
  const n = interval || 1;

  let next: DateTime;

  switch (frequency) {
    case 'daily': {
      next = dt.plus({ days: n });
      break;
    }
    case 'weekdays': {
      next = dt.plus({ days: 1 });
      while (next.weekday > 5) next = next.plus({ days: 1 });
      break;
    }
    case 'weekly': {
      if (daysOfWeek && daysOfWeek.length > 0) {
        // RRULE: count weeks from DTSTART (dt), find next BYDAY in week where weekNum % n === 0
        next = dt.plus({ days: 1 });
        for (let i = 0; i < 60; i++) {
          const hoursSinceDtstart = next.diff(dt, 'hours').hours;
          const weekNum = Math.floor(hoursSinceDtstart / 24 / 7);
          const jsDay = next.weekday === 7 ? 0 : next.weekday;
          if (weekNum % n === 0 && daysOfWeek.includes(jsDay)) break;
          next = next.plus({ days: 1 });
        }
      } else {
        next = dt.plus({ weeks: n });
      }
      break;
    }
    case 'monthly': {
      next = dt.plus({ months: n });
      break;
    }
    case 'yearly': {
      next = dt.plus({ years: n });
      break;
    }
    default:
      next = dt;
  }

  const result = next.toISO({ suppressMilliseconds: true });
  if (!result) throw new AppError(500, 'Failed to format date');
  return result;
}

function createTaskForOwnerSync(ownerId: string, body: CreateTaskDto, tz?: string, tx?: Database) {
  const run = (client: Database) => {
    const payload = normalizeCreatePayload(body);
    const now = nowIsoTimestamp();
    const id = randomUUID();

    if (payload.parentId) {
      if (payload.parentId === id) {
        throw new BadRequestError('A task cannot be its own parent');
      }
      const parent = getTaskForOwnerSync(payload.parentId, ownerId, client);
      if (!parent) {
        throw new NotFoundError('Parent task not found');
      }
      if (parent.parentId) {
        throw new BadRequestError(
          'Subtasks cannot have subtasks — only one level of nesting is supported',
        );
      }
      if (!payload.projectId) {
        payload.projectId = parent.projectId ?? undefined;
      }
    }

    const defaultProject = payload.projectId ? null : getDefaultProjectForOwner(ownerId, client);
    const projectId = payload.projectId ?? defaultProject?.id ?? null;

    client
      .insert(tasks)
      .values({
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
      })
      .run();

    syncTaskLabels(ownerId, id, payload.labels, client);

    createDueNotificationIfNeeded(
      client,
      ownerId,
      {
        id,
        title: payload.title,
        dueDate: payload.dueDate ?? null,
        completed: false,
      },
      tz,
    );

    // Bulk create subtasks if provided
    if (payload.subtasks?.length) {
      for (const sub of payload.subtasks) {
        const subId = randomUUID();
        client
          .insert(tasks)
          .values({
            id: subId,
            userId: ownerId,
            title: sub.title,
            status: payload.status, // Inherit status for visibility
            priority: 'medium',
            simpleMode: payload.simpleMode ?? false, // Inherit simpleMode from parent
            projectId,
            parentId: id,
            completed: sub.completed ?? false,
            archivedAt: sub.completed ? now : null,
            order: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        // Inherit labels from parent
        syncTaskLabels(ownerId, subId, payload.labels, client);
      }
    }

    return getTaskForOwnerSync(id, ownerId, client);
  };

  return tx ? run(tx) : db.transaction(run, { behavior: 'immediate' });
}

export async function createTaskForOwner(
  ownerId: string,
  body: CreateTaskDto,
  tz?: string,
  tx?: Database,
) {
  return createTaskForOwnerSync(ownerId, body, tz, tx);
}

function updateTaskForOwnerSync(
  ownerId: string,
  taskId: string,
  body: UpdateTaskDto,
  existing?: TaskRow | null,
  tz?: string,
  tx?: Database,
) {
  const run = (client: Database) => {
    const current = existing ?? getTaskForOwnerSync(taskId, ownerId, client);
    if (!current) {
      return null;
    }

    const status = body.status ?? current.status;
    const completed = body.completed ?? current.completed;
    const simpleMode = body.simpleMode ?? current.simpleMode;
    const archiveAutoDelete = getArchiveAutoDeleteForOwner(ownerId, client);
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
        ? null
        : (body.projectId ??
          current.projectId ??
          getDefaultProjectForOwner(ownerId, client)?.id ??
          null);
    const nextParentId =
      body.parentId === null ? null : (body.parentId ?? current.parentId ?? undefined);

    // Validate no nested subtasks: if we're setting a parent, that parent must not be a subtask itself
    if (nextParentId && nextParentId !== current.parentId) {
      const newParent = getTaskForOwnerSync(nextParentId, ownerId, client);
      if (newParent?.parentId) {
        throw new BadRequestError(
          'Subtasks cannot have subtasks — only one level of nesting is supported',
        );
      }
    }
    const nextRecurrenceRule =
      body.recurrenceRule === null
        ? null
        : body.recurrenceRule !== undefined
          ? JSON.stringify(body.recurrenceRule)
          : (current.recurrenceRule ?? undefined);

    // Recurrence materialization: create next instance when a recurring task is completed
    // Don't materialize if the caller is explicitly clearing the recurrence rule
    if (completed && !current.completed && current.recurrenceRule && body.recurrenceRule !== null) {
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
        const [{ instanceCount }] = client
          .select({ instanceCount: sql<number>`count(*)` })
          .from(tasks)
          .where(eq(tasks.baseTaskId, templateId))
          .all();

        if (instanceCount >= 365) {
          // Max instances reached — stop recurring
        } else {
          const currentLabels = getTaskLabels(current.id, client).map((l) => l.id);

          createTaskForOwnerSync(
            ownerId,
            {
              title: current.title,
              description: current.description ?? undefined,
              priority: (current.priority ?? 'medium') as Priority,
              dueDate: nextDueDate,
              simpleMode: current.simpleMode,
              projectId: current.projectId ?? undefined,
              recurrenceRule: rule,
              baseTaskId: current.baseTaskId ?? current.id, // link to template
              labels: currentLabels,
            },
            tz,
            client,
          );
        }
      }
    }

    client
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
        status: normalizeStatusOnCompletion(
          status,
          completed,
          simpleMode ? null : (body.dueDate ?? current.dueDate),
          tz,
        ),
        archivedAt: nextArchivedAt,
        permanentArchive: completed ? nextPermanentArchive : false,
        updatedAt: nowIsoTimestamp(),
      })
      .where(eq(tasks.id, taskId))
      .run();

    syncTaskLabels(ownerId, taskId, body.labels, client);

    // Due/overdue notification trigger: fire only when dueDate changes or
    // the task transitions from completed back to incomplete (undone) and
    // is now due/overdue. Avoid write amplification on unrelated edits.
    const prevDueDate = current.dueDate ?? null;
    const wasCompleted = current.completed;
    const nextDueDate = simpleMode ? null : (body.dueDate ?? current.dueDate);
    const isNowIncomplete = completed === false || (body.completed === undefined && !wasCompleted);

    const dueDateChanged = nextDueDate !== prevDueDate;
    const becameUndone = wasCompleted && isNowIncomplete;

    if (dueDateChanged || becameUndone) {
      createDueNotificationIfNeeded(
        client,
        ownerId,
        {
          id: taskId,
          title: body.title?.trim() || current.title,
          dueDate: nextDueDate ?? null,
          completed: false,
        },
        tz,
      );
    }

    // Bulk create NEW subtasks if provided during update
    if (body.subtasks?.length) {
      const now = nowIsoTimestamp();
      // Determine labels to propagate to subtasks
      const subtaskLabels = body.labels ?? getTaskLabels(taskId, client).map((l) => l.id);
      for (const sub of body.subtasks) {
        const subId = randomUUID();
        client
          .insert(tasks)
          .values({
            id: subId,
            userId: ownerId,
            title: sub.title,
            status: status, // Match current task status
            priority: 'medium',
            simpleMode, // Inherit simpleMode from parent
            projectId: nextProjectId,
            parentId: taskId,
            completed: sub.completed ?? false,
            archivedAt: sub.completed ? now : null,
            order: 0,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        // Inherit labels from parent
        syncTaskLabels(ownerId, subId, subtaskLabels, client);
      }
    }

    return getTaskForOwnerSync(taskId, ownerId, client);
  };

  return tx ? run(tx) : db.transaction(run, { behavior: 'immediate' });
}

export async function updateTaskForOwner(
  ownerId: string,
  taskId: string,
  body: UpdateTaskDto,
  existing?: TaskRow | null,
  tz?: string,
  tx?: Database,
) {
  return updateTaskForOwnerSync(ownerId, taskId, body, existing, tz, tx);
}

export function deleteTaskForOwner(
  ownerId: string,
  taskId: string,
  existing?: TaskRow | null,
  tx?: Database,
) {
  const run = (client: Database) => {
    const row = existing ?? getTaskForOwnerSync(taskId, ownerId, client);
    if (!row) {
      return null;
    }

    // Cascade-delete subtasks
    client
      .delete(tasks)
      .where(and(eq(tasks.parentId, taskId), eq(tasks.userId, ownerId)))
      .run();

    // Cascade-delete materialized instances (if this is a recurring template)
    client
      .delete(tasks)
      .where(and(eq(tasks.baseTaskId, taskId), eq(tasks.userId, ownerId)))
      .run();

    client
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, ownerId)))
      .run();

    return true;
  };

  return tx ? run(tx) : db.transaction(run, { behavior: 'immediate' });
}
