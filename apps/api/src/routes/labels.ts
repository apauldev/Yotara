import type { FastifyInstance } from 'fastify';
import type { CreateLabelDto, Label, UpdateLabelDto } from '@yotara/shared';
import { authCookieSecurity, errorResponseSchema, withJsonResponse } from '../docs/openapi.js';
import { sendNotFound } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import {
  createLabelForOwner,
  deleteLabelForOwner,
  listLabelsForOwner,
  seedDefaultLabelsForOwner,
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
      const userId = request.userId!;
      await seedDefaultLabelsForOwner(userId);
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
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId!;
      const created = await createLabelForOwner(userId, request.body);
      return reply.code(201).send(created as Label);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: UpdateLabelDto; Reply: Label | { message: string } }>(
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
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Label was not found', 'Label not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId!;
      const updated = await updateLabelForOwner(userId, request.params.id, request.body);
      if (!updated) {
        return sendNotFound(reply, 'Label not found');
      }

      return updated as Label;
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
      const userId = request.userId!;
      const deleted = await deleteLabelForOwner(userId, request.params.id);
      if (!deleted) {
        return sendNotFound(reply, 'Label not found');
      }

      return { ok: true };
    },
  );
}
