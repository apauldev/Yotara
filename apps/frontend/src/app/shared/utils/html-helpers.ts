export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightInlineCommands(text: string, validLabels?: string[]): string {
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

  return html;
}
