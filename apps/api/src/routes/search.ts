import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { Label, Project, SearchResponse, Task } from '@yotara/shared';
import { db } from '../db/client.js';
import { errorResponseSchema, withJsonResponse } from '../docs/openapi.js';
import { UnauthorizedError } from '../lib/app-error.js';
import requireAuthenticatedUser from '../plugins/auth-required.js';

interface TaskSearchRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  completed: number;
  due_date: string | null;
  simple_mode: number;
  bucket: string | null;
  project_id: string | null;
  parent_id: string | null;
  recurrence_rule: string | null;
  base_task_id: string | null;
  deleted_at: string | null;
  archived_at: string | null;
  permanent_archive: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  project_name: string | null;
  project_description: string | null;
  project_color: string | null;
  project_owner_id: string | null;
  project_created_at: string | null;
  project_updated_at: string | null;
  score: number;
}

interface ProjectSearchRow {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  task_count: number;
  completed_task_count: number;
  open_task_count: number;
  score: number;
}

interface LabelSearchRow {
  id: string;
  name: string;
  color: string;
  user_id: string;
  task_count: number;
  created_at: string | null;
  updated_at: string | null;
  score: number;
}

function normalizeQuery(value?: string | null): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function computeTaskMatchReasons(
  title: string,
  description: string | null,
  projectName: string | null,
  status: string,
  normalizedQuery: string,
): string[] {
  const reasons: string[] = [];
  const nl = normalizedQuery;
  const titleL = title.toLowerCase();
  const descL = (description ?? '').toLowerCase();
  const projL = (projectName ?? '').toLowerCase();
  const statL = status.toLowerCase();

  if (titleL.includes(nl)) reasons.push('title');
  if (descL.includes(nl)) reasons.push('description');
  if (projL.includes(nl)) reasons.push('project');
  if (statL.includes(nl)) reasons.push('status');

  return [...new Set(reasons)];
}

function computeProjectMatchReasons(
  name: string,
  description: string | null,
  normalizedQuery: string,
): string[] {
  const reasons: string[] = [];
  const nl = normalizedQuery;

  if (name.toLowerCase().includes(nl)) reasons.push('project');
  if ((description ?? '').toLowerCase().includes(nl)) reasons.push('description');

  return [...new Set(reasons)];
}

function computeLabelMatchReasons(name: string, _color: string, normalizedQuery: string): string[] {
  if (name.toLowerCase().includes(normalizedQuery)) {
    return ['label'];
  }
  return [];
}

function toTask(row: TaskSearchRow, labelIds: string[]): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    completed: !!row.completed,
    dueDate: row.due_date ?? undefined,
    simpleMode: !!row.simple_mode,
    bucket: (row.bucket as Task['bucket']) ?? undefined,
    projectId: row.project_id ?? undefined,
    parentId: row.parent_id ?? undefined,
    recurrenceRule: row.recurrence_rule
      ? (JSON.parse(row.recurrence_rule) as Task['recurrenceRule'])
      : undefined,
    baseTaskId: row.base_task_id ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    permanentArchive: !!row.permanent_archive,
    labels: labelIds,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toProject(row: ProjectSearchRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: (row.color as Project['color']) ?? undefined,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taskCount: row.task_count,
    completedTaskCount: row.completed_task_count,
    openTaskCount: row.open_task_count,
  };
}

