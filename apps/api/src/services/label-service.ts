import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  DEFAULT_LABELS,
  DEFAULT_LABEL_ICON,
  isLabelIcon,
  pickLabelColorForName,
  type CreateLabelDto,
  type Label,
  type LabelIcon,
  type UpdateLabelDto,
} from '@yotara/shared';
import { db, type Database } from '../db/client.js';
import { labels, taskLabels, tasks } from '../db/schema.js';
import { nowIsoTimestamp } from '../lib/timestamps.js';
import { BadRequestError, ConflictError } from '../lib/app-error.js';

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

/** Validates a picked icon against the shared allowlist. */
function normalizeLabelIcon(value: string | undefined): LabelIcon {
  if (value === undefined) {
    return DEFAULT_LABEL_ICON;
  }
  if (!isLabelIcon(value)) {
    throw new BadRequestError(`Unknown label icon "${value}"`);
  }
  return value;
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
        icon: label.icon,
        pinned: false,
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
      icon: labels.icon,
      pinned: labels.pinned,
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
      labels.icon,
      labels.pinned,
      labels.createdAt,
      labels.updatedAt,
    )
    .orderBy(desc(labels.pinned), asc(labels.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon as LabelIcon,
    pinned: row.pinned,
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
  const icon = normalizeLabelIcon(body.icon);
  const pinned = body.pinned ?? false;

  const now = nowIsoTimestamp();
  const id = randomUUID();
  try {
    await db.insert(labels).values({
      id,
      userId: ownerId,
      name,
      color,
      icon,
      pinned,
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
  const icon = body.icon !== undefined ? normalizeLabelIcon(body.icon) : current.icon;
  const pinned = body.pinned !== undefined ? body.pinned : current.pinned;

  try {
    await db
      .update(labels)
      .set({
        name,
        color,
        icon,
        pinned,
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

/**
 * Merge `sourceId` into `targetId`: every task association moves to the
 * target (deduplicating tasks that already had it), then the source label is
 * deleted. The whole operation is one immediate transaction so a failure can
 * never orphan associations. Returns the number of source associations, or
 * null when either label is missing for this owner.
 */
export function mergeLabelForOwner(
  ownerId: string,
  sourceId: string,
  targetId: string,
): { movedTaskCount: number } | null {
  if (sourceId === targetId) {
    throw new BadRequestError('A label cannot be merged into itself');
  }

  return db.transaction(
    (client) => {
      const source = getLabelForOwner(sourceId, ownerId, client);
      const target = getLabelForOwner(targetId, ownerId, client);
      if (!source || !target) {
        return null;
      }

      const sourceRows = client
        .select({ taskId: taskLabels.taskId })
        .from(taskLabels)
        .where(eq(taskLabels.labelId, sourceId))
        .all();
      const targetTaskIds = new Set(
        client
          .select({ taskId: taskLabels.taskId })
          .from(taskLabels)
          .where(eq(taskLabels.labelId, targetId))
          .all()
          .map((row) => row.taskId),
      );

      const toMove = sourceRows.filter((row) => !targetTaskIds.has(row.taskId));
      if (toMove.length > 0) {
        client
          .insert(taskLabels)
          .values(toMove.map((row) => ({ taskId: row.taskId, labelId: targetId })))
          .run();
      }

      client.delete(taskLabels).where(eq(taskLabels.labelId, sourceId)).run();
      client
        .delete(labels)
        .where(and(eq(labels.id, sourceId), eq(labels.userId, ownerId)))
        .run();

      return { movedTaskCount: sourceRows.length };
    },
    { behavior: 'immediate' },
  );
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
      icon: labels.icon,
      pinned: labels.pinned,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt,
    })
    .from(taskLabels)
    .innerJoin(labels, eq(taskLabels.labelId, labels.id))
    .where(eq(taskLabels.taskId, taskId))
    .orderBy(desc(labels.pinned), asc(labels.name))
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
export function pickLabelColor(name: string) {
  return pickLabelColorForName(name);
}
