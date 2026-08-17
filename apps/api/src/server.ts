import Fastify from 'fastify';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from '@fastify/rate-limit';
import { AppError } from './lib/app-error.js';
import { assertAuthSecretConfigured } from './lib/auth-secret.js';
import corsPlugin from './plugins/cors.js';
import authBridgePlugin, { applyCorsHeaders } from './plugins/auth-bridge.js';
import { registerOpenApi } from './docs/openapi.js';
import { startUnverifiedCleanupJob } from './lib/email-cleanup.js';
import { getTrustedProxy } from './lib/trusted-proxy.js';
import healthRoutes from './routes/health.js';
import meRoutes from './routes/me.js';
import configRoutes from './routes/config.js';
import labelRoutes from './routes/labels.js';
import notificationRoutes from './routes/notifications.js';
import projectRoutes from './routes/projects.js';
import rootRoutes from './routes/root.js';
import searchRoutes from './routes/search.js';
import taskRoutes from './routes/tasks.js';

// Content-Security-Policy — single source of truth for the API and nginx.
// nginx reads it via the CONTENT_SECURITY_POLICY env var (injected at container
// start from this same value), so there is only one copy to update. HSTS is
// intentionally omitted from the generic set — it only belongs behind TLS
// termination; add it once nginx serves HTTPS.
export const CONTENT_SECURITY_POLICY =
  process.env['CONTENT_SECURITY_POLICY'] ??
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; connect-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

// Defense-in-depth security headers. The CSP is shared with nginx (above); the
// remaining three are stable and only set here.
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
};

export async function buildApp() {
  // Fail fast if Better Auth has no strong secret in production. Session
  // tokens are HMAC-signed with this secret, so a missing/weak value lets
  // anyone forge sessions for any account. Better Auth reads
  // BETTER_AUTH_SECRET from the env by default; this guard is defense-in-depth
  // in case auth.ts is not imported first.
  assertAuthSecretConfigured();

  // Trust forwarded client IPs only from explicitly configured proxy addresses.
  // Direct API deployments default to no proxy trust, so client-supplied
  // X-Forwarded-For headers cannot control rate-limit or auth-abuse keys.
  const app = Fastify({ logger: true, trustProxy: getTrustedProxy() });

  await registerOpenApi(app);
  await app.register(corsPlugin);

  // Global rate limiting (read at registration time so tests can configure via env).
  // request.ip is derived from the socket address unless it comes through a
  // configured trusted proxy.
  const rateLimitMax = Number(process.env['RATE_LIMIT_MAX'] ?? 200);
  const rateLimitWindowMs = Number(process.env['RATE_LIMIT_WINDOW_MINUTES'] ?? 1) * 60 * 1000;
  await app.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: rateLimitWindowMs,
    keyGenerator: (request) => request.ip,
  });
  await app.register(authBridgePlugin);
  app.addHook('onRequest', async (request, reply) => {
    applyCorsHeaders(reply, request.headers.origin);
  });

  // Apply security headers on every response, even when the API is reached
  // directly (dev / bare deploy) without the nginx front. Mirrors docker/nginx.conf.
  app.addHook('onSend', (_request, reply, _payload, done) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (reply.getHeader(name) === undefined) {
        reply.header(name, value);
      }
    }
    done();
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
  await app.register(configRoutes);
  await app.register(meRoutes);
  await app.register(labelRoutes);
  await app.register(notificationRoutes);
  await app.register(projectRoutes);
  await app.register(searchRoutes);
  await app.register(taskRoutes);
  await app.register(rootRoutes);

  return app;
}

export async function startServer() {
  const app = await buildApp();
  const port = Number(process.env['PORT'] ?? 3000);
  const host = process.env['HOST'] ?? '0.0.0.0';

  // Delete unverified accounts older than 24h (production or dev override).
  startUnverifiedCleanupJob();

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
