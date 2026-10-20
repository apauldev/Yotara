import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { CreateLabelDto, Label, UpdateLabelDto } from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { labels, taskLabels, tasks } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { BadRequestError, ConflictError } from '../lib/app-error.js';

/**
 * Six context labels for brand-new users. They are cross-cutting *conditions*,
 * never life areas — bucket names such as "Health" or "Home" must not appear
 * here (see the categorization model in docs/ARCHITECTURE.md). Seeding happens
 * once, during onboarding (PATCH /me), so deleting every label stays deleted.
 * Icon keys for these labels arrive with the icon migration in Phase 2.
 */
const DEFAULT_LABELS = [
  { name: 'Urgent', color: '#d44d3c' },
  { name: 'Waiting', color: '#a5d3e1' },
  { name: 'Planning', color: '#b9a3f4' },
  { name: 'Errand', color: '#f1c582' },
  { name: 'Review', color: '#c7e9b3' },
  { name: 'Idea', color: '#82d7a9' },
] satisfies Array<{ name: string; color: string }>;

/** Matches a normalized 3- or 6-digit hex color. */
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Validates and normalizes a label color sent by a client. Accepts 3- or
 * 6-digit hex; 3-digit forms expand to 6. Anything else is rejected so broken
 * CSS colors never reach the browser. Legacy stored values that fail this
 * check are tolerated on read (toLabel) but never pass through unchanged
 * writes.
 */
