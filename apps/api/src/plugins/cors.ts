import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { getCorsOrigins } from '../lib/auth-origins.js';

/**
 * CORS plugin — allows the Angular dev server (localhost:4200) in development
 * and the configured origin in production.
 */
export default async function corsPlugin(fastify: FastifyInstance) {
    const origins = getCorsOrigins();

    await fastify.register(cors, {
        origin: origins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });
}
