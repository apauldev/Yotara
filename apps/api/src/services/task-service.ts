import { randomUUID } from 'node:crypto';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type {
  BatchTaskPatchDto,
  CreateTaskDto,
  Priority,
  RecurrenceRule,
  TaskStatus,
  UpdateTaskDto,
} from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { projects, tasks, users } from '../db/schema.js';
import { DateTime } from 'luxon';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { todayInTimezone } from '../lib/timezone.js';
import { AppError, BadRequestError, NotFoundError } from '../lib/app-error.js';
import { getTaskLabels, syncTaskLabels } from './label-service.js';
import { resolveSectionIdForTaskWrite } from './section-service.js';
import {
  createDueNotificationIfNeeded,
  retireSupersededDueNotifications,
  scanDueNotifications,
} from './notification-service.js';
import type { TaskRow } from './task-mapper.js';
import { getTaskForOwnerSync } from './task-query-service.js';

export { toTask, type TaskRow } from './task-mapper.js';
export {
  type TaskFilters,
  listTasksForOwner,
  getTaskForOwnerSync,
  getTaskForOwner,
  listSubtasks,
} from './task-query-service.js';

function normalizeCreatePayload(body: CreateTaskDto): CreateTaskDto {
  return {
    ...body,
    title: body.title.trim(),
    status: body.status ?? 'inbox',
    priority: body.priority ?? 'medium',
    dueDate: body.simpleMode ? undefined : body.dueDate,
    dueTime: body.simpleMode ? undefined : body.dueTime,
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

export async function cleanupExpiredArchivedTasks(ownerId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  // Soft-deleted tasks stay in Trash for the same 30-day recovery window as
  // completed tasks. Only purge rows that have aged past it — deleting every
  // deletedAt row here made "recover within 30 days" impossible.
  await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.userId, ownerId),
        isNotNull(tasks.deletedAt),
        sql`${tasks.deletedAt} < ${cutoffIso}`,
      ),
    );

  // Retired projects whose tasks have aged past the recovery window are
  // also purged so soft-deleted projects don't linger in SQLite forever.
  await db
    .delete(projects)
    .where(
      and(
        eq(projects.ownerId, ownerId),
        isNotNull(projects.retiredAt),
        sql`${projects.retiredAt} < ${cutoffIso}`,
      ),
    );

  const archiveAutoDelete = await getArchiveAutoDeleteForOwner(ownerId);
  if (!archiveAutoDelete) {
    return 0;
  }

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

/**
 * Remove every completed task that is not marked permanentArchive right now,
 * instead of waiting for the 30-day auto-clear. Kept tasks (permanentArchive)
 * are untouched; tasks soft-deleted elsewhere also go, matching the eventual
 * purge in cleanupExpiredArchivedTasks.
 */
