import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { CreateProjectDto, UpdateProjectDto } from '@yotara/shared';
import { db } from '../db/client.js';
import { projects, tasks } from '../db/schema.js';
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
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .groupBy(projects.id)
    .limit(1);

  return project as ProjectWithCountsRow | undefined;
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
    .where(eq(projects.ownerId, ownerId))
    .groupBy(projects.id)
    .orderBy(sql`${projects.updatedAt} desc`);

  return rows as ProjectWithCountsRow[];
}

export async function getProjectForOwner(projectId: string, ownerId: string) {
  return loadProjectById(projectId, ownerId);
}

export async function createProjectForOwner(ownerId: string, body: CreateProjectDto) {
  const payload = normalizeProjectCreatePayload(body);
  const now = new Date().toISOString();
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
      updatedAt: new Date().toISOString(),
    })
    .where(eq(projects.id, projectId));

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

  return rows;
}
