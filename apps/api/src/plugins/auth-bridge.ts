import type { FastifyInstance, FastifyReply } from 'fastify';
import { auth } from '../lib/auth.js';
import { getCorsOrigins } from '../lib/auth-origins.js';
import {
  getRemainingLockoutSeconds,
  recordFailedAttempt,
  clearAttempts,
} from '../lib/login-lockout.js';
import { checkRateLimitOrThrow } from '../lib/email.js';
import { recordEmailSend } from '../lib/email-rate-limit.js';

function toHeaders(source: Record<string, string | string[] | undefined>) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

function getRequestBody(method: string, body: unknown, headers: Headers) {
  if (method === 'GET' || method === 'HEAD' || body == null) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return JSON.stringify(body);
}

/** Parse the request body into a Record, handling JSON strings. */
function parseRequestBody(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body as Record<string, unknown> | null;
}

export function applyCorsHeaders(reply: Pick<FastifyReply, 'header'>, origin: string | undefined) {
  if (!origin || !getCorsOrigins().includes(origin)) {
    return;
  }

  reply.header('access-control-allow-origin', origin);
  reply.header('access-control-allow-credentials', 'true');
  reply.header('vary', 'Origin');
}

export default async function authBridgePlugin(app: FastifyInstance) {
  app.options('/auth/*', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && getCorsOrigins().includes(origin)) {
      applyCorsHeaders(reply, origin);
      reply.header('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE');

      const requestedHeaders = request.headers['access-control-request-headers'];
      if (requestedHeaders) {
        reply.header('access-control-allow-headers', requestedHeaders);
      }
    }

    return reply.code(204).send();
  });

  app.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'],
    url: '/auth/*',
    handler: async (request, reply) => {
      applyCorsHeaders(reply, request.headers.origin);

      const url = new URL(
        request.url,
        `${request.protocol ?? 'http'}://${request.headers.host ?? 'localhost'}`,
      );
      const isSignIn = request.method === 'POST' && url.pathname.startsWith('/auth/sign-in');
      const isSignUp = request.method === 'POST' && url.pathname.startsWith('/auth/sign-up/email');
      const isForgetPassword =
        request.method === 'POST' && url.pathname.startsWith('/auth/request-password-reset');

      // Parse body once for all branches
      const parsedBody = parseRequestBody(request.body);
      if (request.method === 'POST' && parsedBody === null) {
        return reply.code(400).send({ message: 'Invalid JSON body' });
      }

      const loginEmail =
        isSignIn && parsedBody && typeof parsedBody.email === 'string' ? parsedBody.email : null;
      const actionEmail =
        (isSignUp || isForgetPassword) && parsedBody && typeof parsedBody.email === 'string'
          ? parsedBody.email
          : null;

      if (isSignIn && loginEmail) {
        const remaining = getRemainingLockoutSeconds(loginEmail);
        if (remaining > 0) {
          reply.header('Retry-After', String(remaining));
          return reply.code(429).send({
            message: 'Account temporarily locked. Too many failed login attempts. Try again later.',
            remainingAttempts: 0,
            retryAfterSeconds: remaining,
          });
        }
      }

      if (actionEmail) {
        const actionType = isSignUp ? ('signup' as const) : ('reset' as const);
        try {
          checkRateLimitOrThrow(actionEmail, actionType);
        } catch (err) {
          const error = err as { statusCode: number; retryAfterSeconds: number; message: string };
          reply.header('Retry-After', String(error.retryAfterSeconds));
          return reply.code(error.statusCode).send({
            message: error.message,
            remainingAttempts: 0,
            retryAfterSeconds: error.retryAfterSeconds,
          });
        }
      }

      const headers = toHeaders(request.headers);
      const body = getRequestBody(request.method, request.body, headers);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          body,
        }),
      );

      if (isSignIn && loginEmail) {
        if (response.status === 200) {
          clearAttempts(loginEmail);
        } else if (response.status === 401) {
          const result = recordFailedAttempt(loginEmail);
          if (result.locked) {
            reply.header('Retry-After', String(result.remainingLockoutSeconds));
            return reply.code(429).send({
              message: `Account locked due to too many failed login attempts. Try again in ${Math.ceil(result.remainingLockoutSeconds / 60)} minutes.`,
              remainingAttempts: 0,
              retryAfterSeconds: result.remainingLockoutSeconds,
            });
          }

          const message =
            result.remainingAttempts <= 1
              ? `Invalid email or password. ${result.remainingAttempts} attempt remaining.`
              : `Invalid email or password. ${result.remainingAttempts} attempts remaining.`;

          return reply.code(401).send({
            message,
            remainingAttempts: result.remainingAttempts,
          });
        }
      }

      // Record email send count for rate-limiting purposes (post-auth-response).
      // Record email sends synchronously after a 2xx response.
      // Note: email.ts callbacks (sendVerificationEmail / sendPasswordResetEmail) are
      // invoked by Better Auth via runInBackgroundOrAwait, so they can't be relied
      // on for synchronous rate-limit recording. This auth-bridge call is the
      // authoritative record point.
      if (
        actionEmail &&
        (isSignUp || isForgetPassword) &&
        response.status >= 200 &&
        response.status < 300
      ) {
        const actionType = isSignUp ? ('signup' as const) : ('reset' as const);
        recordEmailSend(actionEmail, actionType);
      }

      reply.code(response.status);

      response.headers.forEach((value, key) => {
        if (key === 'set-cookie') {
          reply.header(key, response.headers.getSetCookie());
          return;
        }

        reply.header(key, value);
      });

      const text = await response.text();
      return reply.send(text);
    },
  });
}
