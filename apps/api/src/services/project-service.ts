import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { CreateProjectDto, ProjectColor, UpdateProjectDto } from '@yotara/shared';
import { DEFAULT_PROJECTS } from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { projects, tasks } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { getLabelsForTasks } from './label-service.js';
import {
  normalizeProjectCreatePayload,
  normalizeProjectUpdatePayload,
} from '../routes/project-utils.js';

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

/** A project the onboarding seeder may insert. */
export interface ProjectSeed {
  name: string;
  description?: string;
  color?: ProjectColor;
}

/**
 * Seeds the supplied starter projects (defaulting to the shared catalogue).
 * Callers must gate this on the onboarding-incomplete → complete transition;
 * it is not a read-path fallback, so later profile saves cannot recreate
 * renamed or removed starter projects.
 */
export function seedDefaultProjectsForOwner(
  ownerId: string,
  projectsToSeed: readonly ProjectSeed[] = DEFAULT_PROJECTS,
  tx?: Database,
) {
  if (projectsToSeed.length === 0) {
    return;
  }

  const client = tx ?? db;
  const existingNames = new Set(
    client
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.ownerId, ownerId))
      .all()
      .map((project) => project.name),
  );
  const missingProjects = projectsToSeed.filter((project) => !existingNames.has(project.name));

  if (missingProjects.length === 0) {
    return;
  }

  const now = nowIsoTimestamp();
  client
    .insert(projects)
    .values(
      missingProjects.map((project) => ({
        id: randomUUID(),
        ownerId,
        name: project.name,
        description: project.description ?? null,
        color: project.color ?? null,
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

  const labelsMap = await getLabelsForTasks(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, labels: labelsMap.get(row.id) ?? [] }));
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
