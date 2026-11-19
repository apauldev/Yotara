import { eq } from 'drizzle-orm';
import type { CreateTaskDto, TaskStatus } from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { users } from '../db/schema.js';
import { todayInTimezone } from '../lib/timezone.js';

export function normalizeCreatePayload(body: CreateTaskDto): CreateTaskDto {
  return {
    ...body,
    title: body.title.trim(),
    status: body.status ?? 'inbox',
    priority: body.priority ?? 'medium',
    dueDate: body.simpleMode ? undefined : body.dueDate,
    dueTime: body.simpleMode ? undefined : body.dueTime,
  };
}

export function normalizeStatusOnCompletion(
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

export function getArchiveAutoDeleteForOwner(ownerId: string, tx?: Database): boolean {
  const client = tx ?? db;
  const [row] = client
    .select({ archiveAutoDelete: users.archiveAutoDelete })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1)
    .all();

  return row?.archiveAutoDelete ?? true;
}
