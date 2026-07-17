import type { FastifyInstance } from 'fastify';
import type { Notification } from '@yotara/shared';
import { authCookieSecurity, errorResponseSchema, withJsonResponse } from '../docs/openapi.js';
import { UnauthorizedError } from '../lib/app-error.js';
import { sendNotFound } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import {
  clearReadForOwner,
  getNotificationsForOwner,
  getUnreadCountForOwner,
  markAllReadForOwner,
  markNotificationRead,
  scanDueNotifications,
} from '../services/notification-service.js';

function toNotification(row: import('../db/schema.js').DbNotification): Notification {
  return {
    id: row.id,
    taskId: row.taskId,
    type: row.type as Notification['type'],
    title: row.title,
    body: row.body || null,
    read: row.read,
    readAt: row.readAt || null,
    createdAt: row.createdAt,
  };
}

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{
    Querystring: { limit?: number; tz?: string };
    Reply: Notification[] | { message: string };
  }>(
    '/notifications',
    {
      schema: withJsonResponse({
        tags: ['notifications'],
        summary: 'List notifications',
        security: authCookieSecurity,
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            tz: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Notifications for the authenticated user',
            type: 'array',
            items: { $ref: 'Notification#' },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request) => {
      if (!request.userId) {
        throw new UnauthorizedError();
      }

      scanDueNotifications(request.userId, request.query.tz);
      const limit = Math.min(200, Math.max(1, request.query.limit ?? 50));
      const rows = getNotificationsForOwner(request.userId, limit);
      return rows.map(toNotification);
    },
  );

  fastify.get<{ Querystring: { tz?: string }; Reply: { count: number } | { message: string } }>(
    '/notifications/unread-count',
    {
      schema: withJsonResponse({
        tags: ['notifications'],
        summary: 'Get unread notification count',
        security: authCookieSecurity,
        querystring: {
          type: 'object',
          properties: {
            tz: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Unread count',
            type: 'object',
            required: ['count'],
            properties: {
              count: { type: 'integer', minimum: 0 },
            },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request) => {
      if (!request.userId) {
        throw new UnauthorizedError();
      }

      scanDueNotifications(request.userId, request.query.tz);
      const count = getUnreadCountForOwner(request.userId);
      return { count };
    },
  );

  fastify.patch<{ Reply: { ok: true } | { message: string } }>(
    '/notifications/read-all',
    {
      schema: withJsonResponse({
        tags: ['notifications'],
        summary: 'Mark all notifications as read',
        security: authCookieSecurity,
        response: {
          200: {
            description: 'All notifications marked as read',
            type: 'object',
            required: ['ok'],
            properties: {
              ok: { type: 'boolean' },
            },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request) => {
      if (!request.userId) {
        throw new UnauthorizedError();
      }

      markAllReadForOwner(request.userId);
      return { ok: true };
    },
  );

  fastify.patch<{ Params: { id: string }; Reply: Notification | { message: string } }>(
    '/notifications/:id/read',
    {
      schema: withJsonResponse({
        tags: ['notifications'],
        summary: 'Mark notification as read',
        security: authCookieSecurity,
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'Notification marked as read',
            $ref: 'Notification#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Notification was not found', 'Notification not found'),
        },
      }),
    },
    async (request, reply) => {
      if (!request.userId) {
        throw new UnauthorizedError();
      }

      const updated = markNotificationRead(request.params.id, request.userId);
      if (!updated) {
        return sendNotFound(reply, 'Notification not found');
      }

      return toNotification(updated);
    },
  );

  fastify.delete<{ Reply: { ok: true } | { message: string } }>(
    '/notifications/read',
    {
      schema: withJsonResponse({
        tags: ['notifications'],
        summary: 'Clear all read notifications',
        security: authCookieSecurity,
        response: {
          200: {
            description: 'Read notifications cleared',
            type: 'object',
            required: ['ok'],
            properties: {
              ok: { type: 'boolean' },
            },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request) => {
      if (!request.userId) {
        throw new UnauthorizedError();
      }

      clearReadForOwner(request.userId);
      return { ok: true };
    },
  );
}
