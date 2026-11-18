import type { FastifyInstance } from 'fastify';
import type { CreateProjectDto, Project, Task, UpdateProjectDto } from '@yotara/shared';
import {
  authCookieSecurity,
  errorResponseSchema,
  idParamSchema,
  withJsonResponse,
} from '../docs/openapi.js';
import { sendBadRequest, sendNotFound, sendUnauthorized } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import { toProject } from './project-utils.js';
import {
  archiveProjectForOwner,
  completeProjectForOwner,
  createProjectForOwner,
  deleteProjectForOwner,
  getProjectForOwner,
  listProjectsForOwner,
  listTasksForProject,
  reorderProjectsForOwner,
  reopenProjectForOwner,
  unarchiveProjectForOwner,
  updateProjectForOwner,
} from '../services/project-service.js';
import { toTask } from '../services/task-service.js';

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{
    Querystring: { status?: 'active' | 'completed' | 'archived' | 'all' };
    Reply: Project[] | { message: string };
  }>(
    '/projects',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'List projects',
        security: authCookieSecurity,
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'completed', 'archived', 'all'],
              description: 'Filter projects by lifecycle status',
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            description: 'Projects for the authenticated user',
            $ref: 'ProjectsListResponse#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const rows = await listProjectsForOwner(userId, { status: request.query.status });
      return rows.map(toProject);
    },
  );

  fastify.patch<{
    Body: { ids: string[] };
    Reply: Project[] | { message: string };
  }>(
    '/projects/reorder',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Reorder projects',
        security: authCookieSecurity,
        body: { $ref: 'ReorderProjectsDto#' },
        response: {
          200: {
            description: 'Projects in their new order',
            $ref: 'ProjectsListResponse#',
          },
          400: errorResponseSchema('Invalid project order', 'Invalid project order'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const result = await reorderProjectsForOwner(userId, request.body.ids);
      if (!result.ok) {
        return sendBadRequest(reply, 'Invalid project order');
      }

      return result.projects.map(toProject);
    },
  );

  fastify.post<{ Body: CreateProjectDto; Reply: Project | { message: string } }>(
    '/projects',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Create a project',
        security: authCookieSecurity,
        body: {
          $ref: 'CreateProjectDto#',
        },
        response: {
          201: {
            description: 'Project created',
            $ref: 'Project#',
          },
          400: errorResponseSchema('Invalid project payload', 'Project name is required'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          500: errorResponseSchema('Project could not be created', 'Failed to create project'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const created = await createProjectForOwner(userId, request.body);
      if (!created) {
        return reply.code(500).send({ message: 'Failed to create project' });
      }

      return reply.code(201).send(toProject(created));
    },
  );

  fastify.get<{ Params: { id: string }; Reply: Project | { message: string } }>(
    '/projects/:id',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Fetch a single project',
        security: authCookieSecurity,
        params: idParamSchema('Project identifier'),
        response: {
          200: {
            description: 'Project found',
            $ref: 'Project#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Project was not found', 'Project not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const project = await getProjectForOwner(request.params.id, userId);
      if (!project) {
        return sendNotFound(reply, 'Project not found');
      }

      return toProject(project);
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: UpdateProjectDto;
    Reply: Project | { message: string };
  }>(
    '/projects/:id',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Update a project',
        security: authCookieSecurity,
        params: idParamSchema('Project identifier'),
        body: {
          $ref: 'UpdateProjectDto#',
        },
        response: {
          200: {
            description: 'Project updated',
            $ref: 'Project#',
          },
          400: errorResponseSchema('Invalid project payload', 'Project name is required'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Project was not found', 'Project not found'),
          500: errorResponseSchema('Project could not be updated', 'Failed to update project'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const existing = await getProjectForOwner(request.params.id, userId);
      if (!existing) {
        return sendNotFound(reply, 'Project not found');
      }

      const updated = await updateProjectForOwner(
        userId,
        request.params.id,
        request.body,
        existing,
      );

      if (!updated) {
        return reply.code(500).send({ message: 'Failed to update project' });
      }

      return toProject(updated);
    },
  );

  fastify.post<{ Params: { id: string }; Reply: Project | { message: string } }>(
    '/projects/:id/complete',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Mark a project as completed',
        security: authCookieSecurity,
        params: idParamSchema('Project identifier'),
        response: {
          200: {
            description: 'Project marked as completed',
            $ref: 'Project#',
          },
          400: errorResponseSchema(
            'Cannot complete project',
            'Cannot complete project with remaining open tasks',
          ),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Project was not found', 'Project not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const result = await completeProjectForOwner(request.params.id, userId);
      if (!result.ok) {
        if (result.error === 'not_found') {
          return sendNotFound(reply, 'Project not found');
        }
        if (result.error === 'ongoing_area') {
          return sendBadRequest(reply, 'Ongoing areas cannot be completed');
        }
        return sendBadRequest(reply, 'Cannot complete project with remaining open tasks');
      }

      return toProject(result.project);
    },
  );

  fastify.post<{ Params: { id: string }; Reply: Project | { message: string } }>(
    '/projects/:id/reopen',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Reopen a completed project',
        security: authCookieSecurity,
        params: idParamSchema('Project identifier'),
        response: {
          200: {
            description: 'Project reopened',
            $ref: 'Project#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Project was not found', 'Project not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const reopened = await reopenProjectForOwner(request.params.id, userId);
      if (!reopened) {
        return sendNotFound(reply, 'Project not found');
      }

      return toProject(reopened);
    },
  );

  fastify.post<{ Params: { id: string }; Reply: Project | { message: string } }>(
    '/projects/:id/archive',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Archive a project',
        security: authCookieSecurity,
        params: idParamSchema('Project identifier'),
        response: {
          200: {
            description: 'Project archived',
            $ref: 'Project#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Project was not found', 'Project not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const archived = await archiveProjectForOwner(request.params.id, userId);
      if (!archived) {
        return sendNotFound(reply, 'Project not found');
      }

      return toProject(archived);
    },
  );

  fastify.post<{ Params: { id: string }; Reply: Project | { message: string } }>(
    '/projects/:id/unarchive',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Unarchive a project',
        security: authCookieSecurity,
        params: idParamSchema('Project identifier'),
        response: {
          200: {
            description: 'Project unarchived',
            $ref: 'Project#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Project was not found', 'Project not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const unarchived = await unarchiveProjectForOwner(request.params.id, userId);
      if (!unarchived) {
        return sendNotFound(reply, 'Project not found');
      }

      return toProject(unarchived);
    },
  );

  fastify.delete<{
    Params: { id: string };
    Querystring: { keepTasks?: boolean };
    Reply: { success: boolean } | { message: string };
  }>(
    '/projects/:id',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'Delete a project',
        security: authCookieSecurity,
        params: idParamSchema('Project identifier'),
        querystring: {
          type: 'object',
          properties: {
            keepTasks: {
              type: 'boolean',
              default: true,
              description: 'Whether to preserve tasks by unlinking them rather than soft-deleting',
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            description: 'Project deleted',
            type: 'object',
            required: ['success'],
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Project was not found', 'Project not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const keepTasks = request.query.keepTasks !== false;
      const deleted = await deleteProjectForOwner(request.params.id, userId, { keepTasks });
      if (!deleted) {
        return sendNotFound(reply, 'Project not found');
      }

      return { success: true };
    },
  );

  fastify.get<{ Params: { id: string }; Reply: Task[] | { message: string } }>(
    '/projects/:id/tasks',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'List tasks for a project',
        security: authCookieSecurity,
        params: idParamSchema('Project identifier'),
        response: {
          200: {
            description: 'Tasks assigned to the project',
            type: 'array',
            items: { $ref: 'Task#' },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Project was not found', 'Project not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const rows = await listTasksForProject(request.params.id, userId);
      if (!rows) {
        return sendNotFound(reply, 'Project not found');
      }

      return rows.map((row) => toTask(row, row.labels));
    },
  );
}
