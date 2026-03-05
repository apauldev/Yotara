import Fastify from 'fastify';
import corsPlugin from './plugins/cors.js';
import healthRoutes from './routes/health.js';
import taskRoutes from './routes/tasks.js';

const app = Fastify({ logger: true });


// ─── Plugins ──────────────────────────────────────────────────────────────────
await app.register(corsPlugin);

// ─── Routes ───────────────────────────────────────────────────────────────────
await app.register(healthRoutes);
await app.register(taskRoutes);

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get('/', async () => {
    return { name: 'Yotara API', version: '0.1.0' };
});

// ─── Start ────────────────────────────────────────────────────────────────────
const port = Number(process.env['PORT'] ?? 3000);
const host = process.env['HOST'] ?? '0.0.0.0';

try {
    await app.listen({ port, host });
    console.log(`\n🚀 Yotara API → http://localhost:${port}\n`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
