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
  //    e.g. "!h ", "!high ", "!m", "!medium" at end of input
  //    Only the first matched priority is highlighted (tasks allow only one)
  html = html.replace(
    /((?:^|\s)!(h(?:igh)?|m(?:ed)?(?:ium)?|l(?:ow)?))(?=\s|$)/gi,
    (match, full) => {
      if (prioritySet) return full;
      prioritySet = true;
      return `<span class="hl-priority">${full}</span>`;
    },
  );

  // 2. Pending priority: ! alone at end of input (no word chars follow)
  html = html.replace(/((?:^|\s)!)$/g, (match, full) => {
    if (prioritySet) return full;
    prioritySet = true;
    return `<span class="hl-priority">${full}</span>`;
  });

  if (validLabels && validLabels.length > 0) {
    const labels = validLabels.map((l) => l.toLowerCase());

    // 3. Confirmed labels: #word at space/end — only if word matches a known label
    html = html.replace(/((?:^|\s)#([\w-]+))(?=\s|$)/g, (match, full, name) => {
      if (labels.includes(name.toLowerCase())) {
        return `<span class="hl-label">${full}</span>`;
      }
      return full;
    });

    // 4. Pending labels: # + prefix at end of input — only if prefix matches a known label
    html = html.replace(/((?:^|\s)#([\w-]*))$/g, (match, full, prefix) => {
      if (!prefix || labels.some((l) => l.startsWith(prefix.toLowerCase()))) {
        return `<span class="hl-label">${full}</span>`;
      }
      return full;
    });
  } else {
    // Fallback: highlight any #word syntactically
    html = html.replace(/((?:^|\s)#([\w-]+))(?=\s|$)/g, '<span class="hl-label">$1</span>');
    html = html.replace(/((?:^|\s)#([\w-]*))(?!\s)/g, '<span class="hl-label">$1</span>');
  }

  return html;
}
