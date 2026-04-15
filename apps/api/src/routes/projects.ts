import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CreateProjectDto, Project, Task, UpdateProjectDto } from '@yotara/shared';
import { db } from '../db/client.js';
import { projects, tasks } from '../db/schema.js';
import { auth } from '../lib/auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import {
  authCookieSecurity,
  errorResponseSchema,
  idParamSchema,
  withJsonResponse,
} from '../docs/openapi.js';
import {
  ensureOwnedProject,
  getProjectById,
  getProjectsForOwner,
  isValidProjectColor,
  normalizeProjectCreatePayload,
  normalizeProjectUpdatePayload,
  toProject,
} from './project-utils.js';
import { toTask } from './tasks.js';

async function requireUserId(request: FastifyRequest) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  return session?.user.id ?? null;
}

export default async function projectRoutes(fastify: FastifyInstance) {
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
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const rows = await getProjectsForOwner(userId);
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
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const payload = normalizeProjectCreatePayload(request.body);

      if (!payload.name) {
        return reply.code(400).send({ message: 'Project name is required' });
      }

      if (payload.color !== undefined && !isValidProjectColor(payload.color)) {
        return reply.code(400).send({ message: 'Project color is invalid' });
      }

      const now = new Date().toISOString();
      const id = randomUUID();

      await db.insert(projects).values({
        id,
        ownerId: userId,
        name: payload.name,
        description: payload.description ?? null,
        color: payload.color ?? null,
        createdAt: now,
        updatedAt: now,
      });

      const created = await getProjectById(id, userId);
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
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const project = await getProjectById(request.params.id, userId);
      if (!project) {
        return reply.code(404).send({ message: 'Project not found' });
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
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const existing = await ensureOwnedProject(request.params.id, userId);
      if (!existing) {
        return reply.code(404).send({ message: 'Project not found' });
      }

      const patch = normalizeProjectUpdatePayload(request.body);
      if (patch.name !== undefined && !patch.name) {
        return reply.code(400).send({ message: 'Project name is required' });
      }

      if (patch.color !== undefined && !isValidProjectColor(patch.color)) {
        return reply.code(400).send({ message: 'Project color is invalid' });
      }

      await db
        .update(projects)
        .set({
          name: patch.name ?? existing.name,
          description:
            request.body.description !== undefined
              ? (patch.description ?? null)
              : (existing.description ?? null),
          color: patch.color ?? existing.color ?? null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(projects.id, request.params.id));

      const updated = await getProjectById(request.params.id, userId);
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
      const userId = await requireUserId(request);
      if (!userId) {
        return reply.code(401).send({ message: 'Unauthorized' });
      }

      const existing = await ensureOwnedProject(request.params.id, userId);
      if (!existing) {
        return reply.code(404).send({ message: 'Project not found' });
      }

      const rows = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            eq(tasks.projectId, request.params.id),
            isNull(tasks.deletedAt),
          ),
        );

      return rows.map(toTask);
    },
  );
}
