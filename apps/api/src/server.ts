import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import corsPlugin from './plugins/cors.js';
import healthRoutes from './routes/health.js';
import taskRoutes from './routes/tasks.js';
import { auth } from './lib/auth.js';
import { getCorsOrigins } from './lib/auth-origins.js';
import { fromNodeHeaders } from 'better-auth/node';

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

function applyAuthCorsHeaders(reply: { header: (name: string, value: string | string[]) => unknown }, origin: string | undefined) {
    if (!origin || !getCorsOrigins().includes(origin)) {
        return;
    }

    reply.header('access-control-allow-origin', origin);
    reply.header('access-control-allow-credentials', 'true');
    reply.header('vary', 'Origin');
}

export async function buildApp() {
    const app = Fastify({ logger: true });

    // ─── Plugins ──────────────────────────────────────────────────────────────
    await app.register(corsPlugin);

    // Register Better Auth handler
    app.options("/auth/*", async (request, reply) => {
        const origin = request.headers.origin;
        if (origin && getCorsOrigins().includes(origin)) {
            applyAuthCorsHeaders(reply, origin);
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
        url: "/auth/*",
        handler: async (request, reply) => {
            applyAuthCorsHeaders(reply, request.headers.origin);
            const headers = toHeaders(request.headers);
            const protocol = request.protocol ?? 'http';
            const host = request.headers.host ?? 'localhost';
            const url = new URL(request.url, `${protocol}://${host}`);
            const body = getRequestBody(request.method, request.body, headers);
            const response = await auth.handler(new Request(url, {
                method: request.method,
                headers,
                body,
            }));

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

    // Example protected route showing session retrieval
    app.get("/me", async (request, reply) => {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(request.headers)
        });
        if (!session) return reply.code(401).send({ error: "Unauthorized" });
        return { user: session.user };
    });

    // ─── Routes ───────────────────────────────────────────────────────────────
    await app.register(healthRoutes);
    await app.register(taskRoutes);

    // ─── Root ─────────────────────────────────────────────────────────────────
    app.get('/', async () => {
        return { name: 'Yotara API', version: '0.1.0' };
    });

    return app;
}

export async function startServer() {
    const app = await buildApp();
    const port = Number(process.env['PORT'] ?? 3000);
    const host = process.env['HOST'] ?? '0.0.0.0';

    try {
        await app.listen({ port, host });
        console.log(`\nYotara API -> http://localhost:${port}\n`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

const isEntryPoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntryPoint) {
    await startServer();
}
