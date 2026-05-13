import { Priority } from '@yotara/shared';

export interface ParsedTaskCommand {
  title: string;
  priority?: Priority;
  labelNames: string[];
}

/**
 * Parses a task title string for inline commands:
 * - Priority: !h, !high, !m, !med, !medium, !l, !low
 * - Labels: #tagname
 *
 * Returns the cleaned title and the extracted metadata.
 */
export function parseTaskCommand(input: string): ParsedTaskCommand {
  const priorityRegex = /(?:^|\s)!([lhm]|low|med|medium|high)\b/i;
  const labelRegex = /(?:^|\s)#([\w-]+)\b/g;

  let title = input;
  let priority: Priority | undefined;
  const labelNames: string[] = [];

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

  // Parse Labels
  const matches = [...title.matchAll(labelRegex)];
  for (const match of matches) {
    labelNames.push(match[1]);
  }
  // Remove label matches but keep leading space
  title = title.replace(labelRegex, (match) => (match.startsWith(' ') ? ' ' : ''));

  return {
    title: title.trim().replace(/\s+/g, ' '),
    priority,
    labelNames: [...new Set(labelNames)], // Unique labels
  };
}
