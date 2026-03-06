import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { CreateTaskDto, Task, TaskStatus, UpdateTaskDto } from '@yotara/shared';
import { db } from '../db/client.js';
import { tasks } from '../db/schema.js';

function toTask(task: typeof tasks.$inferSelect): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status,
    priority: task.priority,
    completed: task.completed,
    dueDate: task.dueDate ?? undefined,
    projectId: undefined,
    assigneeId: undefined,
    parentTaskId: undefined,
    labels: undefined,
    order: task.order,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function normalizeCreatePayload(body: CreateTaskDto): CreateTaskDto {
  return {
    ...body,
    title: body.title.trim(),
    status: body.status ?? 'inbox',
    priority: body.priority ?? 'medium',
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

/**
 * Tasks routes backed by SQLite via Drizzle.
 */
export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: Task[] }>('/tasks', async () => {
    const rows = await db.select().from(tasks).orderBy(asc(tasks.order), asc(tasks.createdAt));
    return rows.map(toTask);
  });

  fastify.get<{ Params: { id: string }; Reply: Task | { message: string } }>('/tasks/:id', async (request, reply) => {
    const [row] = await db.select().from(tasks).where(eq(tasks.id, request.params.id)).limit(1);

    if (!row) {
      return reply.code(404).send({ message: 'Task not found' });
    }

    return toTask(row);
  });

  fastify.post<{ Body: CreateTaskDto; Reply: Task | { message: string } }>('/tasks', async (request, reply) => {
    const payload = normalizeCreatePayload(request.body);

    if (!payload.title) {
      return reply.code(400).send({ message: 'Task title is required' });
    }

    const now = new Date().toISOString();
    const id = randomUUID();

    await db.insert(tasks).values({
      id,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate,
      completed: false,
      order: 0,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!created) {
      return reply.code(500).send({ message: 'Failed to create task' });
    }

    return reply.code(201).send(toTask(created));
  });

  fastify.patch<{ Params: { id: string }; Body: UpdateTaskDto; Reply: Task | { message: string } }>(
    '/tasks/:id',
    async (request, reply) => {
      const [existing] = await db.select().from(tasks).where(eq(tasks.id, request.params.id)).limit(1);

      if (!existing) {
        return reply.code(404).send({ message: 'Task not found' });
      }

      const patch = request.body;
      const status = patch.status ?? existing.status;
      const completed = patch.completed ?? existing.completed;

      await db
        .update(tasks)
        .set({
          title: patch.title?.trim() || existing.title,
          description: patch.description ?? existing.description,
          priority: patch.priority ?? existing.priority,
          dueDate: patch.dueDate ?? existing.dueDate,
          order: patch.order ?? existing.order,
          completed,
          status: normalizeStatusOnCompletion(status, completed),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, request.params.id));

      const [updated] = await db.select().from(tasks).where(eq(tasks.id, request.params.id)).limit(1);
      if (!updated) {
        return reply.code(500).send({ message: 'Failed to update task' });
      }

      return toTask(updated);
    },
  );

  fastify.delete<{ Params: { id: string }; Reply: { ok: true } | { message: string } }>('/tasks/:id', async (request, reply) => {
    const existing = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, request.params.id))
      .limit(1);

    if (existing.length === 0) {
      return reply.code(404).send({ message: 'Task not found' });
    }

    await db.delete(tasks).where(eq(tasks.id, request.params.id));
    return { ok: true };
  });
}
