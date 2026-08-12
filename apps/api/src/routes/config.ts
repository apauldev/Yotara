import type { FastifyInstance } from 'fastify';
import { emailVerificationRequired } from '../lib/auth.js';

export default async function configRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/config',
    {
      schema: {
        tags: ['meta'],
        summary: 'Get public client configuration',
        response: {
          200: {
            type: 'object',
            required: ['requireEmailVerification'],
            properties: {
              requireEmailVerification: { type: 'boolean' },
            },
          },
        },
      },
    },
    async () => {
      return {
        requireEmailVerification: emailVerificationRequired(),
      };
    },
  );
}
