import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

/**
 * CORS plugin — allows the Angular dev server (localhost:4200) in development
 * and the configured origin in production.
 */
export default async function corsPlugin(fastify: FastifyInstance) {
    const isProd = process.env['NODE_ENV'] === 'production';
    const origin = process.env['CORS_ORIGIN'] ?? (isProd ? false : 'http://localhost:4200');

    await fastify.register(cors, {
        origin,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });
}
