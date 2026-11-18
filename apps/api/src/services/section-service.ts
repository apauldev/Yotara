import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type {
  CreateProjectSectionDto,
  ProjectSection,
  UpdateProjectSectionDto,
} from '@yotara/shared';
import { db } from '../db/client.js';
import { projectSections, projects, tasks } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';

type SectionWithCountsRow = typeof projectSections.$inferSelect & {
  taskCount: number;
  completedTaskCount: number;
  openTaskCount: number;
};

function sectionSelect() {
  return db
    .select({
      id: projectSections.id,
      projectId: projectSections.projectId,
      name: projectSections.name,
      sortOrder: projectSections.sortOrder,
      createdAt: projectSections.createdAt,
      updatedAt: projectSections.updatedAt,
      taskCount: sql<number>`coalesce(sum(case when ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
      completedTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 1 and ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
      openTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 0 and ${tasks.deletedAt} is null and ${tasks.status} <> 'archived' then 1 else 0 end), 0)`,
    })
    .from(projectSections)
    .leftJoin(
      tasks,
      and(eq(tasks.sectionId, projectSections.id), eq(tasks.projectId, projectSections.projectId)),
    );
}

async function getOwnedProject(projectId: string, ownerId: string) {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.ownerId, ownerId), isNull(projects.retiredAt)),
    )
    .limit(1);
  return row;
}

function getOwnedSectionRow(sectionId: string, ownerId: string) {
  return db
    .select({ id: projectSections.id, projectId: projectSections.projectId })
    .from(projectSections)
    .innerJoin(projects, eq(projectSections.projectId, projects.id))
    .where(
      and(
        eq(projectSections.id, sectionId),
        eq(projects.ownerId, ownerId),
        isNull(projects.retiredAt),
      ),
    )
    .limit(1)
    .get();
}

async function getSectionRow(sectionId: string): Promise<SectionWithCountsRow | undefined> {
  const [row] = await sectionSelect()
    .where(eq(projectSections.id, sectionId))
    .groupBy(projectSections.id)
    .limit(1);
  return row as SectionWithCountsRow | undefined;
}

export async function listSectionsForProject(
  projectId: string,
  ownerId: string,
): Promise<ProjectSection[] | null> {
  if (!(await getOwnedProject(projectId, ownerId))) {
    return null;
  }

  const rows = await sectionSelect()
    .where(eq(projectSections.projectId, projectId))
    .groupBy(projectSections.id)
    .orderBy(
      sql`${projectSections.sortOrder} asc`,
      sql`${projectSections.name} asc`,
      sql`${projectSections.id} asc`,
    );
  return rows as SectionWithCountsRow[];
}

export async function createSectionForProject(
  projectId: string,
  ownerId: string,
  body: CreateProjectSectionDto,
): Promise<ProjectSection | null> {
  if (!(await getOwnedProject(projectId, ownerId))) {
    return null;
  }

  const name = body.name?.trim();
  if (!name) {
    return null;
  }

  const [{ nextOrder }] = await db
    .select({ nextOrder: sql<number>`coalesce(max(${projectSections.sortOrder}), -1) + 1` })
    .from(projectSections)
    .where(eq(projectSections.projectId, projectId))
    .all();

  const now = nowIsoTimestamp();
  const id = randomUUID();
  await db
    .insert(projectSections)
    .values({ id, projectId, name, sortOrder: nextOrder ?? 0, createdAt: now, updatedAt: now });

  return (await getSectionRow(id)) ?? null;
}

export async function updateSectionForOwner(
  sectionId: string,
  ownerId: string,
  body: UpdateProjectSectionDto,
): Promise<ProjectSection | null> {
  if (!(await getOwnedSectionRow(sectionId, ownerId))) {
    return null;
  }

  const patch: { name?: string; sortOrder?: number; updatedAt: string } = {
    updatedAt: nowIsoTimestamp(),
  };

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return null;
    }
    patch.name = name;
  }
  if (body.sortOrder !== undefined) {
    patch.sortOrder = body.sortOrder;
  }

  await db.update(projectSections).set(patch).where(eq(projectSections.id, sectionId));
  return (await getSectionRow(sectionId)) ?? null;
}

export async function reorderSectionsForOwner(
  projectId: string,
  ownerId: string,
  orderedIds: string[],
): Promise<{ ok: false } | { ok: true; sections: ProjectSection[] }> {
  if (!(await getOwnedProject(projectId, ownerId))) {
    return { ok: false };
  }

  if (orderedIds.length === 0) {
    return { ok: true, sections: (await listSectionsForProject(projectId, ownerId)) ?? [] };
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    return { ok: false };
  }

  const existingIds = (
    await db
      .select({ id: projectSections.id })
      .from(projectSections)
      .where(eq(projectSections.projectId, projectId))
  ).map((row) => row.id);

  if (
    existingIds.length !== orderedIds.length ||
    !orderedIds.every((id) => existingIds.includes(id))
  ) {
    return { ok: false };
  }

  const now = nowIsoTimestamp();
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(projectSections)
        .set({ sortOrder: index, updatedAt: now })
        .where(and(eq(projectSections.id, id), eq(projectSections.projectId, projectId)))
        .run();
    });
  });

  return { ok: true, sections: (await listSectionsForProject(projectId, ownerId)) ?? [] };
}

export async function deleteSectionForOwner(sectionId: string, ownerId: string): Promise<boolean> {
  if (!(await getOwnedSectionRow(sectionId, ownerId))) {
    return false;
  }

  db.transaction((tx) => {
    // Defensive: the section_id FK uses ON DELETE SET NULL, but making the
    // unsection step explicit keeps the "never delete tasks" contract obvious
    // and independent of PRAGMA foreign_keys being enabled.
    tx.update(tasks)
      .set({ sectionId: null, updatedAt: nowIsoTimestamp() })
      .where(eq(tasks.sectionId, sectionId))
      .run();
    tx.delete(projectSections).where(eq(projectSections.id, sectionId)).run();
  });

  return true;
}

export type SectionWriteResolution =
  | { ok: true; sectionId: string | null; projectId: string | null }
  | { ok: false };

/**
 * Validate that a client-supplied section id belongs to an owned, non-retired
 * project. When a caller supplies a section but no project, the section's
 * project is returned so the task is assigned consistently.
 */
export function resolveSectionIdForTaskWrite(
  ownerId: string,
  sectionId: string | null | undefined,
  projectId: string | null | undefined,
): SectionWriteResolution {
  if (sectionId == null) {
    return { ok: true, sectionId: null, projectId: projectId ?? null };
  }

  // A section cannot exist without a project; explicitly unfiled tasks cannot belong to a section.
  if (projectId === null) {
    return { ok: false };
  }

  const row = getOwnedSectionRow(sectionId, ownerId);
  if (!row) {
    return { ok: false };
  }

  if (projectId !== undefined && row.projectId !== projectId) {
    return { ok: false };
  }

  return { ok: true, sectionId: row.id, projectId: row.projectId };
}
