import type { FastifyInstance } from 'fastify';
import type { Task } from '@yotara/shared';

/**
 * Health check route.
 * Used by Docker healthcheck and load balancers.
 */
export default async function healthRoutes(fastify: FastifyInstance) {
    fastify.get('/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });
}
