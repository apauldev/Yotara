import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { PaginatedResponse, Priority, Task, TaskStatus } from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { projects, tasks } from '../db/schema.js';
import { todayInTimezone, startOfDayInUtc } from '../lib/timezone.js';
import { assertCalendarDate } from '../lib/calendar-date.js';
import { getLabelsForTasks, getTaskLabels } from './label-service.js';
import { toTask, type TaskRow } from './task-mapper.js';

export interface TaskFilters {
  status?: TaskStatus;
  completed?: boolean;
  overdue?: boolean; // dueDate < now AND completed = false
  hasDueDate?: boolean;
  dueFrom?: string; // inclusive calendar date (YYYY-MM-DD), applied to date(due_date)
  dueTo?: string; // inclusive calendar date (YYYY-MM-DD), applied to date(due_date)
  tz?: string;
  view?: 'today' | 'inbox' | 'upcoming';
  completedSince?: string;
  /** Tasks carrying at least one of these labels. Ownership is re-checked in SQL. */
  labelIds?: string[];
  /** With multiple ids: `any` (OR) or `all` (AND). */
  labelMode?: 'any' | 'all';
  /** Only tasks filed under this project. */
  projectId?: string;
  /** Only tasks with this priority. */
  priority?: Priority;
  /** List soft-deleted (Trash) tasks instead of active ones. */
  deleted?: boolean;
  /** Only tasks with no project assigned. */
  unassigned?: boolean;
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
  const listConditions = [
    eq(tasks.userId, ownerId),
    filters?.deleted === true ? isNotNull(tasks.deletedAt) : isNull(tasks.deletedAt),
  ];
  if (filters?.unassigned === true) {
    listConditions.push(isNull(tasks.projectId));
  }
  const baseWhere = and(...listConditions);

  // If parentId is provided, we specifically want subtasks for that parent.
  // If parentId is NOT provided, we filter based on the includeSubtasks toggle.
  let whereClause = parentId
    ? and(baseWhere, eq(tasks.parentId, parentId))
    : includeSubtasks
      ? baseWhere
      : and(baseWhere, isNull(tasks.parentId));

  if (filters) {
    if (filters.dueFrom) {
      assertCalendarDate(filters.dueFrom, 'dueFrom');
    }
    if (filters.dueTo) {
      assertCalendarDate(filters.dueTo, 'dueTo');
    }
    if (filters.status) {
      whereClause = and(whereClause, eq(tasks.status, filters.status));
    }
    if (filters.completed !== undefined) {
      whereClause = and(whereClause, eq(tasks.completed, filters.completed));
    }
    if (filters.hasDueDate !== undefined) {
      whereClause = filters.hasDueDate
        ? and(whereClause, isNotNull(tasks.dueDate), sql`${tasks.dueDate} <> ''`)
        : and(whereClause, or(isNull(tasks.dueDate), eq(tasks.dueDate, '')));
    }
    // Inclusive calendar-date range over the due date. An inverted range
    // (dueFrom > dueTo) matches nothing rather than erroring; undated tasks
    // fall out because date(NULL) satisfies neither bound.
    if (filters.dueFrom) {
      whereClause = and(whereClause, sql`date(${tasks.dueDate}) >= ${filters.dueFrom}`);
    }
    if (filters.dueTo) {
      whereClause = and(whereClause, sql`date(${tasks.dueDate}) <= ${filters.dueTo}`);
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
            and(
              eq(tasks.status, 'inbox'),
              or(isNull(tasks.dueDate), sql`${tasks.dueDate} = ''`),
              isNull(tasks.projectId),
            ),
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
    if (filters.projectId) {
      whereClause = and(whereClause, eq(tasks.projectId, filters.projectId));
    }
    if (filters.priority) {
      whereClause = and(whereClause, eq(tasks.priority, filters.priority));
    }
    if (filters.labelIds && filters.labelIds.length > 0) {
      // EXISTS over task_labels joined to labels so only labels owned by this
      // user (the owner of the task row being tested) can match. Ownership is
      // enforced in SQL, not trusted from the caller's id list.
      // COUNT(DISTINCT) requires the unique-id count; the route deduplicates,
      // but direct service callers must not turn valid matches into zero rows.
      const uniqueLabelIds = [...new Set(filters.labelIds)];
      const labelList = sql.join(uniqueLabelIds, sql`, `);
      if (filters.labelMode === 'all') {
        // AND semantics: the task must carry every requested owned label.
        whereClause = and(
          whereClause,
          sql`(
            SELECT COUNT(DISTINCT tl.label_id)
            FROM task_labels tl
            JOIN labels l ON l.id = tl.label_id
            WHERE tl.task_id = ${tasks.id}
              AND l.user_id = ${ownerId}
              AND tl.label_id IN (${labelList})
          ) = ${uniqueLabelIds.length}`,
        );
      } else {
        whereClause = and(
          whereClause,
          sql`EXISTS (
            SELECT 1
            FROM task_labels tl
            JOIN labels l ON l.id = tl.label_id
            WHERE tl.task_id = ${tasks.id}
              AND l.user_id = ${ownerId}
              AND tl.label_id IN (${labelList})
          )`,
        );
      }
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

  // Trash entries still reference their retired project. Resolve its name so
  // the UI can name the deletion batch it is about to restore.
  let deletedProjectNames = new Map<string, string>();
  if (filters?.deleted === true) {
    const projectIds = [
      ...new Set(rows.map((row) => row.projectId).filter((id): id is string => !!id)),
    ];
    if (projectIds.length > 0) {
      const projectRows = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, projectIds));
      deletedProjectNames = new Map(projectRows.map((project) => [project.id, project.name]));
    }
  }

  const data = rows.map((row) => {
    const task = toTask(row, labelsMap.get(row.id) ?? []);
    if (filters?.deleted === true && row.projectId) {
      task.deletedProjectName = deletedProjectNames.get(row.projectId);
    }
    return task;
  });

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

export function getTaskForOwnerSync(
  taskId: string,
  ownerId: string,
  tx?: Database,
): (TaskRow & { labels: string[] }) | null {
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

export async function getTaskForOwner(
  taskId: string,
  ownerId: string,
  tx?: Database,
): Promise<(TaskRow & { labels: string[] }) | null> {
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
