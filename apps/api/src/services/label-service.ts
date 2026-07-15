import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { CreateLabelDto, Label, UpdateLabelDto } from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { labels, taskLabels } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';

const DEFAULT_LABELS = [
  { name: 'Urgent', color: '#d44d3c' },
  { name: 'Waiting', color: '#a5d3e1' },
  { name: 'Planning', color: '#b9a3f4' },
  { name: 'Reference', color: '#9fb18c' },
  { name: 'Meeting', color: '#81d7e8' },
  { name: 'Call', color: '#f1c582' },
  { name: 'Review', color: '#c7e9b3' },
  { name: 'Ideas', color: '#82d7a9' },
] satisfies Array<{ name: string; color: string }>;

type LabelRow = typeof labels.$inferSelect;

function toLabel(row: LabelRow & { taskCount?: number }): Label {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    userId: row.userId,
    taskCount: row.taskCount ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function seedDefaultLabelsForOwner(ownerId: string) {
  const existing = await db
    .select({ id: labels.id })
    .from(labels)
    .where(eq(labels.userId, ownerId))
    .limit(1);
  if (existing.length > 0) {
    return;
  }

  const now = nowIsoTimestamp();
  await db.insert(labels).values(
    DEFAULT_LABELS.map((label) => ({
      id: randomUUID(),
      userId: ownerId,
      name: label.name,
      color: label.color,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

export async function listLabelsForOwner(ownerId: string): Promise<Label[]> {
  const rows = await db
    .select({
      id: labels.id,
      userId: labels.userId,
      name: labels.name,
      color: labels.color,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt,
      taskCount: sql<number>`coalesce(count(${taskLabels.taskId}), 0)`,
    })
    .from(labels)
    .leftJoin(taskLabels, eq(taskLabels.labelId, labels.id))
    .where(eq(labels.userId, ownerId))
    .groupBy(labels.id)
    .orderBy(asc(labels.name));

  return rows.map(toLabel);
}

export function getLabelForOwner(labelId: string, ownerId: string, tx?: Database) {
  const client = tx ?? db;
  const [row] = client
    .select()
    .from(labels)
    .where(and(eq(labels.id, labelId), eq(labels.userId, ownerId)))
    .limit(1)
    .all();
  return row ?? null;
}

export async function createLabelForOwner(ownerId: string, body: CreateLabelDto) {
  const now = nowIsoTimestamp();
  const id = randomUUID();
  const name = body.name.trim();
  const color = body.color?.trim() || pickLabelColor(name);

  await db.insert(labels).values({
    id,
    userId: ownerId,
    name,
    color,
    createdAt: now,
    updatedAt: now,
  });

  const [label] = await db.select().from(labels).where(eq(labels.id, id)).limit(1);
  return label ?? null;
}

export async function updateLabelForOwner(ownerId: string, labelId: string, body: UpdateLabelDto) {
  const current = await getLabelForOwner(labelId, ownerId);
  if (!current) {
    return null;
  }

  const name = body.name?.trim() || current.name;
  const color = body.color?.trim() || current.color;

  await db
    .update(labels)
    .set({
      name,
      color,
      updatedAt: nowIsoTimestamp(),
    })
    .where(eq(labels.id, labelId));

  const [label] = await db.select().from(labels).where(eq(labels.id, labelId)).limit(1);
  return label ?? null;
}

export function deleteLabelForOwner(ownerId: string, labelId: string, tx?: Database) {
  const run = (client: Database) => {
    const current = getLabelForOwner(labelId, ownerId, client);
    if (!current) {
      return null;
    }

    client.delete(taskLabels).where(eq(taskLabels.labelId, labelId)).run();
    client.delete(labels).where(eq(labels.id, labelId)).run();
    return true;
  };

  return tx ? run(tx) : db.transaction(run, { behavior: 'immediate' });
}

export function syncTaskLabels(
  ownerId: string,
  taskId: string,
  labelIds: string[] | undefined,
  tx?: Database,
) {
  if (labelIds === undefined) {
    return;
  }

  const client = tx ?? db;
  client.delete(taskLabels).where(eq(taskLabels.taskId, taskId)).run();

  const uniqueIds = [...new Set(labelIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return;
  }

  const ownedLabels = client
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.userId, ownerId), inArray(labels.id, uniqueIds)))
    .all();

  if (ownedLabels.length === 0) {
    return;
  }

  client
    .insert(taskLabels)
    .values(
      ownedLabels.map((label) => ({
        taskId,
        labelId: label.id,
      })),
    )
    .run();
}

export function getTaskLabels(taskId: string, tx?: Database) {
  const client = tx ?? db;
  const rows = client
    .select({
      id: labels.id,
      userId: labels.userId,
      name: labels.name,
      color: labels.color,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt,
    })
    .from(taskLabels)
    .innerJoin(labels, eq(taskLabels.labelId, labels.id))
    .where(eq(taskLabels.taskId, taskId))
    .orderBy(asc(labels.name))
    .all();

  return rows.map((row) => toLabel({ ...row, taskCount: 0 }));
}

/**
 * Batch-fetch label IDs for multiple tasks in a single query.
 * Chunks taskIds to stay within SQLite's 999-parameter limit ($SQLITE_LIMIT_VARIABLE_NUMBER).
 * Returns a Map<taskId, labelId[]>. Tasks without labels are absent from the map.
 */
const IN_ARRAY_BATCH = 999;
export async function getLabelsForTasks(taskIds: string[]): Promise<Map<string, string[]>> {
  if (taskIds.length === 0) return new Map();

  const map = new Map<string, string[]>();
  for (let i = 0; i < taskIds.length; i += IN_ARRAY_BATCH) {
    const batch = taskIds.slice(i, i + IN_ARRAY_BATCH);
    const rows = await db
      .select({ taskId: taskLabels.taskId, labelId: labels.id })
      .from(taskLabels)
      .innerJoin(labels, eq(taskLabels.labelId, labels.id))
      .where(inArray(taskLabels.taskId, batch))
      .orderBy(asc(labels.name));

    for (const row of rows) {
      const existing = map.get(row.taskId);
      if (existing) {
        existing.push(row.labelId);
      } else {
        map.set(row.taskId, [row.labelId]);
      }
    }
  }
  return map;
}

function pickLabelColor(name: string) {
  const palette = ['#82d7a9', '#81d7e8', '#f1c582', '#c7e9b3', '#a5d3e1', '#bcd0fb'];
  const index =
    Math.abs(
      name
        .toLowerCase()
        .split('')
        .reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
    ) % palette.length;
  return palette[index];
}
