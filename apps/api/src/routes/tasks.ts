import type { FastifyInstance } from 'fastify';
import type { CreateTaskDto, PaginatedResponse, Task, UpdateTaskDto } from '@yotara/shared';
import {
  authCookieSecurity,
  errorResponseSchema,
  idParamSchema,
  withJsonResponse,
} from '../docs/openapi.js';
import { sendNotFound } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import { getProjectForOwner } from '../services/project-service.js';
import {
  createTaskForOwner,
  deleteTaskForOwner,
  getTaskForOwner,
  listTasksForOwner,
  toTask,
  updateTaskForOwner,
} from '../services/task-service.js';

/**
 * Tasks routes backed by SQLite via Drizzle.
 */
export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{
    Querystring: { page?: number; pageSize?: number };
    Reply: PaginatedResponse<Task[]> | { message: string };
  }>(
    '/tasks',
    {
      schema: withJsonResponse({
        tags: ['tasks'],
        summary: 'List tasks',
        security: authCookieSecurity,
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
        response: {
          200: {
            description: 'Tasks for the authenticated user',
            $ref: 'PaginatedTasksResponse#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request) => {
      const userId = request.userId!;
      const page = Math.max(1, request.query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, request.query.pageSize ?? 50));
      return listTasksForOwner(userId, page, pageSize);
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
      const userId = request.userId!;
      const row = await getTaskForOwner(request.params.id, userId);
      if (!row) {
        return sendNotFound(reply, 'Task not found');
      }

      return toTask(row, row.labels);
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
          404: errorResponseSchema('Project was not found', 'Project not found'),
          500: errorResponseSchema('Task could not be created', 'Failed to create task'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId!;
      if (request.body.projectId) {
        const project = await getProjectForOwner(request.body.projectId, userId);
        if (!project) {
          return sendNotFound(reply, 'Project not found');
        }
      }

      const created = await createTaskForOwner(userId, request.body);
      if (!created) {
        return reply.code(500).send({ message: 'Failed to create task' });
      }

      return reply.code(201).send(toTask(created, created.labels));
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
      const userId = request.userId!;
      const existing = await getTaskForOwner(request.params.id, userId);
      if (!existing) {
        return sendNotFound(reply, 'Task not found');
      }

      if (request.body.projectId) {
        const project = await getProjectForOwner(request.body.projectId, userId);
        if (!project) {
          return sendNotFound(reply, 'Project not found');
        }
      }

      const updated = await updateTaskForOwner(userId, request.params.id, request.body, existing);
      if (!updated) {
        return reply.code(500).send({ message: 'Failed to update task' });
      }

      return toTask(updated, updated.labels);
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
      const userId = request.userId!;
      const existing = await getTaskForOwner(request.params.id, userId);
      if (!existing) {
        return sendNotFound(reply, 'Task not found');
      }

      const deleted = await deleteTaskForOwner(userId, request.params.id, existing);
      if (!deleted) {
        return sendNotFound(reply, 'Task not found');
      }

      return { ok: true };
    },
  );
}
