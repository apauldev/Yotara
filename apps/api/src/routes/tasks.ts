import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CreateTaskDto, Task, TaskStatus, UpdateTaskDto } from '@yotara/shared';
import { auth } from '../lib/auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { db } from '../db/client.js';
import { tasks } from '../db/schema.js';
import {
  authCookieSecurity,
  errorResponseSchema,
  idParamSchema,
  withJsonResponse,
} from '../docs/openapi.js';

function toTask(task: typeof tasks.$inferSelect): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status as TaskStatus,
    priority: task.priority as 'low' | 'medium' | 'high',
    completed: task.completed,
    dueDate: task.dueDate ?? undefined,
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

async function requireUserId(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  return session?.user.id ?? null;
}

/**
 * Tasks routes backed by SQLite via Drizzle.
 */
export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: Task[] | { message: string } }>(
    '/tasks',
    {
      schema: withJsonResponse({
        tags: ['tasks'],
        summary: 'List tasks',
        security: authCookieSecurity,
        response: {
          200: {
            description: 'Tasks for the authenticated user',
            type: 'array',
            items: { $ref: 'Task#' },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request, reply) => {
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, userId))
        .orderBy(asc(tasks.order), asc(tasks.createdAt));
      return rows.map(toTask);
    },
  );

  fastify.get<{ Params: { id: string }; Reply: Task | { message: string } }>(
    '/tasks/:id',
    {
      schema: withJsonResponse({
        tags: ['tasks'],
        summary: 'Fetch a single task',
        security: authCookieSecurity,
        params: idParamSchema(),
        response: {
          200: {
            description: 'Task found',
            $ref: 'Task#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Task was not found', 'Task not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const [row] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, request.params.id), eq(tasks.userId, userId)))
        .limit(1);

      if (!row) {
        return reply.code(404).send({ message: 'Task not found' });
      }

      return toTask(row);
    },
  );

  fastify.post<{ Body: CreateTaskDto; Reply: Task | { message: string } }>(
    '/tasks',
    {
      schema: withJsonResponse({
        tags: ['tasks'],
        summary: 'Create a task',
        security: authCookieSecurity,
        body: {
          $ref: 'CreateTaskDto#',
        },
        response: {
          201: {
            description: 'Task created',
            $ref: 'Task#',
          },
          400: errorResponseSchema('Invalid task payload', 'Task title is required'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          500: errorResponseSchema('Task could not be created', 'Failed to create task'),
        },
      }),
    },
    async (request, reply) => {
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const payload = normalizeCreatePayload(request.body);

      if (!payload.title) {
        return reply.code(400).send({ message: 'Task title is required' });
      }

      const now = new Date().toISOString();
      const id = randomUUID();

      await db.insert(tasks).values({
        id,
        userId,
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

      const [created] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .limit(1);
      if (!created) {
        return reply.code(500).send({ message: 'Failed to create task' });
      }

      return reply.code(201).send(toTask(created));
    },
  );

  fastify.patch<{ Params: { id: string }; Body: UpdateTaskDto; Reply: Task | { message: string } }>(
    '/tasks/:id',
    {
      schema: withJsonResponse({
        tags: ['tasks'],
        summary: 'Update a task',
        security: authCookieSecurity,
        params: idParamSchema(),
        body: {
          $ref: 'UpdateTaskDto#',
        },
        response: {
          200: {
            description: 'Task updated',
            $ref: 'Task#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Task was not found', 'Task not found'),
          500: errorResponseSchema('Task could not be updated', 'Failed to update task'),
        },
      }),
    },
    async (request, reply) => {
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const [existing] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, request.params.id), eq(tasks.userId, userId)))
        .limit(1);

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

      const [updated] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, request.params.id), eq(tasks.userId, userId)))
        .limit(1);
      if (!updated) {
        return reply.code(500).send({ message: 'Failed to update task' });
      }

      return toTask(updated);
    },
  );

  fastify.delete<{ Params: { id: string }; Reply: { ok: true } | { message: string } }>(
    '/tasks/:id',
    {
      schema: withJsonResponse({
        tags: ['tasks'],
        summary: 'Delete a task',
        security: authCookieSecurity,
        params: idParamSchema(),
        response: {
          200: {
            description: 'Task deleted',
            type: 'object',
            required: ['ok'],
            properties: {
              ok: { type: 'boolean' },
            },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Task was not found', 'Task not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const [row] = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, request.params.id), eq(tasks.userId, userId)))
        .limit(1);
      if (!row) {
        return reply.code(404).send({ message: 'Task not found' });
      }

      await db.delete(tasks).where(eq(tasks.id, request.params.id));
      return { ok: true };
    },
  );
}
