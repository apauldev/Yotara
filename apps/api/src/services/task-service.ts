import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type {
  CreateTaskDto,
  PaginatedResponse,
  Task,
  TaskStatus,
  UpdateTaskDto,
} from '@yotara/shared';
import { db } from '../db/client.js';
import { tasks } from '../db/schema.js';

type TaskRow = typeof tasks.$inferSelect;

function normalizeCreatePayload(body: CreateTaskDto): CreateTaskDto {
  return {
    ...body,
    title: body.title.trim(),
    status: body.status ?? 'inbox',
    priority: body.priority ?? 'medium',
    bucket: body.bucket ?? 'personal-sanctuary',
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

export function toTask(task: TaskRow): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status as TaskStatus,
    priority: task.priority as 'low' | 'medium' | 'high',
    completed: task.completed,
    dueDate: task.dueDate ?? undefined,
    simpleMode: task.simpleMode,
    bucket: task.bucket ?? undefined,
    projectId: task.projectId ?? undefined,
    order: task.order,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export async function listTasksForOwner(
  ownerId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedResponse<Task[]>> {
  const offset = (page - 1) * pageSize;
  const whereClause = and(eq(tasks.userId, ownerId), isNull(tasks.deletedAt));
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
  return {
    data: rows.map(toTask),
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

  return row ?? null;
}

export async function createTaskForOwner(ownerId: string, body: CreateTaskDto) {
  const payload = normalizeCreatePayload(body);
  const now = new Date().toISOString();
  const id = randomUUID();

  await db.insert(tasks).values({
    id,
    userId: ownerId,
    title: payload.title,
    description: payload.description,
    status: payload.status,
    priority: payload.priority,
    dueDate: payload.dueDate,
    simpleMode: payload.simpleMode ?? false,
    bucket: payload.bucket ?? 'personal-sanctuary',
    projectId: payload.projectId ?? null,
    completed: false,
    order: 0,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });

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
  const nextProjectId =
    body.projectId === null ? null : (body.projectId ?? current.projectId ?? null);

  await db
    .update(tasks)
    .set({
      title: body.title?.trim() || current.title,
      description: body.description ?? current.description,
      priority: body.priority ?? current.priority,
      dueDate: simpleMode ? null : (body.dueDate ?? current.dueDate),
      simpleMode,
      bucket: body.bucket ?? current.bucket,
      projectId: nextProjectId,
      order: body.order ?? current.order,
      completed,
      status: normalizeStatusOnCompletion(status, completed),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tasks.id, taskId));

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

  const now = new Date().toISOString();
  await db
    .update(tasks)
    .set({
      deletedAt: now,
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId));

  return true;
}
