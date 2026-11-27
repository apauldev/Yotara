import type { Project, ProjectColor, ProjectKind } from '@yotara/shared';
import { projects } from '../db/schema.js';

type ProjectWithCountsRow = typeof projects.$inferSelect & {
  taskCount: number;
  completedTaskCount: number;
  openTaskCount: number;
};

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
