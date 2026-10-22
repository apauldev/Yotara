import { Priority } from '@yotara/shared';

export interface ParsedTaskCommand {
  title: string;
  priority?: Priority;
  labelNames: string[];
  /**
   * `#tags` that matched no existing label and were therefore left in the
   * title. Only populated when `knownLabelNames` is provided — the capture
   * surfaces pass the live label list so unknown tags never disappear
   * silently (Phase 1: preserve; Phase 3 adds "Create 'X'").
   */
  unresolvedLabelNames: string[];
}

/**
 * Parses a task title string for inline commands:
 * - Priority: !h, !high, !m, !med, !medium, !l, !low
 * - Labels: #tagname
 *
 * Returns the cleaned title and the extracted metadata. Pass
 * `knownLabelNames` (the user's live label names) to keep unresolved `#tags`
 * in the title; known tags are stripped and returned via `labelNames`.
 */
export function parseTaskCommand(
  input: string,
  options?: { knownLabelNames?: string[] },
): ParsedTaskCommand {
  const priorityRegex = /(?:^|\s)!([lhm]|low|med|medium|high)\b/i;
  const labelRegex = /(?:^|\s)#([\w-]+)\b/g;

  let title = input;
  let priority: Priority | undefined;
  const labelNames: string[] = [];
  const unresolvedLabelNames: string[] = [];

  // Parse Priority
  const priorityMatch = title.match(priorityRegex);
  if (priorityMatch) {
    const fullMatch = priorityMatch[0];
    const val = priorityMatch[1].toLowerCase();
    if (val === 'h' || val === 'high') priority = 'high';
    else if (val === 'm' || val === 'med' || val === 'medium') priority = 'medium';
    else if (val === 'l' || val === 'low') priority = 'low';

    // Replace the specific match, keeping the leading space if it exists
    const replacement = fullMatch.startsWith(' ') ? ' ' : '';
    title = title.replace(fullMatch, replacement);
  }

  const knownLabelNames = options?.knownLabelNames;
  if (!knownLabelNames) {
    // Legacy behavior (no known list): extract and strip every #tag.
    const matches = [...title.matchAll(labelRegex)];
    for (const match of matches) {
      labelNames.push(match[1]);
    }
    title = title.replace(labelRegex, (match) => (match.startsWith(' ') ? ' ' : ''));
  } else {
    // Tag-aware behavior: strip only tags that resolve to a real label;
    // unknown tags survive in the title so the text is never lost.
    const knownNames = new Set(knownLabelNames.map((name) => name.toLowerCase()));
    const matches = [...title.matchAll(labelRegex)];
    for (const match of matches) {
      if (knownNames.has(match[1].toLowerCase())) {
        labelNames.push(match[1]);
      } else {
        unresolvedLabelNames.push(match[1]);
      }
    }
    for (const match of matches) {
      if (knownNames.has(match[1].toLowerCase())) {
        const replacement = match[0].startsWith(' ') ? ' ' : '';
        title = title.replace(match[0], replacement);
      }
    }
  }

  return {
    title: title.trim().replace(/\s+/g, ' '),
    priority,
    labelNames: [...new Set(labelNames)], // Unique labels
    unresolvedLabelNames: [...new Set(unresolvedLabelNames)],
  };
}
