import {
  isLabelIcon,
  isProjectColor,
  type StarterLabelInput,
  type StarterProjectInput,
} from '@yotara/shared';
import { BadRequestError } from './app-error.js';
import { labelNameKey } from './label-name.js';
import { normalizeHexColor } from './label-values.js';

export const STARTER_CONTENT_MAX_ITEMS = 50;
export const STARTER_NAME_MAX_LENGTH = 80;
export const STARTER_DESCRIPTION_MAX_LENGTH = 200;

export interface NormalizedStarterContent {
  projects: StarterProjectInput[];
  labels: StarterLabelInput[];
}

/**
 * Validates and normalizes the starter-content payload from `PATCH /me`.
 * Rejects malformed content instead of silently dropping it, so a client can
 * always explain which name or color needs fixing. Empty arrays are valid and
 * mean "seed nothing".
 */
export function normalizeStarterContent(input: unknown): NormalizedStarterContent {
  if (!isRecord(input)) {
    throw new BadRequestError('starterContent must be an object');
  }

  return {
    projects: normalizeProjects(input['projects']),
    labels: normalizeLabels(input['labels']),
  };
}

function normalizeProjects(value: unknown): StarterProjectInput[] {
  const entries = asList(value, 'projects');
  const seen = new Set<string>();
  const projects: StarterProjectInput[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) {
      throw new BadRequestError('Each starter project must be an object');
    }

    const name = normalizeName(entry['name'], 'Project');
    const key = labelNameKey(name);
    if (seen.has(key)) {
      throw new BadRequestError(`Duplicate starter project name "${name}"`);
    }
    seen.add(key);

    const project: StarterProjectInput = { name };

    const description = normalizeDescription(entry['description'], name);
    if (description !== undefined) {
      project.description = description;
    }

    const color = entry['color'];
    if (color !== undefined && color !== null) {
      if (!isProjectColor(color)) {
        throw new BadRequestError(`Unknown project color "${String(color)}" for "${name}"`);
      }
      project.color = color;
    }

    projects.push(project);
  }

  return projects;
}

function normalizeLabels(value: unknown): StarterLabelInput[] {
  const entries = asList(value, 'labels');
  const seen = new Set<string>();
  const labels: StarterLabelInput[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) {
      throw new BadRequestError('Each starter label must be an object');
    }

    const name = normalizeName(entry['name'], 'Label');
    const key = labelNameKey(name);
    if (seen.has(key)) {
      throw new BadRequestError(`Duplicate starter label name "${name}"`);
    }
    seen.add(key);

    const label: StarterLabelInput = { name };

    const color = entry['color'];
    if (typeof color === 'string' && color.trim() !== '') {
      label.color = normalizeHexColor(color, `Label color for "${name}"`);
    } else if (color !== undefined && color !== null) {
      throw new BadRequestError(`Label color for "${name}" must be a hex string`);
    }

    const icon = entry['icon'];
    if (icon !== undefined && icon !== null) {
      if (!isLabelIcon(icon)) {
        throw new BadRequestError(`Unknown label icon "${String(icon)}" for "${name}"`);
      }
      label.icon = icon;
    }

    labels.push(label);
  }

  return labels;
}

function asList(value: unknown, field: string): unknown[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BadRequestError(`starterContent.${field} must be an array`);
  }
  if (value.length > STARTER_CONTENT_MAX_ITEMS) {
    throw new BadRequestError(
      `starterContent.${field} may contain at most ${STARTER_CONTENT_MAX_ITEMS} items`,
    );
  }
  return value;
}

function normalizeName(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestError(`${context} name must be a string`);
  }
  const name = value.trim();
  if (!name) {
    throw new BadRequestError(`${context} name is required`);
  }
  if (name.length > STARTER_NAME_MAX_LENGTH) {
    throw new BadRequestError(
      `${context} name "${name}" must be ${STARTER_NAME_MAX_LENGTH} characters or fewer`,
    );
  }
  return name;
}

function normalizeDescription(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new BadRequestError(`Description for "${name}" must be a string`);
  }
  const description = value.trim();
  if (!description) {
    return undefined;
  }
  if (description.length > STARTER_DESCRIPTION_MAX_LENGTH) {
    throw new BadRequestError(
      `Description for "${name}" must be ${STARTER_DESCRIPTION_MAX_LENGTH} characters or fewer`,
    );
  }
  return description;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
