import type { FastifyInstance } from 'fastify';

/**
 * Health check route.
 * Used by Docker healthcheck and load balancers.
 */
export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}
