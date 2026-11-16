import { and, eq, isNull, sql } from 'drizzle-orm';
import type {
  CreateProjectDto,
  Project,
  ProjectColor,
  ProjectKind,
  UpdateProjectDto,
} from '@yotara/shared';
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
  const kind: ProjectKind = body.kind ?? 'project';
  return {
    name: body.name.trim(),
    description: normalizeOptionalString(body.description),
    color: body.color,
    kind,
    targetDate: kind === 'ongoing' ? null : (normalizeOptionalString(body.targetDate) ?? null),
    pinned: body.pinned ?? false,
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

  if (body.kind !== undefined) {
    patch.kind = body.kind;
    if (body.kind === 'ongoing') {
      patch.targetDate = null;
    }
  }

  if (body.targetDate !== undefined) {
    patch.targetDate = normalizeOptionalString(body.targetDate) ?? null;
  }

  if (body.pinned !== undefined) {
    patch.pinned = body.pinned;
  }

  if (body.sortOrder !== undefined) {
    patch.sortOrder = body.sortOrder;
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
    kind: (project.kind as ProjectKind) ?? 'project',
    targetDate: project.targetDate ?? undefined,
    completedAt: project.completedAt ?? undefined,
    archivedAt: project.archivedAt ?? undefined,
    sortOrder: project.sortOrder ?? 0,
    pinned: Boolean(project.pinned),
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
      kind: projects.kind,
      targetDate: projects.targetDate,
      completedAt: projects.completedAt,
      archivedAt: projects.archivedAt,
      sortOrder: projects.sortOrder,
      pinned: projects.pinned,
      retiredAt: projects.retiredAt,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`coalesce(sum(case when ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
      completedTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 1 and ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
      openTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 0 and ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
    })
    .from(projects)
    .leftJoin(tasks, and(eq(tasks.projectId, projects.id), isNull(tasks.deletedAt)))
    .where(
      and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), isNull(projects.retiredAt)),
    )
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
      kind: projects.kind,
      targetDate: projects.targetDate,
      completedAt: projects.completedAt,
      archivedAt: projects.archivedAt,
      sortOrder: projects.sortOrder,
      pinned: projects.pinned,
      retiredAt: projects.retiredAt,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`coalesce(sum(case when ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
      completedTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 1 and ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
      openTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 0 and ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
    })
    .from(projects)
    .leftJoin(tasks, and(eq(tasks.projectId, projects.id), isNull(tasks.deletedAt)))
    .where(and(eq(projects.ownerId, ownerId), isNull(projects.retiredAt)))
    .groupBy(projects.id)
    .orderBy(
      sql`${projects.pinned} desc`,
      sql`${projects.sortOrder} asc`,
      sql`${projects.name} asc`,
      sql`${projects.id} asc`,
    );
}

export async function ensureOwnedProject(projectId: string, ownerId: string) {
  const project = await getProjectById(projectId, ownerId);
  return project ?? null;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
