import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { CreateLabelDto, Label, UpdateLabelDto } from '@yotara/shared';
import { db } from '../db/client.js';
import { labels, taskLabels, tasks } from '../db/schema.js';

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
  const existing = await db.select({ id: labels.id }).from(labels).where(eq(labels.userId, ownerId)).limit(1);
  if (existing.length > 0) {
    return;
  }

  const now = new Date().toISOString();
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

export async function getLabelForOwner(labelId: string, ownerId: string) {
  const [row] = await db.select().from(labels).where(and(eq(labels.id, labelId), eq(labels.userId, ownerId))).limit(1);
  return row ?? null;
}

export async function createLabelForOwner(ownerId: string, body: CreateLabelDto) {
  const now = new Date().toISOString();
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
      updatedAt: new Date().toISOString(),
    })
    .where(eq(labels.id, labelId));

  const [label] = await db.select().from(labels).where(eq(labels.id, labelId)).limit(1);
  return label ?? null;
}

export async function deleteLabelForOwner(ownerId: string, labelId: string) {
  const current = await getLabelForOwner(labelId, ownerId);
  if (!current) {
    return null;
  }

  await db.delete(taskLabels).where(eq(taskLabels.labelId, labelId));
  await db.delete(labels).where(eq(labels.id, labelId));
  return true;
}

export async function syncTaskLabels(ownerId: string, taskId: string, labelIds: string[] | undefined) {
  if (labelIds === undefined) {
    return;
  }

  await db.delete(taskLabels).where(eq(taskLabels.taskId, taskId));

  const uniqueIds = [...new Set(labelIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return;
  }

  const ownedLabels = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.userId, ownerId), inArray(labels.id, uniqueIds)));

  if (ownedLabels.length === 0) {
    return;
  }

  await db.insert(taskLabels).values(
    ownedLabels.map((label) => ({
      taskId,
      labelId: label.id,
    })),
  );
}

export async function getTaskLabels(taskId: string) {
  const rows = await db
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
    .orderBy(asc(labels.name));

  return rows.map((row) => toLabel({ ...row, taskCount: 0 }));
}

function pickLabelColor(name: string) {
  const palette = ['#82d7a9', '#81d7e8', '#f1c582', '#c7e9b3', '#a5d3e1', '#bcd0fb'];
  const index = Math.abs(name.toLowerCase().split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % palette.length;
  return palette[index];
}
