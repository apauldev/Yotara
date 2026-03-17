import type { FastifyInstance } from 'fastify';

/**
 * Health check route.
 * Used by Docker healthcheck and load balancers.
 */
export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['meta'],
        summary: 'Health check',
        response: {
          200: {
            type: 'object',
            required: ['status', 'timestamp'],
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    },
  );
}
