import type { FastifyInstance } from 'fastify';
import { isLocalDevMode } from '../lib/dev-mode.js';
import { consumeResetLink } from '../lib/dev-reset-store.js';

export default async function devRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/dev/reset-link',
    {
      schema: {
        tags: ['dev'],
        summary: 'Retrieve a dev-mode password reset link',
        querystring: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
        response: {
          200: {
            type: 'object',
            required: ['url'],
            properties: { url: { type: 'string' } },
          },
          404: {
            type: 'object',
            required: ['message'],
            properties: { message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      if (!isLocalDevMode()) {
        return reply.code(404).send({ message: 'Not found' });
      }

      const { email } = request.query as { email: string };
      const url = consumeResetLink(email);

      if (!url) {
        return reply.code(404).send({ message: 'No pending reset link for this email' });
      }

      return { url };
    },
  );
}
