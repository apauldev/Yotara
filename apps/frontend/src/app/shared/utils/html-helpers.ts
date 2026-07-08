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

  // 1. Confirmed valid priorities: !word followed by space or end
  //    e.g. "!h ", "!high ", "!m", "!medium" at end of input
  html = html.replace(
    /((?:^|\s)!(h(?:igh)?|m(?:ed)?(?:ium)?|l(?:ow)?))(?=\s|$)/gi,
    '<span class="hl-priority">$1</span>',
  );

  // 2. Active/pending priorities: ! followed by optional word chars, no space after
  //    Catches "!" alone, "!h" mid-word, "!xyz" while still typing — unhighlighted once space follows
  html = html.replace(/((?:^|\s)!(\w*))(?!\s)/g, '<span class="hl-priority">$1</span>');

  // 3. Confirmed labels: #word followed by space or end
  html = html.replace(/((?:^|\s)#([\w-]+))(?=\s|$)/g, '<span class="hl-label">$1</span>');

  // 4. Active/pending labels: # followed by optional word chars, no space after
  //    Catches "#" alone, "#tag" mid-word, "#incomplete" while typing
  html = html.replace(/((?:^|\s)#([\w-]*))(?!\s)/g, '<span class="hl-label">$1</span>');

  return html;
}
