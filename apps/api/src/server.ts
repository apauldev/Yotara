import Fastify from 'fastify';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from '@fastify/rate-limit';
import { AppError } from './lib/app-error.js';
import corsPlugin from './plugins/cors.js';
import authBridgePlugin, { applyCorsHeaders } from './plugins/auth-bridge.js';
import { registerOpenApi } from './docs/openapi.js';
import healthRoutes from './routes/health.js';
import meRoutes from './routes/me.js';
import labelRoutes from './routes/labels.js';
import projectRoutes from './routes/projects.js';
import rootRoutes from './routes/root.js';
import taskRoutes from './routes/tasks.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await registerOpenApi(app);
  await app.register(corsPlugin);

  // Global rate limiting (read at registration time so tests can configure via env)
  const rateLimitMax = Number(process.env['RATE_LIMIT_MAX'] ?? 100);
  const rateLimitWindowMs = Number(process.env['RATE_LIMIT_WINDOW_MINUTES'] ?? 1) * 60 * 1000;
  await app.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: rateLimitWindowMs,
    keyGenerator: (request) => {
      const forwarded = request.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0]?.trim() || request.ip;
      }
      return request.ip;
    },
  });
  await app.register(authBridgePlugin);
  app.addHook('onRequest', async (request, reply) => {
    applyCorsHeaders(reply, request.headers.origin);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ message: error.message });
    }

    // Fastify validation errors and other known error shapes
    const known = error as { validation?: unknown; statusCode?: number; message?: string };
    if (known.validation) {
      return reply.code(400).send({ message: known.message ?? 'Validation error' });
    }
    if (known.statusCode && known.statusCode < 500) {
      return reply.code(known.statusCode).send({ message: known.message ?? 'Error' });
    }

    request.log.error(error);
    return reply.code(500).send({ message: 'Internal server error' });
  });

  await app.register(healthRoutes);
  await app.register(meRoutes);
  await app.register(labelRoutes);
  await app.register(projectRoutes);
  await app.register(taskRoutes);
  await app.register(rootRoutes);

  return app;
}

export async function startServer() {
  const app = await buildApp();
  const port = Number(process.env['PORT'] ?? 3000);
  const host = process.env['HOST'] ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`Yotara API listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await startServer();
}
