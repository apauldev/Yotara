import type { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  CalendarEventDto,
  CalendarSource,
  CalendarSyncStatus,
  CreateCalendarSourceDto,
  UpdateCalendarSourceDto,
} from '@yotara/shared';
import {
  authCookieSecurity,
  errorResponseSchema,
  idParamSchema,
  withJsonResponse,
} from '../docs/openapi.js';
import { sendNotFound, sendUnauthorized } from '../lib/api-errors.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';
import { assertCalendarDate } from '../lib/calendar-date.js';
import { BadRequestError } from '../lib/app-error.js';
import {
  createCalendarSourceForOwner,
  deleteCalendarSourceForOwner,
  getCalendarSourceForOwner,
  listCalendarSourcesForOwner,
  refreshCalendarSourceForOwner,
  updateCalendarSourceForOwner,
} from '../services/calendar-source-service.js';
import {
  CALENDAR_MAX_RANGE_DAYS,
  listCalendarEventsForOwner,
} from '../services/calendar-event-service.js';
import { resolveTimezone } from '../lib/timezone.js';

/**
 * The routes for connected calendar feeds and the events they carry.
 *
 * Every route is scoped to the authenticated user. A source belonging to
 * somebody else is a 404, not a 403 — the existence of another account's
 * source is not the caller's business.
 */

/** How often one user may add a source or ask for a manual refresh. */
const CALENDAR_WRITE_RATE_LIMIT_MAX = 10;
const CALENDAR_WRITE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * Rate-limit key for the write routes: the session, not the address.
 *
 * Several people can share an address behind a proxy, so the limit follows
 * the person rather than the network they happen to be on.
 */
function calendarRateLimitKey(request: FastifyRequest): string {
  const cookie = request.headers['cookie'];
  const header = Array.isArray(cookie) ? cookie.join(';') : (cookie ?? '');
  const match = String(header).match(/better-auth\.session_token=([^;]+)/);
  return match?.[1] ?? `anonymous:${request.ip}`;
}

