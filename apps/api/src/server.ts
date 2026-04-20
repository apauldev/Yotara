import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import corsPlugin from './plugins/cors.js';
import authBridgePlugin, { applyCorsHeaders } from './plugins/auth-bridge.js';
import { registerOpenApi } from './docs/openapi.js';
import healthRoutes from './routes/health.js';
import meRoutes from './routes/me.js';
import projectRoutes from './routes/projects.js';
import rootRoutes from './routes/root.js';
import taskRoutes from './routes/tasks.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await registerOpenApi(app);
  await app.register(corsPlugin);
  await app.register(authBridgePlugin);
  app.addHook('onRequest', async (request, reply) => {
    applyCorsHeaders(reply, request.headers.origin);
  });

  await app.register(healthRoutes);
  await app.register(meRoutes);
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

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  await startServer();
}
