import type { FastifyInstance } from 'fastify';
import type { CreateProjectDto, Project, Task, UpdateProjectDto } from '@yotara/shared';
import {
  authCookieSecurity,
  errorResponseSchema,
  idParamSchema,
  withJsonResponse,
} from '../docs/openapi.js';
import { sendNotFound, sendUnauthorized } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import { toProject } from './project-utils.js';
import {
  createProjectForOwner,
  getProjectForOwner,
  listProjectsForOwner,
  listTasksForProject,
  updateProjectForOwner,
} from '../services/project-service.js';
import { toTask } from '../services/task-service.js';

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{ Reply: Project[] | { message: string } }>(
    '/projects',
    {
      schema: withJsonResponse({
        tags: ['projects'],
        summary: 'List projects',
        security: authCookieSecurity,
        response: {
          200: {
            description: 'Projects for the authenticated user ordered by last update',
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

      const rows = await listProjectsForOwner(userId);
      return rows.map(toProject);
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

      return rows.map((row) => toTask(row));
    },
  );
}