function normalizeHexColor(value: string, context: string): string {
  const raw = value.trim();
  if (!HEX_COLOR_PATTERN.test(raw)) {
    throw new BadRequestError(`${context} must be a 3- or 6-digit hex color, e.g. #82d7a9`);
  }
  const hex = raw.toLowerCase();
  if (hex.length === 4) {
    const [, r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return hex;
}

/**
 * Colors stored before validation existed may be arbitrary strings; the UI
 * falls back to the accent color for them (see LabelChipComponent). Unchanged
 * legacy values are never rejected on update.
 */
export function isRenderableLabelColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

/**
 * Idempotent under both the (user_id, lower(trim(name))) unique index and
 * repeated onboarding calls: existing labels short-circuit, and a double
 * request that races past that check hits ON CONFLICT DO NOTHING instead of
 * surfacing a constraint failure as a 500.
 */
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
  await db
    .insert(labels)
    .values(
      DEFAULT_LABELS.map((label) => ({
        id: randomUUID(),
        userId: ownerId,
        name: label.name,
        color: label.color,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Label list with truthful counts: one row per label, joined to tasks once.
 *   openTaskCount      — attached tasks that are not completed and not deleted
 *   completedTaskCount — attached, completed, not deleted
 *   totalTaskCount     — attached, not deleted (open + completed)
 *   taskCount          — legacy alias of totalTaskCount kept for older clients
 * Subtasks are included: the flat all-non-deleted-task scope keeps the
 * directory count, pane counts, and filtered lists in agreement.
 */
export async function listLabelsForOwner(ownerId: string): Promise<Label[]> {
  const rows = await db
    .select({
      id: labels.id,
      userId: labels.userId,
      name: labels.name,
      color: labels.color,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt,
      openTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 0 then 1 else 0 end), 0)`,
      completedTaskCount: sql<number>`coalesce(sum(case when ${tasks.completed} = 1 then 1 else 0 end), 0)`,
      totalTaskCount: sql<number>`coalesce(count(${tasks.id}), 0)`,
    })
    .from(labels)
    .leftJoin(taskLabels, eq(taskLabels.labelId, labels.id))
    .leftJoin(tasks, and(eq(taskLabels.taskId, tasks.id), sql`${tasks.deletedAt} IS NULL`))
    .where(eq(labels.userId, ownerId))
    .groupBy(
      labels.id,
      labels.userId,
      labels.name,
      labels.color,
      labels.createdAt,
      labels.updatedAt,
    )
    .orderBy(asc(labels.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    userId: row.userId,
    openTaskCount: row.openTaskCount,
    completedTaskCount: row.completedTaskCount,
    totalTaskCount: row.totalTaskCount,
    taskCount: row.totalTaskCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
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

/** Case/whitespace-insensitive duplicate lookup within one owner's labels. */
function findLabelByNameForOwner(ownerId: string, name: string, tx?: Database) {
  const client = tx ?? db;
  const [row] = client
    .select({ id: labels.id, name: labels.name })
    .from(labels)
    .where(and(eq(labels.userId, ownerId), sql`lower(trim(${labels.name})) = lower(trim(${name}))`))
    .limit(1)
    .all();
  return row ?? null;
}

/**
 * Re-throws the pre-insert constraint race as a 409. The startup migration
 * adds UNIQUE INDEX labels(user_id, lower(trim(name))), so two rapid
 * create/open-combos cannot both succeed; one loser gets this error.
 */
function isLabelUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (error as { code?: string }).code === 'SQLITE_CONSTRAINT')
  );
}

export async function createLabelForOwner(ownerId: string, body: CreateLabelDto) {
  const name = body.name.trim();
  if (!name) {
    throw new BadRequestError('A label name is required');
  }

  const match = findLabelByNameForOwner(ownerId, name);
  if (match) {
    throw new ConflictError(`A label named "${match.name}" already exists`, {
      existingLabel: match,
    });
  }

  const color = body.color?.trim() ? normalizeHexColor(body.color, 'Color') : pickLabelColor(name);

  const now = nowIsoTimestamp();
  const id = randomUUID();
  try {
    await db.insert(labels).values({
      id,
      userId: ownerId,
      name,
      color,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (isLabelUniqueConstraintError(error)) {
      const winner = findLabelByNameForOwner(ownerId, name);
      throw new ConflictError(`A label named "${winner?.name ?? name}" already exists`, {
        existingLabel: winner ?? null,
      });
    }
    throw error;
  }

  const [label] = await db.select().from(labels).where(eq(labels.id, id)).limit(1);
  return label ?? null;
}

export async function updateLabelForOwner(ownerId: string, labelId: string, body: UpdateLabelDto) {
  const current = await getLabelForOwner(labelId, ownerId);
  if (!current) {
    return null;
  }

  const name = body.name !== undefined ? body.name.trim() : current.name;
  if (name === '' && body.name !== undefined) {
    throw new BadRequestError('A label name is required');
  }

  // Renaming may collide with another of the owner's labels. Unchanged names
  // (and unchanged legacy colors) are never re-validated.
  if (body.name !== undefined && name !== current.name) {
    const match = findLabelByNameForOwner(ownerId, name);
    if (match && match.id !== current.id) {
      throw new ConflictError(`A label named "${match.name}" already exists`, {
        existingLabel: match,
      });
    }
  }

  const color =
    body.color !== undefined && body.color.trim() !== current.color
      ? normalizeHexColor(body.color, 'Color')
      : current.color;

  try {
    await db
      .update(labels)
      .set({
        name,
        color,
        updatedAt: nowIsoTimestamp(),
      })
      .where(and(eq(labels.id, labelId), eq(labels.userId, ownerId)));
  } catch (error) {
    if (isLabelUniqueConstraintError(error)) {
      const winner = findLabelByNameForOwner(ownerId, name);
      throw new ConflictError(`A label named "${winner?.name ?? name}" already exists`, {
        existingLabel: winner ?? null,
      });
    }
    throw error;
  }

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
    client
      .delete(labels)
      .where(and(eq(labels.id, labelId), eq(labels.userId, ownerId)))
      .run();
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

  return rows.map((row) => ({
    ...row,
    taskCount: 0,
  }));
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

/** Same palette the label editor offers; deterministic per name hash. */
const LABEL_COLOR_PALETTE = ['#82d7a9', '#81d7e8', '#f1c582', '#c7e9b3', '#a5d3e1', '#bcd0fb'];

export function pickLabelColor(name: string) {
  const index =
    Math.abs(
      name
        .toLowerCase()
        .split('')
        .reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
    ) % LABEL_COLOR_PALETTE.length;
  return LABEL_COLOR_PALETTE[index];
}
