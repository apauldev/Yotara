import { isHexColor } from './color-contrast';

/** An inline token target plus the color it should advertise. */
export interface HighlightEntity {
  name: string;
  color?: string | null;
}

type HighlightEntities = Array<string | HighlightEntity> | undefined;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function entityLookup(entities: HighlightEntities): Map<string, HighlightEntity> | null {
  if (!entities || entities.length === 0) return null;

  const lookup = new Map<string, HighlightEntity>();
  for (const entity of entities) {
    const normalized = typeof entity === 'string' ? { name: entity } : entity;
    lookup.set(normalized.name.toLowerCase(), normalized);
  }
  return lookup;
}

/**
 * A chip span tinted with the entity's own color. The color is only emitted
 * when it is a validated hex value, so data can never inject arbitrary CSS.
 */
function tokenSpan(className: string, text: string, color?: string | null): string {
  const safeColor = isHexColor(color) ? color.trim().toLowerCase() : null;
  const style = safeColor ? ` style="--token-color:${safeColor}"` : '';
  return `<span class="${className}"${style}>${text}</span>`;
}

/** `!h`/`!high` -> high, `!l`/`!low` -> low, everything else medium. */
function priorityTone(word: string): 'high' | 'medium' | 'low' {
  const initial = word.replace(/^!/, '').toLowerCase()[0];
  if (initial === 'h') return 'high';
  if (initial === 'l') return 'low';
  return 'medium';
}

export function highlightInlineCommands(
  text: string,
  validLabels?: HighlightEntities,
  validProjects?: HighlightEntities,
): string {
  let html = escapeHtml(text);
  let prioritySet = false;

  // 1. Confirmed valid priorities: !word followed by space or end
  html = html.replace(
    /(^|\s)(!(h(?:igh)?|m(?:ed)?(?:ium)?|l(?:ow)?))(?=\s|$)/gi,
    (_match, before, full) => {
      if (prioritySet) return before + full;
      prioritySet = true;
      return `${before}<span class="hl-priority hl-priority-${priorityTone(full)}">${full}</span>`;
    },
  );

  // 2. Pending priority: ! alone at end of input
  html = html.replace(/(^|\s)(!)$/g, (_match, before, full) => {
    if (prioritySet) return before + full;
    prioritySet = true;
    return `${before}<span class="hl-priority">${full}</span>`;
  });

  const labelLookup = entityLookup(validLabels);
  if (labelLookup) {
    // 3. Confirmed labels: #word at space/end — only if word matches a known label
    html = html.replace(/(^|\s)(#([\w-]+))(?=\s|$)/g, (_match, before, full, name) => {
      const label = labelLookup.get(name.toLowerCase());
      return label ? before + tokenSpan('hl-label', full, label.color) : before + full;
    });

    // 4. Pending labels: # + prefix at end of input
    html = html.replace(/(^|\s)(#([\w-]*))$/g, (_match, before, full, prefix) => {
      const label = prefix
        ? [...labelLookup.values()].find((candidate) =>
            candidate.name.toLowerCase().startsWith(prefix.toLowerCase()),
          )
        : undefined;
      if (!prefix || label) {
        return before + tokenSpan('hl-label', full, label?.color);
      }
      return before + full;
    });
  } else {
    html = html.replace(/(^|\s)(#([\w-]+))(?=\s|$)/g, '$1<span class="hl-label">$2</span>');
    html = html.replace(/(^|\s)(#([\w-]*))(?!\s)/g, '$1<span class="hl-label">$2</span>');
  }

  const projectLookup = entityLookup(validProjects);
  if (projectLookup) {
    // 5. Confirmed projects: @word at space/end — only if word matches a known project
    html = html.replace(/(^|\s)(@([\w-]+))(?=\s|$)/g, (_match, before, full, name) => {
      const project = projectLookup.get(name.toLowerCase());
      return project ? before + tokenSpan('hl-project', full, project.color) : before + full;
    });

    // 6. Pending projects: @ + prefix at end of input
    html = html.replace(/(^|\s)(@([\w-]*))$/g, (_match, before, full, prefix) => {
      const project = prefix
        ? [...projectLookup.values()].find((candidate) =>
            candidate.name.toLowerCase().startsWith(prefix.toLowerCase()),
          )
        : undefined;
      if (!prefix || project) {
        return before + tokenSpan('hl-project', full, project?.color);
      }
      return before + full;
    });
  } else {
    html = html.replace(/(^|\s)(@([\w-]+))(?=\s|$)/g, '$1<span class="hl-project">$2</span>');
    html = html.replace(/(^|\s)(@([\w-]*))(?!\s)/g, '$1<span class="hl-project">$2</span>');
  }

  // 7. Unresolved tokens: any `#x` / `@x` / `!x` (never a bare sigil, which is
  // prose punctuation or an in-progress token) that survived the passes above
  // will not apply. Preserve the text — never delete it — but say so visually
  // with the muted "won't apply" style.
  html = html.replace(/(^|\s)([#!@][\w-]+)(?=\s|$)/g, (_match, before, full) => {
    return `${before}<span class="hl-unresolved">${full}</span>`;
  });

  return html;
}
