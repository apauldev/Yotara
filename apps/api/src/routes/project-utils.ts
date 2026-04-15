import { and, eq, isNull, sql } from 'drizzle-orm';
import type { CreateProjectDto, Project, ProjectColor, UpdateProjectDto } from '@yotara/shared';
import { db } from '../db/client.js';
import { projects, tasks } from '../db/schema.js';

export const PROJECT_COLOR_VALUES = [
  'sage',
  'teal',
  'olive',
  'clay',
  'forest',
  'deep-ocean',
] as const satisfies readonly ProjectColor[];

const PROJECT_COLORS = new Set<string>(PROJECT_COLOR_VALUES);

type ProjectWithCountsRow = typeof projects.$inferSelect & {
  taskCount: number;
  completedTaskCount: number;
  openTaskCount: number;
};

export function normalizeProjectCreatePayload(body: CreateProjectDto): CreateProjectDto {
  return {
    name: body.name.trim(),
    description: normalizeOptionalString(body.description),
    color: body.color,
  };
}

export function normalizeProjectUpdatePayload(body: UpdateProjectDto): UpdateProjectDto {
  const patch: UpdateProjectDto = {};

  if (body.name !== undefined) {
    patch.name = body.name.trim();
  }

  if (body.description !== undefined) {
    patch.description = normalizeOptionalString(body.description);
  }

  if (body.color !== undefined) {
    patch.color = body.color;
  }

  return patch;
}

export function isValidProjectColor(color: string | undefined): color is ProjectColor {
  return color !== undefined && PROJECT_COLORS.has(color);
}

export function toProject(project: ProjectWithCountsRow): Project {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    color: (project.color as ProjectColor | null) ?? undefined,
    ownerId: project.ownerId,
    taskCount: project.taskCount,
    completedTaskCount: project.completedTaskCount,
    openTaskCount: project.openTaskCount,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function getProjectById(projectId: string, ownerId: string) {
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

  return project;
}

export async function getProjectsForOwner(ownerId: string) {
  return db
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
}

export async function ensureOwnedProject(projectId: string, ownerId: string) {
  const project = await getProjectById(projectId, ownerId);
  return project ?? null;
}

function normalizeOptionalString(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
