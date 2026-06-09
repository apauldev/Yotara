import type { FastifyInstance } from 'fastify';
import type {
  CreateTaskDto,
  PaginatedResponse,
  Task,
  TaskStatus,
  UpdateTaskDto,
} from '@yotara/shared';
import {
  authCookieSecurity,
  errorResponseSchema,
  idParamSchema,
  withJsonResponse,
} from '../docs/openapi.js';
import { UnauthorizedError } from '../lib/app-error.js';
import { sendNotFound } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import { getProjectForOwner } from '../services/project-service.js';
import {
  createTaskForOwner,
  cleanupExpiredArchivedTasks,
  deleteTaskForOwner,
  getTaskForOwner,
  listSubtasks,
  listTasksForOwner,
  toTask,
  updateTaskForOwner,
} from '../services/task-service.js';

/**
 * Tasks routes backed by SQLite via Drizzle.
 */
export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);
  fastify.addHook('preHandler', async (request) => {
    if (!request.userId) {
      return;
    }

    await cleanupExpiredArchivedTasks(request.userId);
  });

  fastify.get<{
    Querystring: {
      page?: number;
      pageSize?: number;
      includeSubtasks?: boolean;
      parentId?: string;
      export?: boolean;
      status?: TaskStatus;
      completed?: string;
      overdue?: string;
    };
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
            includeSubtasks: { type: 'boolean', default: false },
            parentId: { type: 'string' },
            export: { type: 'boolean', default: false },
            status: { type: 'string', enum: ['inbox', 'today', 'upcoming', 'done', 'archived'] },
            completed: { type: 'string', enum: ['true', 'false'] },
            overdue: { type: 'string', enum: ['true', 'false'] },
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
      if (!request.userId) {
        throw new UnauthorizedError();
      }

      const userId = request.userId;
      const isExport = request.query.export === true;
      const page = Math.max(1, request.query.page ?? 1);
      const pageSize = isExport ? 10000 : Math.min(100, Math.max(1, request.query.pageSize ?? 50));
      const includeSubtasks = isExport ? true : String(request.query.includeSubtasks) === 'true';
      const parentId = request.query.parentId;

      const filters = {
        status: request.query.status,
        completed:
          request.query.completed === 'true'
            ? true
            : request.query.completed === 'false'
              ? false
              : undefined,
        overdue: request.query.overdue === 'true',
      };

      return listTasksForOwner(userId, page, pageSize, includeSubtasks, parentId, filters);
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
      if (!request.userId) {
        return sendNotFound(reply, 'Task not found');
      }

      const userId = request.userId;
      const row = await getTaskForOwner(request.params.id, userId);
      if (!row) {
        return sendNotFound(reply, 'Task not found');
      }

      const task = toTask(row, row.labels);
      const subtasks = await listSubtasks(request.params.id, userId);
      task.subtaskCount = subtasks.length;
      task.subtaskCompletedCount = subtasks.filter((s) => s.completed).length;

      return task;
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
      if (!request.userId) {
        return sendNotFound(reply, 'Project not found');
      }

      const userId = request.userId;
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
          400: errorResponseSchema('Invalid update payload', 'Bad request'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Task was not found', 'Task not found'),
          500: errorResponseSchema('Task could not be updated', 'Failed to update task'),
        },
      }),
    },
    async (request, reply) => {
      if (!request.userId) {
        return sendNotFound(reply, 'Task not found');
      }

      const userId = request.userId;
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
        summary: 'Delete a task forever',
        security: authCookieSecurity,
        params: idParamSchema(),
        response: {
          200: {
            description: 'Task deleted from the database',
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
      if (!request.userId) {
        return sendNotFound(reply, 'Task not found');
      }

      const userId = request.userId;
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