function toLabel(row: LabelSearchRow): Label {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    userId: row.user_id,
    taskCount: row.task_count,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export default async function searchRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{
    Querystring: {
      q?: string;
      page?: number;
      pageSize?: number;
      completed?: string;
    };
    Reply: SearchResponse | { message: string };
  }>(
    '/tasks/search',
    {
      schema: withJsonResponse({
        tags: ['tasks'],
        summary: 'Search tasks, projects, and labels',
        description:
          'Full-text search across task titles, descriptions, project names, ' +
          'and label names. Results are sorted by relevance score.',
        security: [{ cookieAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', minLength: 1 },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            completed: { type: 'string', enum: ['true', 'false', 'all'] },
          },
          required: ['q'],
        },
        response: {
          200: {
            description: 'Search results',
            type: 'object',
            properties: {
              query: { type: 'string' },
              normalizedQuery: { type: 'string' },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    task: { $ref: 'Task#' },
                    project: { anyOf: [{ $ref: 'Project#' }, { type: 'null' }] },
                    score: { type: 'integer' },
                    matchReasons: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
              projects: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    project: { $ref: 'Project#' },
                    score: { type: 'integer' },
                    matchReasons: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
              labels: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { $ref: 'Label#' },
                    score: { type: 'integer' },
                    matchReasons: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          400: errorResponseSchema(
            'Missing or invalid search query',
            'Query parameter q is required',
          ),
          401: errorResponseSchema('Authentication required', 'Unauthorized'),
        },
      }),
    },
    async (request) => {
      if (!request.userId) {
        throw new UnauthorizedError();
      }

      const rawQuery = request.query.q ?? '';
      const normalizedQ = normalizeQuery(rawQuery);
      const page = Math.max(1, request.query.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, request.query.pageSize ?? 50));
      const offset = (page - 1) * pageSize;
      if (!normalizedQ) {
        return {
          query: rawQuery.trim(),
          normalizedQuery: '',
          tasks: [],
          projects: [],
          labels: [],
        } satisfies SearchResponse;
      }

      const likeQuery = `%${normalizedQ}%`;
      const startsWithQuery = `${normalizedQ}%`;

      const completedFilter = request.query.completed;
      const taskWhereCompleted =
        completedFilter === 'true'
          ? sql`t.deleted_at IS NULL AND t.completed = 1`
          : completedFilter === 'all'
            ? sql`t.deleted_at IS NULL`
            : sql`t.deleted_at IS NULL AND t.completed = 0`;

      const [taskRows, projectRows, labelRows] = await Promise.all([
        db.all<TaskSearchRow>(sql`
          SELECT
            t.*,
            p.name AS project_name,
            p.description AS project_description,
            p.color AS project_color,
            p.owner_id AS project_owner_id,
            p.created_at AS project_created_at,
            p.updated_at AS project_updated_at,
            MAX(
              CASE WHEN LOWER(t.title) = ${normalizedQ} THEN 120 ELSE 0 END
              + CASE WHEN LOWER(t.title) LIKE ${startsWithQuery} THEN 100 ELSE 0 END
              + CASE WHEN LOWER(t.title) LIKE ${likeQuery} THEN 80 ELSE 0 END
              + CASE WHEN LOWER(t.description) LIKE ${likeQuery} THEN 50 ELSE 0 END
              + CASE WHEN LOWER(p.name) LIKE ${likeQuery} THEN 70 ELSE 0 END
              + CASE WHEN LOWER(p.description) LIKE ${likeQuery} THEN 30 ELSE 0 END
              + CASE WHEN LOWER(l.name) LIKE ${likeQuery} THEN 60 ELSE 0 END
              + CASE WHEN LOWER(t.status) LIKE ${likeQuery} THEN 40 ELSE 0 END
            ) AS score
          FROM tasks t
          LEFT JOIN projects p ON t.project_id = p.id
          LEFT JOIN task_labels tl ON t.id = tl.task_id
          LEFT JOIN labels l ON tl.label_id = l.id
          WHERE t.user_id = ${request.userId} AND ${taskWhereCompleted}
            AND (
              LOWER(t.title) LIKE ${likeQuery}
              OR LOWER(t.description) LIKE ${likeQuery}
              OR LOWER(p.name) LIKE ${likeQuery}
              OR LOWER(l.name) LIKE ${likeQuery}
            )
          GROUP BY t.id
          HAVING score > 0
          ORDER BY score DESC, t.updated_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `),
        db.all<ProjectSearchRow>(sql`
          SELECT
            p.*,
            COALESCE(tc.task_count, 0) AS task_count,
            COALESCE(tc.completed_count, 0) AS completed_task_count,
            COALESCE(tc.open_count, 0) AS open_task_count,
            CASE WHEN LOWER(p.name) = ${normalizedQ} THEN 120
                 WHEN LOWER(p.name) LIKE ${startsWithQuery} THEN 100
                 WHEN LOWER(p.name) LIKE ${likeQuery} THEN 80
                 ELSE 0 END
            + CASE WHEN LOWER(p.description) LIKE ${likeQuery} THEN 35 ELSE 0 END
            AS score
          FROM projects p
          LEFT JOIN (
            SELECT project_id,
              COUNT(*) AS task_count,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_count,
              SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS open_count
            FROM tasks
            WHERE deleted_at IS NULL
            GROUP BY project_id
          ) tc ON p.id = tc.project_id
          WHERE p.owner_id = ${request.userId}
            AND (
              LOWER(p.name) LIKE ${likeQuery}
              OR LOWER(p.description) LIKE ${likeQuery}
            )
          ORDER BY score DESC, p.updated_at DESC
          LIMIT ${pageSize} OFFSET ${offset}
        `),
        db.all<LabelSearchRow>(sql`
          SELECT
            l.*,
            COALESCE(lc.task_count, 0) AS task_count,
            CASE WHEN LOWER(l.name) = ${normalizedQ} THEN 120
                 WHEN LOWER(l.name) LIKE ${startsWithQuery} THEN 100
                 WHEN LOWER(l.name) LIKE ${likeQuery} THEN 80
                 ELSE 0 END AS score
          FROM labels l
          LEFT JOIN (
            SELECT tl.label_id, COUNT(*) AS task_count
            FROM task_labels tl
            JOIN tasks t ON t.id = tl.task_id
            WHERE t.deleted_at IS NULL
            GROUP BY tl.label_id
          ) lc ON l.id = lc.label_id
          WHERE l.user_id = ${request.userId}
            AND LOWER(l.name) LIKE ${likeQuery}
          ORDER BY score DESC, l.name ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `),
      ]);

      const taskIds = taskRows.map((r) => r.id);
      const labelMap = new Map<string, string[]>();
      if (taskIds.length > 0) {
        const labelRows = await db.all<{ task_id: string; label_id: string }>(sql`
          SELECT task_id, label_id FROM task_labels
          WHERE task_id IN (${sql.join(taskIds, sql`, `)})
        `);
        for (const row of labelRows) {
          const ids = labelMap.get(row.task_id) ?? [];
          ids.push(row.label_id);
          labelMap.set(row.task_id, ids);
        }
      }

      const tasks: SearchResponse['tasks'] = taskRows.map((row) => {
        const project: Project | null = row.project_id
          ? ({
              id: row.project_id,
              name: row.project_name ?? '',
              description: row.project_description ?? undefined,
              color: (row.project_color ?? undefined) as Project['color'],
              ownerId: row.project_owner_id ?? '',
              createdAt: row.project_created_at ?? '',
              updatedAt: row.project_updated_at ?? '',
              taskCount: 0,
              completedTaskCount: 0,
              openTaskCount: 0,
            } satisfies Project)
          : null;

        return {
          task: toTask(row, labelMap.get(row.id) ?? []),
          project,
          score: row.score,
          matchReasons: computeTaskMatchReasons(
            row.title,
            row.description,
            row.project_name,
            row.status,
            normalizedQ,
          ),
        };
      });

      const projects: SearchResponse['projects'] = projectRows.map((row) => ({
        project: toProject(row),
        score: row.score,
        matchReasons: computeProjectMatchReasons(row.name, row.description, normalizedQ),
      }));

      const labels: SearchResponse['labels'] = labelRows.map((row) => ({
        label: toLabel(row),
        score: row.score,
        matchReasons: computeLabelMatchReasons(row.name, row.color, normalizedQ),
      }));

      return {
        query: rawQuery.trim(),
        normalizedQuery: normalizedQ,
        tasks,
        projects,
        labels,
      } satisfies SearchResponse;
    },
  );
}