export default async function calendarRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  const writeRouteConfig = {
    rateLimit: {
      max: CALENDAR_WRITE_RATE_LIMIT_MAX,
      timeWindow: CALENDAR_WRITE_RATE_LIMIT_WINDOW_MS,
      keyGenerator: calendarRateLimitKey,
    },
  };

  fastify.get<{ Reply: CalendarSource[] | { message: string } }>(
    '/calendar/sources',
    {
      schema: withJsonResponse({
        tags: ['calendar'],
        summary: 'List connected calendar sources',
        description:
          'The connected ICS feeds for the authenticated user. The feed URL is never returned — only the host it points at.',
        security: authCookieSecurity,
        response: {
          200: {
            description: 'The calendar sources for the authenticated user',
            type: 'array',
            items: { $ref: 'CalendarSource#' },
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

      return listCalendarSourcesForOwner(userId);
    },
  );

  fastify.post<{ Body: CreateCalendarSourceDto; Reply: CalendarSource | { message: string } }>(
    '/calendar/sources',
    {
      config: writeRouteConfig,
      schema: withJsonResponse({
        tags: ['calendar'],
        summary: 'Connect a calendar feed',
        description:
          'Fetches the ICS feed once and stores its events. The URL is a credential: it is stored encrypted and is never returned or logged.',
        security: authCookieSecurity,
        body: { $ref: 'CreateCalendarSource#' },
        response: {
          201: {
            description: 'Calendar connected',
            $ref: 'CalendarSource#',
          },
          400: errorResponseSchema('Invalid calendar payload', 'Bad request'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          409: errorResponseSchema('Calendar already connected', 'Calendar already connected'),
          422: errorResponseSchema('Calendar URL could not be used', 'Calendar could not be used'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const created = await createCalendarSourceForOwner(userId, request.body);
      return reply.code(201).send(created);
    },
  );

  fastify.patch<{
    Params: { id: string };
    Body: UpdateCalendarSourceDto;
    Reply: CalendarSource | { message: string };
  }>(
    '/calendar/sources/:id',
    {
      schema: withJsonResponse({
        tags: ['calendar'],
        summary: 'Update a calendar source',
        description: 'Changes the label, colour, or enabled state of a connected feed.',
        security: authCookieSecurity,
        params: idParamSchema('Calendar source identifier'),
        body: { $ref: 'UpdateCalendarSource#' },
        response: {
          200: {
            description: 'Calendar source updated',
            $ref: 'CalendarSource#',
          },
          400: errorResponseSchema('Invalid calendar payload', 'Bad request'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Calendar was not found', 'Calendar not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const existing = await getCalendarSourceForOwner(request.params.id, userId);
      if (!existing) {
        return sendNotFound(reply, 'Calendar not found');
      }

      const updated = await updateCalendarSourceForOwner(userId, request.params.id, request.body);
      if (!updated) {
        return sendNotFound(reply, 'Calendar not found');
      }

      return updated;
    },
  );

  fastify.delete<{ Params: { id: string }; Reply: { ok: true } | { message: string } }>(
    '/calendar/sources/:id',
    {
      schema: withJsonResponse({
        tags: ['calendar'],
        summary: 'Remove a calendar source',
        description: 'Deletes the source and the events it brought in.',
        security: authCookieSecurity,
        params: idParamSchema('Calendar source identifier'),
        response: {
          200: {
            description: 'Calendar source removed',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
                example: { ok: true },
              },
            },
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Calendar was not found', 'Calendar not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const removed = await deleteCalendarSourceForOwner(userId, request.params.id);
      if (!removed) {
        return sendNotFound(reply, 'Calendar not found');
      }

      return { ok: true };
    },
  );

  fastify.post<{ Params: { id: string }; Reply: CalendarSyncStatus | { message: string } }>(
    '/calendar/sources/:id/refresh',
    {
      config: writeRouteConfig,
      schema: withJsonResponse({
        tags: ['calendar'],
        summary: 'Refresh a calendar source now',
        description:
          'Fetches the feed and replaces the stored events. A failure leaves the last good events in place and reports the reason.',
        security: authCookieSecurity,
        params: idParamSchema('Calendar source identifier'),
        response: {
          200: {
            description: 'Refresh finished',
            $ref: 'CalendarSyncStatus#',
          },
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
          404: errorResponseSchema('Calendar was not found', 'Calendar not found'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const status = await refreshCalendarSourceForOwner(userId, request.params.id);
      return status;
    },
  );

  fastify.get<{
    Querystring: { from?: string; to?: string; tz?: string };
    Reply: CalendarEventDto[] | { message: string };
  }>(
    '/calendar/events',
    {
      schema: withJsonResponse({
        tags: ['calendar'],
        summary: 'List calendar events in a date range',
        description:
          'Events overlapping the range in the reader’s own zone. The days each event occupies and the times shown are projected by the server, so the client does no timezone arithmetic of its own.',
        security: authCookieSecurity,
        querystring: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: { type: 'string', format: 'date', description: 'First day of the range' },
            to: { type: 'string', format: 'date', description: 'Last day of the range' },
            tz: {
              type: 'string',
              description: 'The reader’s IANA timezone. Defaults to UTC.',
            },
          },
        },
        response: {
          200: {
            description: 'The events overlapping the range',
            type: 'array',
            items: { $ref: 'CalendarEvent#' },
          },
          400: errorResponseSchema('Invalid date range', 'Bad request'),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request, reply) => {
      const userId = request.userId;
      if (!userId) {
        return sendUnauthorized(reply);
      }

      const from = request.query.from ?? '';
      const to = request.query.to ?? '';

      try {
        assertCalendarDate(from, 'from');
        assertCalendarDate(to, 'to');
      } catch (error) {
        if (error instanceof BadRequestError) {
          return reply.code(400).send({ message: error.message });
        }
        throw error;
      }

      const spanDays = Math.round(
        (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
      );
      if (spanDays >= CALENDAR_MAX_RANGE_DAYS) {
        return reply.code(400).send({
          message: `The range may cover at most ${CALENDAR_MAX_RANGE_DAYS} days`,
        });
      }

      // An unknown zone falls back to UTC rather than guessing.
      const tz = resolveTimezone(request.query.tz) ?? 'UTC';

      return listCalendarEventsForOwner(userId, from, to, tz);
    },
  );
}
