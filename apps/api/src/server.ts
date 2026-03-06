import Fastify from 'fastify';
import { fileURLToPath } from 'node:url';
import corsPlugin from './plugins/cors.js';
import healthRoutes from './routes/health.js';
import taskRoutes from './routes/tasks.js';
import { auth } from './lib/auth.js';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';

export async function buildApp() {
    const app = Fastify({ logger: true });

    // ─── Plugins ──────────────────────────────────────────────────────────────
    await app.register(corsPlugin);

    // Register Better Auth handler
    app.all("/auth/*", async (request, reply) => {
        const authHandler = toNodeHandler(auth);
        await authHandler(request.raw, reply.raw);
        reply.hijack();
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
