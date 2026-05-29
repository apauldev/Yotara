export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightInlineCommands(text: string): string {
  let html = escapeHtml(text);

  // Highlight Priorities: !h, !high, etc. (requires space before or start of string)
  html = html.replace(
    /((?:^| )!([lhm]|low|med|medium|high)\b)/gi,
    '<span class="hl-priority">$1</span>',
  );

  // Highlight Labels: #tag (requires space before or start of string)
  html = html.replace(/((?:^| )#([\w-]+)\b)/g, '<span class="hl-label">$1</span>');

  return html;
}
