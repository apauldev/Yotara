export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightInlineCommands(
  text: string,
  validLabels?: string[],
  validProjects?: string[],
): string {
  let html = escapeHtml(text);
  let prioritySet = false;

  // 1. Confirmed valid priorities: !word followed by space or end
  html = html.replace(
    /(^|\s)(!(h(?:igh)?|m(?:ed)?(?:ium)?|l(?:ow)?))(?=\s|$)/gi,
    (_match, before, full) => {
      if (prioritySet) return before + full;
      prioritySet = true;
      return `${before}<span class="hl-priority">${full}</span>`;
    },
  );

  // 2. Pending priority: ! alone at end of input
  html = html.replace(/(^|\s)(!)$/g, (_match, before, full) => {
    if (prioritySet) return before + full;
    prioritySet = true;
    return `${before}<span class="hl-priority">${full}</span>`;
  });

  if (validLabels && validLabels.length > 0) {
    const labels = validLabels.map((l) => l.toLowerCase());

    // 3. Confirmed labels: #word at space/end — only if word matches a known label
    html = html.replace(/(^|\s)(#([\w-]+))(?=\s|$)/g, (_match, before, full, name) => {
      if (labels.includes(name.toLowerCase())) {
        return `${before}<span class="hl-label">${full}</span>`;
      }
      return before + full;
    });

    // 4. Pending labels: # + prefix at end of input
    html = html.replace(/(^|\s)(#([\w-]*))$/g, (_match, before, full, prefix) => {
      if (!prefix || labels.some((l) => l.startsWith(prefix.toLowerCase()))) {
        return `${before}<span class="hl-label">${full}</span>`;
      }
      return before + full;
    });
  } else {
    html = html.replace(/(^|\s)(#([\w-]+))(?=\s|$)/g, '$1<span class="hl-label">$2</span>');
    html = html.replace(/(^|\s)(#([\w-]*))(?!\s)/g, '$1<span class="hl-label">$2</span>');
  }

  if (validProjects && validProjects.length > 0) {
    const projects = validProjects.map((p) => p.toLowerCase());

    // 5. Confirmed projects: @word at space/end — only if word matches a known project
    html = html.replace(/(^|\s)(@([\w-]+))(?=\s|$)/g, (_match, before, full, name) => {
      if (projects.includes(name.toLowerCase())) {
        return `${before}<span class="hl-project">${full}</span>`;
      }
      return before + full;
    });

    // 6. Pending projects: @ + prefix at end of input
    html = html.replace(/(^|\s)(@([\w-]*))$/g, (_match, before, full, prefix) => {
      if (!prefix || projects.some((p) => p.startsWith(prefix.toLowerCase()))) {
        return `${before}<span class="hl-project">${full}</span>`;
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
