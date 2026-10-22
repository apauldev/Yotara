import type { FastifyInstance } from 'fastify';
import type {
  CreateLabelDto,
  Label,
  LabelMergeResult,
  MergeLabelDto,
  UpdateLabelDto,
} from '@yotara/shared';
import { authCookieSecurity, errorResponseSchema, withJsonResponse } from '../docs/openapi.js';
import { UnauthorizedError } from '../lib/app-error.js';
import { sendNotFound } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import {
  createLabelForOwner,
  deleteLabelForOwner,
  listLabelsForOwner,
  mergeLabelForOwner,
  updateLabelForOwner,
} from '../services/label-service.js';

export default async function labelRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{ Reply: Label[] | { message: string } }>(
    '/labels',
    {
      schema: withJsonResponse({
        tags: ['labels'],
        summary: 'List labels',
        security: authCookieSecurity,
        response: {
          200: {
            description: 'Labels for the authenticated user',
            type: 'array',
            items: { $ref: 'Label#' },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request) => {
      const userId = request.userId;
      if (!userId) {
        throw new UnauthorizedError();
      }
      // No default seeding here: GET /labels is a plain read. Deleting every
      // label must stay deleted on the next page load; new users get defaults
      // during onboarding (PATCH /me) only.
      return listLabelsForOwner(userId);
    },
  );

  fastify.post<{ Body: CreateLabelDto; Reply: Label | { message: string } }>(
    '/labels',
    {
      schema: withJsonResponse({
        tags: ['labels'],
        summary: 'Create label',
        security: authCookieSecurity,
        body: {
          $ref: 'CreateLabelDto#',
        },
        response: {
          201: { description: 'Label created', $ref: 'Label#' },
          400: errorResponseSchema('Label name is required or color is invalid', 'Bad request'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          409: errorResponseSchema('A label with the same name already exists', 'Duplicate label'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        throw new UnauthorizedError();
      }
      const created = await createLabelForOwner(userId, request.body);
      return reply.code(201).send(created as Label);
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: UpdateLabelDto;
    Reply: Label | { message: string };
  }>(
    '/labels/:id',
    {
      schema: withJsonResponse({
        tags: ['labels'],
        summary: 'Update label',
        security: authCookieSecurity,
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: { $ref: 'UpdateLabelDto#' },
        response: {
          200: { description: 'Label updated', $ref: 'Label#' },
          400: errorResponseSchema('Label name is required or color is invalid', 'Bad request'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Label was not found', 'Label not found'),
          409: errorResponseSchema('A label with the same name already exists', 'Duplicate label'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        throw new UnauthorizedError();
      }
      const updated = await updateLabelForOwner(userId, request.params.id, request.body);
      if (!updated) {
        return sendNotFound(reply, 'Label not found');
      }

      return updated as Label;
    },
  );

  fastify.post<{
    Params: { id: string };
    Body: MergeLabelDto;
    Reply: LabelMergeResult | { message: string };
  }>(
    '/labels/:id/merge',
    {
      schema: withJsonResponse({
        tags: ['labels'],
        summary: 'Merge a label into another',
        description:
          'Moves every task association from this label to the target label, then deletes this label. Tasks are never deleted.',
        security: authCookieSecurity,
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: { $ref: 'MergeLabelDto#' },
        response: {
          200: { description: 'Label merged', $ref: 'LabelMergeResult#' },
          400: errorResponseSchema('A label cannot be merged into itself', 'Bad request'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Label was not found', 'Label not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        throw new UnauthorizedError();
      }

      const result = mergeLabelForOwner(userId, request.params.id, request.body.targetId);
      if (!result) {
        return sendNotFound(reply, 'Label not found');
      }

      return result;
    },
  );

  fastify.delete<{ Params: { id: string }; Reply: { ok: true } | { message: string } }>(
    '/labels/:id',
    {
      schema: withJsonResponse({
        tags: ['labels'],
        summary: 'Delete label',
        security: authCookieSecurity,
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            description: 'Label deleted',
            type: 'object',
            required: ['ok'],
            properties: { ok: { type: 'boolean' } },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Label was not found', 'Label not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        throw new UnauthorizedError();
      }
      const deleted = await deleteLabelForOwner(userId, request.params.id);
      if (!deleted) {
        return sendNotFound(reply, 'Label not found');
      }

      return { ok: true };
    },
  );
}