export function clearCompletedTasksForOwner(ownerId: string, tx?: Database): number {
  const run = (client: Database) =>
    client
      .delete(tasks)
      .where(
        and(
          eq(tasks.userId, ownerId),
          eq(tasks.completed, true),
          eq(tasks.permanentArchive, false),
        ),
      )
      .run().changes;

  return tx ? run(tx) : db.transaction(run, { behavior: 'immediate' });
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

    if (payload.dueTime && !payload.dueDate) {
      throw new BadRequestError('A due time requires a due date');
    }

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
      if (payload.sectionId === undefined) {
        payload.sectionId = parent.sectionId ?? undefined;
      }
    }

    const sectionResolution = resolveSectionIdForTaskWrite(
      ownerId,
      payload.sectionId,
      payload.projectId,
    );
    if (!sectionResolution.ok) {
      throw new BadRequestError('Section not found or does not belong to this project');
    }

    const projectId = sectionResolution.projectId ?? payload.projectId ?? null;
    const sectionId = sectionResolution.sectionId;

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
        dueTime: payload.dueTime,
        simpleMode: payload.simpleMode ?? false,
        projectId,
        sectionId,
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
        dueTime: payload.dueTime ?? null,
        completed: false,
      },
      tz,
    );

    // Scan all tasks for due/overdue notifications in case this user
    // has other tasks that became due while they were away
    scanDueNotifications(ownerId, tz, client);

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
            sectionId,
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
    // Scheduling a task is a real state change, so an explicit due date exits
    // simple mode. Without this, a task created without a date (simple mode)
    // would accept a 200 for a PATCH that asked to be scheduled and silently
    // drop the date. An explicit `simpleMode: true` still wins: it means "take
    // the schedule off", mirroring the create path and the client's toggle.
    const explicitlyScheduled =
      body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== '';
    const simpleMode = body.simpleMode ?? (explicitlyScheduled ? false : current.simpleMode);
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
      body.projectId === null ? null : (body.projectId ?? current.projectId ?? null);
    let nextSectionId = current.sectionId ?? null;
    if (body.sectionId !== undefined) {
      const sectionResolution = resolveSectionIdForTaskWrite(
        ownerId,
        body.sectionId,
        nextProjectId,
      );
      if (!sectionResolution.ok) {
        throw new BadRequestError('Section not found or does not belong to this project');
      }
      nextSectionId = sectionResolution.sectionId;
    } else if (nextProjectId !== current.projectId) {
      // A section only exists inside its own project; moving a task elsewhere
      // leaves it unsectioned unless the caller names a section explicitly.
      nextSectionId = null;
    }
    const nextParentId =
      body.parentId === null ? null : (body.parentId ?? current.parentId ?? undefined);

    if (nextParentId === taskId) {
      throw new BadRequestError('A task cannot be its own parent');
    }

    // Validate no nested subtasks: if we're setting a parent, that parent must not be a subtask itself
    if (nextParentId && nextParentId !== current.parentId) {
      const newParent = getTaskForOwnerSync(nextParentId, ownerId, client);
      if (newParent?.parentId) {
        throw new BadRequestError(
          'Subtasks cannot have subtasks — only one level of nesting is supported',
        );
      }
    }

    // null clears a persisted date; undefined leaves it unchanged.
    const nextDueDate = simpleMode
      ? null
      : body.dueDate === undefined
        ? current.dueDate
        : body.dueDate;
    // null clears a persisted time; undefined leaves it unchanged. A cleared
    // date takes the time with it, but a time sent alongside a cleared date is
    // a client mistake and falls through to the check below.
    const nextDueTime = simpleMode
      ? null
      : body.dueTime === undefined
        ? body.dueDate === null
          ? null
          : current.dueTime
        : body.dueTime;

    if (nextDueTime && !nextDueDate) {
      throw new BadRequestError('A due time requires a due date');
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
              dueTime: current.dueTime ?? undefined,
              simpleMode: current.simpleMode,
              projectId: nextProjectId ?? undefined,
              sectionId: nextSectionId ?? undefined,
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
        dueDate: nextDueDate,
        dueTime: nextDueTime,
        simpleMode,
        projectId: nextProjectId,
        sectionId: nextSectionId,
        parentId: nextParentId,
        recurrenceRule: nextRecurrenceRule,
        order: body.order ?? current.order,
        completed,
        status: normalizeStatusOnCompletion(status, completed, nextDueDate, tz),
        archivedAt: nextArchivedAt,
        permanentArchive: completed ? nextPermanentArchive : false,
        updatedAt: nowIsoTimestamp(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, ownerId)))
      .run();

    syncTaskLabels(ownerId, taskId, body.labels, client);

    // Due/overdue notification trigger: fire only when dueDate changes or
    // the task transitions from completed back to incomplete (undone) and
    // is now due/overdue. Avoid write amplification on unrelated edits.
    const prevDueDate = current.dueDate ?? null;
    const prevDueTime = current.dueTime ?? null;
    const wasCompleted = current.completed;
    const isNowIncomplete = completed === false || (body.completed === undefined && !wasCompleted);

    const dueDateChanged = nextDueDate !== prevDueDate;
    const dueTimeChanged = nextDueTime !== prevDueTime;
    const becameUndone = wasCompleted && isNowIncomplete;

    // Changing a task's time supersedes the reminder its old timing already
    // earned for this day: a newly timed task is only reminded at its exact
    // instant, and one that just lost its time falls back to the date-only
    // reminder. Restricting this to an unchanged date keeps other days' rows.
    // Clearing the schedule supersedes them too, otherwise a task that lost its
    // date and time keeps today's rows and the scheduler announces a reminder
    // for a schedule that no longer exists.
    const scheduleCleared = nextDueDate === null && (prevDueDate !== null || prevDueTime !== null);
    if ((dueTimeChanged && !dueDateChanged) || scheduleCleared) {
      retireSupersededDueNotifications(client, ownerId, taskId, tz);
    }

    if (dueDateChanged || dueTimeChanged || becameUndone) {
      createDueNotificationIfNeeded(
        client,
        ownerId,
        {
          id: taskId,
          title: body.title?.trim() || current.title,
          dueDate: nextDueDate ?? null,
          dueTime: nextDueTime,
          completed,
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
            sectionId: nextSectionId,
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

/** Applies one patch to several owned tasks atomically. */
export function updateTasksForOwner(
  ownerId: string,
  taskIds: string[],
  patch: BatchTaskPatchDto,
  tz?: string,
): { updated: number; missing: string[] } {
  const ids = [...new Set(taskIds)];
  const missing: string[] = [];
  let updated = 0;

  db.transaction(
    (tx) => {
      for (const id of ids) {
        const existing = getTaskForOwnerSync(id, ownerId, tx);
        if (!existing) {
          missing.push(id);
          continue;
        }
        if (updateTaskForOwnerSync(ownerId, id, patch, existing, tz, tx)) {
          updated += 1;
        }
      }
    },
    { behavior: 'immediate' },
  );

  return { updated, missing };
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

/**
 * Restore a whole deletion from Trash. A project deletion stamps the project
 * and every one of its tasks with the same moment, so restoring any task brings
 * back the project and the complete task batch together.
 */
export function restoreTaskForOwner(ownerId: string, taskId: string): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  const run = (client: Database) => {
    const [target] = client
      .select({ deletedAt: tasks.deletedAt, projectId: tasks.projectId })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, ownerId), isNotNull(tasks.deletedAt)))
      .limit(1)
      .all();

    if (!target?.deletedAt || target.deletedAt < cutoffIso) {
      return false;
    }

    const now = nowIsoTimestamp();
    const restored = client
      .update(tasks)
      .set({ deletedAt: null, updatedAt: now })
      .where(
        target.projectId
          ? and(
              eq(tasks.userId, ownerId),
              eq(tasks.projectId, target.projectId),
              eq(tasks.deletedAt, target.deletedAt),
            )
          : and(eq(tasks.userId, ownerId), eq(tasks.deletedAt, target.deletedAt)),
      )
      .run();

    // The project was retired with the same stamp; un-retire it so the tasks
    // land back in their original project instead of as orphaned Inbox items.
    if (target.projectId) {
      client
        .update(projects)
        .set({ retiredAt: null, updatedAt: now })
        .where(
          and(
            eq(projects.id, target.projectId),
            eq(projects.ownerId, ownerId),
            isNotNull(projects.retiredAt),
          ),
        )
        .run();
    }

    return restored.changes > 0;
  };

  return db.transaction(run, { behavior: 'immediate' });
}
