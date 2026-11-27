import type { CreateProjectDto, ProjectKind, UpdateProjectDto } from '@yotara/shared';

/**
 * Normalizes project payloads before they reach the service layer. Shared by
 * the project routes and service so both accept the same trimmed input.
 */
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

function normalizeOptionalString(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
