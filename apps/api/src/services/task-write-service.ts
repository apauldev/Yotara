import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type {
  BatchTaskPatchDto,
  CreateTaskDto,
  Priority,
  RecurrenceRule,
  UpdateTaskDto,
} from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { tasks } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { BadRequestError, NotFoundError } from '../lib/app-error.js';
import { getTaskLabels, syncTaskLabels } from './label-service.js';
import { resolveSectionIdForTaskWrite } from './section-service.js';
import {
  createDueNotificationIfNeeded,
  retireSupersededDueNotifications,
  scanDueNotifications,
} from './notification-service.js';
import type { TaskRow } from './task-mapper.js';
import { getTaskForOwnerSync } from './task-query-service.js';
import {
  getArchiveAutoDeleteForOwner,
  normalizeCreatePayload,
  normalizeStatusOnCompletion,
} from './task-policy.js';
import { advanceDueDate } from './task-recurrence.js';

export function createTaskForOwnerSync(
  ownerId: string,
  body: CreateTaskDto,
  tz?: string,
  tx?: Database,
): (TaskRow & { labels: string[] }) | null {
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
): Promise<(TaskRow & { labels: string[] }) | null> {
  return createTaskForOwnerSync(ownerId, body, tz, tx);
}

export function updateTaskForOwnerSync(
  ownerId: string,
  taskId: string,
  body: UpdateTaskDto,
  existing?: TaskRow | null,
  tz?: string,
  tx?: Database,
): (TaskRow & { labels: string[] }) | null {
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
): Promise<(TaskRow & { labels: string[] }) | null> {
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
