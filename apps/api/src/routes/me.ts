import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { authCookieSecurity, errorResponseSchema, withJsonResponse } from '../docs/openapi.js';
import { sendUnauthorized } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import { toPublicUser } from '../lib/public-user.js';

export default async function meRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get(
    '/me',
    {
      schema: withJsonResponse({
        tags: ['auth'],
        summary: 'Get the current authenticated user',
        security: authCookieSecurity,
        response: {
          200: {
            description: 'Authenticated user',
            $ref: 'MeResponse#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return sendUnauthorized(reply);
      }

      return { user: toPublicUser(user) };
    },
  );

  fastify.patch<{
    Body: { workspaceMode?: 'personal' | 'team'; onboardingCompleted?: boolean };
    Reply: { user: ReturnType<typeof toPublicUser> } | { message: string };
  }>(
    '/me',
    {
      schema: withJsonResponse({
        tags: ['auth'],
        summary: 'Update the current authenticated user',
        security: authCookieSecurity,
        body: {
          $ref: 'UpdateProfile#',
        },
        response: {
          200: {
            description: 'Updated user profile',
            $ref: 'MeResponse#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      await db
        .update(users)
        .set({
          workspaceMode: request.body.workspaceMode,
          onboardingCompleted: request.body.onboardingCompleted,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return sendUnauthorized(reply);
      }

      return { user: toPublicUser(user) };
    },
  );
}
