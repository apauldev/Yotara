import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { CreateProjectDto, ProjectColor, ProjectKind, UpdateProjectDto } from '@yotara/shared';
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

  return project as ProjectWithCountsRow | undefined;
}

/** A project the onboarding seeder may insert. */
export interface ProjectSeed {
  name: string;
  description?: string;
  color?: ProjectColor;
  kind?: ProjectKind;
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
      missingProjects.map((project, index) => ({
        id: randomUUID(),
        ownerId,
        name: project.name,
        description: project.description ?? null,
        color: project.color ?? null,
        kind: project.kind ?? 'ongoing',
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .run();
}

export interface ListProjectsOptions {
  status?: 'active' | 'completed' | 'archived' | 'all';
}

export async function listProjectsForOwner(ownerId: string, options?: ListProjectsOptions) {
  const status = options?.status;
  const conditions = [eq(projects.ownerId, ownerId), isNull(projects.retiredAt)];

  if (status === 'active') {
    conditions.push(isNull(projects.archivedAt), isNull(projects.completedAt));
  } else if (status === 'completed') {
    conditions.push(isNull(projects.archivedAt), isNotNull(projects.completedAt));
  } else if (status === 'archived') {
    conditions.push(isNotNull(projects.archivedAt));
  } else if (status !== 'all') {
    // Default when no status or unspecified: non-archived (active + completed)
    conditions.push(isNull(projects.archivedAt));
  }

  const rows = await db
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
    .where(and(...conditions))
    .groupBy(projects.id)
    .orderBy(
      sql`${projects.pinned} desc`,
      sql`${projects.sortOrder} asc`,
      sql`${projects.name} asc`,
      sql`${projects.id} asc`,
    );

  return rows as ProjectWithCountsRow[];
}

export async function getProjectForOwner(projectId: string, ownerId: string) {
  return loadProjectById(projectId, ownerId);
}

export async function createProjectForOwner(ownerId: string, body: CreateProjectDto) {
  const payload = normalizeProjectCreatePayload(body);
  const now = nowIsoTimestamp();
  const id = randomUUID();

  const [maxOrderRow] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${projects.sortOrder}), -1)` })
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), isNull(projects.retiredAt)));
  const nextSortOrder = (maxOrderRow?.maxOrder ?? -1) + 1;

  await db.insert(projects).values({
    id,
    ownerId,
    name: payload.name,
    description: payload.description ?? null,
    color: payload.color ?? null,
    kind: payload.kind ?? 'project',
    targetDate: payload.targetDate ?? null,
    pinned: payload.pinned ?? false,
    sortOrder: nextSortOrder,
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
  const nextKind = patch.kind ?? current.kind;

  await db
    .update(projects)
    .set({
      name: patch.name ?? current.name,
      description:
        body.description !== undefined
          ? (patch.description ?? null)
          : (current.description ?? null),
      color: body.color !== undefined ? (patch.color ?? null) : (current.color ?? null),
      kind: nextKind,
      targetDate:
        nextKind === 'ongoing'
          ? null
          : body.targetDate !== undefined
            ? (patch.targetDate ?? null)
            : (current.targetDate ?? null),
      pinned: patch.pinned !== undefined ? patch.pinned : current.pinned,
      sortOrder: patch.sortOrder !== undefined ? patch.sortOrder : current.sortOrder,
      updatedAt: nowIsoTimestamp(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));

  return loadProjectById(projectId, ownerId);
}

/**
 * Persist a user-defined directory order. All ids must belong to the caller;
 * a partial or foreign list is rejected so a request can never reorder
 * someone else's projects or silently skip entries.
 */
export async function reorderProjectsForOwner(
  ownerId: string,
  orderedIds: string[],
): Promise<{ ok: false } | { ok: true; projects: ProjectWithCountsRow[] }> {
  if (orderedIds.length === 0) {
    return { ok: true, projects: [] };
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    return { ok: false };
  }

  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, ownerId),
        isNull(projects.retiredAt),
        inArray(projects.id, orderedIds),
      ),
    );

  if (owned.length !== orderedIds.length) {
    return { ok: false };
  }

  // The list must cover every non-retired project for this owner. A partial
  // list would assign duplicate sortOrder values that collide with omitted
  // projects, silently corrupting the directory order.
  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(and(eq(projects.ownerId, ownerId), isNull(projects.retiredAt)));
  if (total !== orderedIds.length) {
    return { ok: false };
  }

  const now = nowIsoTimestamp();
  db.transaction((tx) => {
    orderedIds.forEach((id, index) => {
      tx.update(projects)
        .set({ sortOrder: index, updatedAt: now })
        .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
        .run();
    });
  });

  return { ok: true, projects: await listProjectsForOwner(ownerId, { status: 'all' }) };
}

export type CompleteProjectResult =
  | { ok: true; project: ProjectWithCountsRow }
  | {
      ok: false;
      error: 'not_found' | 'ongoing_area' | 'open_tasks_remain';
      openTaskCount?: number;
    };

export async function completeProjectForOwner(
  projectId: string,
  ownerId: string,
): Promise<CompleteProjectResult> {
  const current = await loadProjectById(projectId, ownerId);
  if (!current) {
    return { ok: false, error: 'not_found' };
  }

  if (current.kind === 'ongoing') {
    return { ok: false, error: 'ongoing_area' };
  }

  if (current.openTaskCount > 0) {
    return { ok: false, error: 'open_tasks_remain', openTaskCount: current.openTaskCount };
  }

  const now = nowIsoTimestamp();
  await db
    .update(projects)
    .set({
      completedAt: now,
      updatedAt: now,
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));

  const updated = await loadProjectById(projectId, ownerId);
  return { ok: true, project: updated! };
}

export async function reopenProjectForOwner(
  projectId: string,
  ownerId: string,
): Promise<ProjectWithCountsRow | null> {
  const current = await loadProjectById(projectId, ownerId);
  if (!current) {
    return null;
  }

  const now = nowIsoTimestamp();
  await db
    .update(projects)
    .set({
      completedAt: null,
      updatedAt: now,
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));

  return (await loadProjectById(projectId, ownerId)) ?? null;
}

export async function archiveProjectForOwner(
  projectId: string,
  ownerId: string,
): Promise<ProjectWithCountsRow | null> {
  const current = await loadProjectById(projectId, ownerId);
  if (!current) {
    return null;
  }

  const now = nowIsoTimestamp();
  await db
    .update(projects)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));

  return (await loadProjectById(projectId, ownerId)) ?? null;
}

export async function unarchiveProjectForOwner(
  projectId: string,
  ownerId: string,
): Promise<ProjectWithCountsRow | null> {
  const current = await loadProjectById(projectId, ownerId);
  if (!current) {
    return null;
  }

  const now = nowIsoTimestamp();
  await db
    .update(projects)
    .set({
      archivedAt: null,
      updatedAt: now,
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)));

  return (await loadProjectById(projectId, ownerId)) ?? null;
}

export interface DeleteProjectOptions {
  keepTasks?: boolean;
}

export async function deleteProjectForOwner(
  projectId: string,
  ownerId: string,
  options: DeleteProjectOptions = { keepTasks: true },
): Promise<boolean> {
  const current = await loadProjectById(projectId, ownerId);
  if (!current) {
    return false;
  }

  const now = nowIsoTimestamp();
  const keepTasks = options.keepTasks !== false;

  db.transaction((tx) => {
    let softDeletedTasksCount = 0;
    if (keepTasks) {
      tx.update(tasks)
        .set({
          projectId: null,
          sectionId: null,
          updatedAt: now,
        })
        .where(and(eq(tasks.projectId, projectId), eq(tasks.userId, ownerId)))
        .run();
    } else {
      const updateResult = tx
        .update(tasks)
        .set({
          deletedAt: now,
          updatedAt: now,
        })
        .where(
          and(eq(tasks.projectId, projectId), eq(tasks.userId, ownerId), isNull(tasks.deletedAt)),
        )
        .run();
      softDeletedTasksCount = updateResult.changes;
    }

    if (keepTasks || softDeletedTasksCount === 0) {
      tx.delete(projects)
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
        .run();
    } else {
      // Keep the project row with a retired stamp matching its tasks, so the
      // whole deletion can be undone from Trash as one unit. Retired projects
      // are filtered out of every normal project listing.
      tx.update(projects)
        .set({ retiredAt: now, updatedAt: now })
        .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
        .run();
    }
  });

  return true;
}

/**
 * Safety bound for a project's task list. The project page groups by section
 * and renders the whole array, so the cap is set to the same page size the
 * rest of the API uses rather than a browsing-sized page.
 *
 * NOTE: this silently truncates. The contrast with the paginated `/tasks`
 * endpoints is deliberate but imperfect: this route returns a bare `Task[]`
 * with no `meta`, so a client cannot tell a full list from a capped one. A
 * project past this size renders an incomplete page with no notice. Treat
 * 3000 as a runaway guard, not a supported page size; real pagination is the
 * fix if a project ever approaches it.
 */
const MAX_PROJECT_TASKS = 3000;

export async function listTasksForProject(projectId: string, ownerId: string) {
  const project = await loadProjectById(projectId, ownerId);
  if (!project) {
    return null;
  }

  // Ordered in SQL so the database returns rows in display order; sorting in
  // JS meant reading and transferring the entire result set first.
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, ownerId), eq(tasks.projectId, projectId), isNull(tasks.deletedAt)))
    .orderBy(asc(tasks.order), asc(tasks.createdAt), asc(tasks.id))
    .limit(MAX_PROJECT_TASKS);

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

  if (row.retiredAt) {
    return { ok: true, projectId: null };
  }

  return { ok: true, projectId: row.id };
}
