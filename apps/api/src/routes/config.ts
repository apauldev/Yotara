import type { FastifyInstance } from 'fastify';
import { emailVerificationRequired } from '../lib/auth.js';
import { devMode } from '../lib/dev-mode.js';

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
            required: ['requireEmailVerification', 'devMode'],
            properties: {
              requireEmailVerification: { type: 'boolean' },
              devMode: { type: 'boolean' },
            },
          },
        },
      },
    },
    async () => {
      return {
        requireEmailVerification: emailVerificationRequired(),
        devMode: devMode(),
      };
    },
  );
}
