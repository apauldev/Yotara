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
  /** Resolved `@project` name; the first resolved token wins. `undefined` when none resolved. */
  projectName?: string;
  /**
   * Resolved `@project` tokens after the first. First-wins precedence applies
   * only one project, so these matched but were applied nowhere; reported so
   * the capture surface can say so at submit.
   */
  unappliedProjectNames: string[];
  /**
   * `@tokens` that matched no existing project and were left in the title.
   * Without `knownProjectNames` the tokens are also reported here because
   * nothing can be assigned, and they are never stripped.
   */
  unresolvedProjectNames: string[];
}

/**
 * Parses a task title string for inline commands:
 * - Priority: !h, !high, !m, !med, !medium, !l, !low
 * - Labels: #tagname
 * - Projects: @projectname
 *
 * Returns the cleaned title and the extracted metadata. Pass
 * `knownLabelNames` / `knownProjectNames` (the user's live lists) so only
 * tokens that resolve to a real entity are stripped; unresolved tokens stay
 * in the title and are reported so the UI can say they did not apply.
 */
export function parseTaskCommand(
  input: string,
  options?: { knownLabelNames?: string[]; knownProjectNames?: string[] },
): ParsedTaskCommand {
  // \b is ASCII-only, so it would happily stop `@Café` after `caf` and hand
  // the token to a shorter sibling project. The extra lookahead refuses any
  // boundary into a real letter or number, so a token can only end where the
  // highlighter ends it too — at whitespace or the end of the title.
  const priorityRegex = /(?:^|\s)!([lhm]|low|med|medium|high)\b(?![\p{L}\p{N}])/iu;
  const labelRegex = /(?:^|\s)#([\w-]+)\b(?![\p{L}\p{N}])/gu;
  const projectRegex = /(?:^|\s)@([\w-]+)\b(?![\p{L}\p{N}])/gu;

  let title = input;
  let priority: Priority | undefined;
  const labelNames: string[] = [];
  const unresolvedLabelNames: string[] = [];
  let projectName: string | undefined;
  const unappliedProjectNames: string[] = [];
  const unresolvedProjectNames: string[] = [];

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
    // Replace by regex match, not by substring: an unresolved `#homework`
    // must not be rewritten just because a resolved `#home` also matched.
    title = title.replace(labelRegex, (full: string, name: string) =>
      knownNames.has(name.toLowerCase()) ? (full.startsWith(' ') ? ' ' : '') : full,
    );
  }

  const knownProjectNames = options?.knownProjectNames;
  // Projects have no legacy extract-and-strip mode: without a live list the
  // tokens cannot be assigned, so they are reported as unresolved and left in
  // place. Extraction only happens for callers that pass the list.
  const knownProjects = knownProjectNames
    ? new Set(knownProjectNames.map((name) => name.toLowerCase()))
    : null;
  const projectMatches = [...title.matchAll(projectRegex)];
  for (const match of projectMatches) {
    if (knownProjects?.has(match[1].toLowerCase())) {
      if (projectName === undefined) {
        // Precedence: the first resolved project token wins.
        projectName = match[1];
      } else {
        unappliedProjectNames.push(match[1]);
      }
    } else {
      unresolvedProjectNames.push(match[1]);
    }
  }
  // Same match-based replacement as labels: `@homework` must survive when the
  // resolved token is `@home`, even though `@home` is a substring of it.
  title = title.replace(projectRegex, (full: string, name: string) =>
    knownProjects?.has(name.toLowerCase()) ? (full.startsWith(' ') ? ' ' : '') : full,
  );

  return {
    title: title.trim().replace(/\s+/g, ' '),
    priority,
    labelNames: [...new Set(labelNames)], // Unique labels
    unresolvedLabelNames: [...new Set(unresolvedLabelNames)],
    projectName,
    unappliedProjectNames: [...new Set(unappliedProjectNames)],
    unresolvedProjectNames: [...new Set(unresolvedProjectNames)],
  };
}

/**
 * True when `@name` / `#name` written into a title is read back as exactly
 * `name` by the token grammar above. The token regexes stop at the first
 * character outside `[\w-]`, so multiword (`Garden Renovation`) and non-ASCII
 * (`Café`) names cannot round-trip: inserting one would silently drop the
 * pick or file into a different project. The trailing `\w` rejects a trailing
 * hyphen, where `\b` backtracks and captures a shorter name (`@trail-` is
 * read as `trail`, leaving `-` in the title).
 */
export function isInlineTokenName(name: string): boolean {
  return /^[\w-]*\w$/.test(name);
}
