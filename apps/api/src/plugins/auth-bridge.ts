import type { FastifyInstance, FastifyReply } from 'fastify';
import { auth } from '../lib/auth.js';
import { getCorsOrigins } from '../lib/auth-origins.js';

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
      const headers = toHeaders(request.headers);
      const protocol = request.protocol ?? 'http';
      const host = request.headers.host ?? 'localhost';
      const url = new URL(request.url, `${protocol}://${host}`);
      const body = getRequestBody(request.method, request.body, headers);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          body,
        }),
      );

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
