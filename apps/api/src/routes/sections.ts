import type { FastifyInstance } from 'fastify';
import type {
  CreateProjectSectionDto,
  ProjectSection,
  ReorderProjectSectionsDto,
  UpdateProjectSectionDto,
} from '@yotara/shared';
import {
  authCookieSecurity,
  errorResponseSchema,
  idParamSchema,
  withJsonResponse,
} from '../docs/openapi.js';
import { sendBadRequest, sendNotFound, sendUnauthorized } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import {
  createSectionForProject,
  deleteSectionForOwner,
  listSectionsForProject,
  reorderSectionsForOwner,
  updateSectionForOwner,
} from '../services/section-service.js';

export default async function sectionRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{ Params: { projectId: string }; Reply: ProjectSection[] | { message: string } }>(
    '/projects/:projectId/sections',
    {
      schema: withJsonResponse({
        tags: ['project-sections'],
        summary: 'List sections for a project',
        security: authCookieSecurity,
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'Project identifier' } },
        },
        response: {
          200: {
            description: 'Sections in manual order',
            $ref: 'ProjectSectionsListResponse#',
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

      const sections = await listSectionsForProject(request.params.projectId, userId);
      if (!sections) {
        return sendNotFound(reply, 'Project not found');
      }

      return sections;
    },
  );

  fastify.post<{
    Params: { projectId: string };
    Body: CreateProjectSectionDto;
    Reply: ProjectSection | { message: string };
  }>(
    '/projects/:projectId/sections',
    {
      schema: withJsonResponse({
        tags: ['project-sections'],
        summary: 'Create a project section',
        security: authCookieSecurity,
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'Project identifier' } },
        },
        body: { $ref: 'CreateProjectSectionDto#' },
        response: {
          201: {
            description: 'Section created',
            $ref: 'ProjectSection#',
          },
          400: errorResponseSchema('Invalid section payload', 'Section name is required'),
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

      const section = await createSectionForProject(request.params.projectId, userId, request.body);
      if (!section) {
        const projectExists = await listSectionsForProject(request.params.projectId, userId);
        return projectExists
          ? sendBadRequest(reply, 'Section name is required')
          : sendNotFound(reply, 'Project not found');
      }

      return reply.code(201).send(section);
    },
  );

  fastify.patch<{
    Body: ReorderProjectSectionsDto;
    Reply: ProjectSection[] | { message: string };
  }>(
    '/sections/reorder',
    {
      schema: withJsonResponse({
        tags: ['project-sections'],
        summary: 'Reorder project sections',
        security: authCookieSecurity,
        body: { $ref: 'ReorderProjectSectionsDto#' },
        response: {
          200: {
            description: 'Sections in their new order',
            $ref: 'ProjectSectionsListResponse#',
          },
          400: errorResponseSchema('Invalid section order', 'Invalid section order'),
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

      const result = await reorderSectionsForOwner(
        request.body.projectId,
        userId,
        request.body.ids,
      );
      if (!result.ok) {
        const projectExists = await listSectionsForProject(request.body.projectId, userId);
        return projectExists
          ? sendBadRequest(reply, 'Invalid section order')
          : sendNotFound(reply, 'Project not found');
      }

      return result.sections;
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: UpdateProjectSectionDto;
    Reply: ProjectSection | { message: string };
  }>(
    '/sections/:id',
    {
      schema: withJsonResponse({
        tags: ['project-sections'],
        summary: 'Rename or reorder a project section',
        security: authCookieSecurity,
        params: idParamSchema('Section identifier'),
        body: { $ref: 'UpdateProjectSectionDto#' },
        response: {
          200: {
            description: 'Section updated',
            $ref: 'ProjectSection#',
          },
          400: errorResponseSchema('Invalid section payload', 'Section name is required'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Section was not found', 'Section not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      if (request.body.name !== undefined && !request.body.name.trim()) {
        return sendBadRequest(reply, 'Section name is required');
      }

      const section = await updateSectionForOwner(request.params.id, userId, request.body);
      if (!section) {
        return sendNotFound(reply, 'Section not found');
      }

      return section;
    },
  );

  fastify.delete<{ Params: { id: string }; Reply: { success: boolean } | { message: string } }>(
    '/sections/:id',
    {
      schema: withJsonResponse({
        tags: ['project-sections'],
        summary: 'Delete a project section and unsection its tasks',
        security: authCookieSecurity,
        params: idParamSchema('Section identifier'),
        response: {
          200: {
            description: 'Section deleted; its tasks remain in the project',
            type: 'object',
            required: ['success'],
            properties: {
              success: { type: 'boolean' },
            },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Section was not found', 'Section not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const deleted = await deleteSectionForOwner(request.params.id, userId);
      if (!deleted) {
        return sendNotFound(reply, 'Section not found');
      }

      return { success: true };
    },
  );
}
