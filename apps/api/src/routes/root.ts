import type { FastifyInstance } from 'fastify';

export default async function rootRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      schema: {
        tags: ['meta'],
        summary: 'Get API metadata',
        response: {
          200: {
            type: 'object',
            required: ['name', 'version'],
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
      return { name: 'Yotara API', version: '0.1.0' };
    },
  );
}
