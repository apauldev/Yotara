import { eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { labels, projects, tasks, users } from '../db/schema.js';
import { authCookieSecurity, errorResponseSchema, withJsonResponse } from '../docs/openapi.js';
import { sendUnauthorized } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import { toPublicUser } from '../lib/public-user.js';
import { seedDefaultLabelsForOwner } from '../services/label-service.js';
import { seedDefaultProjectsForOwner } from '../services/project-service.js';
import { deleteAccountForUser, setPasswordForUser } from '../services/user-service.js';
import { emailVerificationRequired } from '../lib/auth.js';

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

  fastify.get(
    '/me/counts',
    {
      schema: withJsonResponse({
        tags: ['auth'],
        summary: 'Get counts of data that will be deleted with the account',
        security: authCookieSecurity,
        response: {
          200: {
            description: 'Data counts',
            type: 'object',
            required: ['tasks', 'projects', 'labels'],
            properties: {
              tasks: { type: 'integer', minimum: 0 },
              projects: { type: 'integer', minimum: 0 },
              labels: { type: 'integer', minimum: 0 },
            },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      /* istanbul ignore next — defensive guard, preHandler guarantees userId */
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const [taskCount] = await db
        .select({ value: sql<number>`count(*)` })
        .from(tasks)
        .where(eq(tasks.userId, userId));

      const [projectCount] = await db
        .select({ value: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.ownerId, userId));

      const [labelCount] = await db
        .select({ value: sql<number>`count(*)` })
        .from(labels)
        .where(eq(labels.userId, userId));

      return {
        tasks: taskCount?.value ?? 0,
        projects: projectCount?.value ?? 0,
        labels: labelCount?.value ?? 0,
      };
    },
  );

  fastify.patch<{
    Body: {
      workspaceMode?: 'personal' | 'team';
      onboardingCompleted?: boolean;
      archiveAutoDelete?: boolean;
      captureBehavior?: 'quick' | 'capture';
    };
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

      const profilePatch = {
        ...(request.body.workspaceMode !== undefined
          ? { workspaceMode: request.body.workspaceMode }
          : {}),
        ...(request.body.onboardingCompleted !== undefined
          ? { onboardingCompleted: request.body.onboardingCompleted }
          : {}),
        ...(request.body.archiveAutoDelete !== undefined
          ? { archiveAutoDelete: request.body.archiveAutoDelete }
          : {}),
        ...(request.body.captureBehavior !== undefined
          ? { captureBehavior: request.body.captureBehavior }
          : {}),
        updatedAt: new Date(),
      };

      await db.update(users).set(profilePatch).where(eq(users.id, userId));

      if (request.body.workspaceMode === 'personal' && request.body.onboardingCompleted) {
        await seedDefaultProjectsForOwner(userId);
        await seedDefaultLabelsForOwner(userId);
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        return sendUnauthorized(reply);
      }

      return { user: toPublicUser(user) };
    },
  );

  fastify.post<{
    Body: { newPassword: string };
    Reply: { ok: true } | { message: string };
  }>(
    '/me/password/set',
    {
      schema: withJsonResponse({
        tags: ['auth'],
        summary: 'Set a new password after email verification (no current password required)',
        security: authCookieSecurity,
        body: {
          type: 'object',
          required: ['newPassword'],
          properties: {
            newPassword: { type: 'string', minLength: 8, maxLength: 128 },
          },
        },
        response: {
          200: {
            description: 'Password set',
            type: 'object',
            required: ['ok'],
            properties: { ok: { type: 'boolean' } },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          403: errorResponseSchema('Email must be verified first', 'Email not verified'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      // Only allow setting the initial password once the email is verified —
      // this is the email-first signup completion step. In dev/test where
      // verification is not required, any authenticated user may set it.
      const [user] = await db
        .select({ emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) {
        return sendUnauthorized(reply);
      }
      if (emailVerificationRequired() && !user.emailVerified) {
        return reply
          .code(403)
          .send({ message: 'Email must be verified before setting a password.' });
      }

      const ok = await setPasswordForUser(userId, request.body.newPassword);
      if (!ok) {
        return sendUnauthorized(reply);
      }
      return { ok: true };
    },
  );

  fastify.delete<{
    Body: { password: string };
    Reply: { ok: true } | { message: string };
  }>(
    '/me',
    {
      config: {
        rateLimit: {
          max: Number(process.env['DELETE_ACCOUNT_RATE_LIMIT_MAX'] ?? 5),
          timeWindow:
            Number(process.env['DELETE_ACCOUNT_RATE_LIMIT_WINDOW_MINUTES'] ?? 15) * 60 * 1000,
          keyGenerator: (request) => {
            const cookie = request.headers.cookie ?? '';
            const match = cookie.match(/better-auth\.session_token=([^;]+)/);
            const token = match?.[1] ?? 'anonymous';
            return `${token}:${request.ip}`;
          },
        },
      },
      schema: withJsonResponse({
        tags: ['auth'],
        summary: 'Permanently delete the current user account and all data',
        security: authCookieSecurity,
        body: { $ref: 'DeleteAccount#' },
        response: {
          200: {
            description: 'Account deleted',
            type: 'object',
            required: ['ok'],
            properties: { ok: { type: 'boolean' } },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          403: errorResponseSchema('Password verification failed', 'Incorrect password'),
          429: errorResponseSchema('Too many deletion attempts', 'Too Many Requests'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) return sendUnauthorized(reply);

      const result = await deleteAccountForUser(userId, request.body.password);

      if (result.ok) return { ok: true };
      if (result.reason === 'invalid_password') {
        return reply.code(403).send({ message: 'Incorrect password' });
      }
      /* istanbul ignore next — defensive guard, user exists after auth check */
      return sendUnauthorized(reply);
    },
  );
}
