import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db, type Database } from '../db/client.js';
import { projects, tasks } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import type { TaskRow } from './task-mapper.js';
import { getTaskForOwnerSync } from './task-query-service.js';
import { getArchiveAutoDeleteForOwner } from './task-policy.js';

export async function cleanupExpiredArchivedTasks(ownerId: string): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  // Soft-deleted tasks stay in Trash for the same 30-day recovery window as
  // completed tasks. Only purge rows that have aged past it — deleting every
  // deletedAt row here made "recover within 30 days" impossible.
  await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.userId, ownerId),
        isNotNull(tasks.deletedAt),
        sql`${tasks.deletedAt} < ${cutoffIso}`,
      ),
    );

  // Retired projects whose tasks have aged past the recovery window are
  // also purged so soft-deleted projects don't linger in SQLite forever.
  await db
    .delete(projects)
    .where(
      and(
        eq(projects.ownerId, ownerId),
        isNotNull(projects.retiredAt),
        sql`${projects.retiredAt} < ${cutoffIso}`,
      ),
    );

  const archiveAutoDelete = await getArchiveAutoDeleteForOwner(ownerId);
  if (!archiveAutoDelete) {
    return 0;
  }

  await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.userId, ownerId),
        eq(tasks.completed, true),
        eq(tasks.permanentArchive, false),
        isNotNull(tasks.archivedAt),
        isNull(tasks.deletedAt),
        sql`${tasks.archivedAt} < ${cutoffIso}`,
      ),
    );

  return 1;
}

/**
 * Remove every completed task that is not marked permanentArchive right now,
 * instead of waiting for the 30-day auto-clear. Kept tasks (permanentArchive)
 * are untouched; tasks soft-deleted elsewhere also go, matching the eventual
 * purge in cleanupExpiredArchivedTasks.
 */
export function clearCompletedTasksForOwner(ownerId: string, tx?: Database): number {
  const run = (client: Database) =>
    client
      .delete(tasks)
      .where(
        and(
          eq(tasks.userId, ownerId),
          eq(tasks.completed, true),
          eq(tasks.permanentArchive, false),
        ),
      )
      .run().changes;

  return tx ? run(tx) : db.transaction(run, { behavior: 'immediate' });
}

export function deleteTaskForOwner(
  ownerId: string,
  taskId: string,
  existing?: TaskRow | null,
  tx?: Database,
): boolean | null {
  const run = (client: Database) => {
    const row = existing ?? getTaskForOwnerSync(taskId, ownerId, client);
    if (!row) {
      return null;
    }

    // Cascade-delete subtasks
    client
      .delete(tasks)
      .where(and(eq(tasks.parentId, taskId), eq(tasks.userId, ownerId)))
      .run();

    // Cascade-delete materialized instances (if this is a recurring template)
    client
      .delete(tasks)
      .where(and(eq(tasks.baseTaskId, taskId), eq(tasks.userId, ownerId)))
      .run();

    client
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, ownerId)))
      .run();

    return true;
  };

  return tx ? run(tx) : db.transaction(run, { behavior: 'immediate' });
}

/**
 * Restore a whole deletion from Trash. A project deletion stamps the project
 * and every one of its tasks with the same moment, so restoring any task brings
 * back the project and the complete task batch together.
 */
export function restoreTaskForOwner(ownerId: string, taskId: string): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString();

  const run = (client: Database) => {
    const [target] = client
      .select({ deletedAt: tasks.deletedAt, projectId: tasks.projectId })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, ownerId), isNotNull(tasks.deletedAt)))
      .limit(1)
      .all();

    if (!target?.deletedAt || target.deletedAt < cutoffIso) {
      return false;
    }

    const now = nowIsoTimestamp();
    const restored = client
      .update(tasks)
      .set({ deletedAt: null, updatedAt: now })
      .where(
        target.projectId
          ? and(
              eq(tasks.userId, ownerId),
              eq(tasks.projectId, target.projectId),
              eq(tasks.deletedAt, target.deletedAt),
            )
          : and(eq(tasks.userId, ownerId), eq(tasks.deletedAt, target.deletedAt)),
      )
      .run();

    // The project was retired with the same stamp; un-retire it so the tasks
    // land back in their original project instead of as orphaned Inbox items.
    if (target.projectId) {
      client
        .update(projects)
        .set({ retiredAt: null, updatedAt: now })
        .where(
          and(
            eq(projects.id, target.projectId),
            eq(projects.ownerId, ownerId),
            isNotNull(projects.retiredAt),
          ),
        )
        .run();
    }

    return restored.changes > 0;
  };

  return db.transaction(run, { behavior: 'immediate' });
}
