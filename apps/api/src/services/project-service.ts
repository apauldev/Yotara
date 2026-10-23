import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { CreateProjectDto, UpdateProjectDto } from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { projects, tasks } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import {
  normalizeProjectCreatePayload,
  normalizeProjectUpdatePayload,
} from '../routes/project-utils.js';

const DEFAULT_PROJECTS = [
  {
    name: 'Work',
    description: 'Job, clients, and professional commitments.',
    color: 'deep-ocean',
  },
  { name: 'Personal', description: 'Appointments, paperwork, and everyday life.', color: 'clay' },
  { name: 'Home', description: 'Household tasks, maintenance, and upkeep.', color: 'olive' },
  { name: 'Health', description: 'Fitness, medical care, and wellbeing.', color: 'teal' },
  { name: 'Finance', description: 'Bills, budgets, and money admin.', color: 'forest' },
  {
    name: 'Learning',
    description: 'Courses, reading, and skill building.',
    color: 'deep-ocean',
  },
  {
    name: 'Side Projects',
    description: 'Creative work and independent projects.',
    color: 'clay',
  },
] as const;

type ProjectWithCountsRow = typeof projects.$inferSelect & {
  taskCount: number;
  completedTaskCount: number;
  openTaskCount: number;
};

async function loadProjectById(projectId: string, ownerId: string) {
  const [project] = await db
    .select({
      id: projects.id,
      ownerId: projects.ownerId,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`count(${tasks.id})`,
      completedTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 1 and ${tasks.deletedAt} is null then 1 else 0 end), 0)`,
      openTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 0 and ${tasks.deletedAt} is null then 1 else 0 end), 0)`,
    })
    .from(projects)
    .leftJoin(tasks, and(eq(tasks.projectId, projects.id), isNull(tasks.deletedAt)))
    .where(
      and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), isNull(projects.retiredAt)),
    )
    .groupBy(projects.id)
    .limit(1);

  return project as ProjectWithCountsRow | undefined;
}

/**
 * Seeds the starter set for accounts that have no projects. Callers must gate
 * this on the onboarding-incomplete → complete transition; it is not a read-path
 * fallback, so renamed or removed starter projects are never recreated.
 */
export function seedDefaultProjectsForOwner(ownerId: string, tx?: Database) {
  const client = tx ?? db;
  const existing = client
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .all();

  if (existing.length > 0) {
    return;
  }

  const now = nowIsoTimestamp();
  client
    .insert(projects)
    .values(
      DEFAULT_PROJECTS.map((project) => ({
        id: randomUUID(),
        ownerId,
        name: project.name,
        description: project.description,
        color: project.color,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .run();
}

export async function listProjectsForOwner(ownerId: string) {
  const rows = await db
    .select({
      id: projects.id,
      ownerId: projects.ownerId,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`count(${tasks.id})`,
      completedTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 1 and ${tasks.deletedAt} is null then 1 else 0 end), 0)`,
      openTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 0 and ${tasks.deletedAt} is null then 1 else 0 end), 0)`,
    })
    .from(projects)
    .leftJoin(tasks, and(eq(tasks.projectId, projects.id), isNull(tasks.deletedAt)))
    .where(and(eq(projects.ownerId, ownerId), isNull(projects.retiredAt)))
    .groupBy(projects.id)
    .orderBy(sql`${projects.updatedAt} desc`);

  return rows as ProjectWithCountsRow[];
}

export async function getProjectForOwner(projectId: string, ownerId: string) {
  return loadProjectById(projectId, ownerId);
}

export async function createProjectForOwner(ownerId: string, body: CreateProjectDto) {
  const payload = normalizeProjectCreatePayload(body);
  const now = nowIsoTimestamp();
  const id = randomUUID();

  await db.insert(projects).values({
    id,
    ownerId,
    name: payload.name,
    description: payload.description ?? null,
    color: payload.color ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return loadProjectById(id, ownerId);
}

export async function updateProjectForOwner(
  ownerId: string,
  projectId: string,
  body: UpdateProjectDto,
  existing?: ProjectWithCountsRow | null,
) {
  const current = existing ?? (await loadProjectById(projectId, ownerId));
  if (!current) {
    return null;
  }

  const patch = normalizeProjectUpdatePayload(body);

  await db
    .update(projects)
    .set({
      name: patch.name ?? current.name,
      description:
        body.description !== undefined
          ? (patch.description ?? null)
          : (current.description ?? null),
      color: patch.color ?? current.color ?? null,
      updatedAt: nowIsoTimestamp(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));

  return loadProjectById(projectId, ownerId);
}

export async function listTasksForProject(projectId: string, ownerId: string) {
  const project = await loadProjectById(projectId, ownerId);
  if (!project) {
    return null;
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, ownerId), eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));
  rows.sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
    if (createdAtOrder !== 0) {
      return createdAtOrder;
    }

    return left.id.localeCompare(right.id);
  });

  return rows;
}

export type WritableProjectResolution = { ok: true; projectId: string | null } | { ok: false };

/**
 * Resolve a client-supplied project id for a task write. An owned project that
 * has been retired resolves to `null` (unfiled) so stale clients keep working;
 * a missing or unowned id stays a 404 at the route boundary.
 */
export async function resolveProjectIdForTaskWrite(
  ownerId: string,
  projectId: string | null | undefined,
): Promise<WritableProjectResolution> {
  if (projectId == null) {
    return { ok: true, projectId: null };
  }

  const [row] = await db
    .select({ id: projects.id, retiredAt: projects.retiredAt })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);

  if (!row) {
    return { ok: false };
  }

  return { ok: true, projectId: row.retiredAt ? null : row.id };
}
