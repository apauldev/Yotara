import type { FastifyInstance } from 'fastify';
import type { Task } from '@yotara/shared';

/**
 * Tasks routes — placeholder data until Drizzle + SQLite is wired up.
 */
export default async function taskRoutes(fastify: FastifyInstance) {
    fastify.get<{ Reply: Task[] }>('/tasks', async () => {
        const tasks: Task[] = [
            {
                id: '1',
                title: 'Set up the monorepo',
                description: 'Angular + Fastify + pnpm workspaces',
                status: 'done',
                priority: 'high',
                completed: true,
                order: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: '2',
                title: 'Build task capture UI',
                status: 'today',
                priority: 'high',
                completed: false,
                order: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
            {
                id: '3',
                title: 'Add Drizzle ORM + SQLite',
                status: 'upcoming',
                priority: 'medium',
                completed: false,
                order: 2,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        ];

        return tasks;
    });
}
