# Plan: Markdown Task Descriptions (P1 #10)

## Summary

Add markdown editing + rendering to task descriptions. Reddit-style dual mode: rendered by default, raw markdown toggle. A minimal formatting toolbar helps non-technical users insert syntax. No data model change — descriptions stay plain text strings.

## Dependencies to Add

```
apps/frontend/package.json
  + ngx-markdown  (v21.3.0 — built for Angular 21)
  + marked         (peer dep of ngx-markdown)
```

Optional peer deps (`clipboard`, `emoji-toolkit`, `katex`, `mermaid`, `prismjs`) — skip for now. If users want code highlighting or mermaid later, add them then.

## New Files

### 1. `apps/frontend/src/app/shared/ui/markdown-editor/markdown-editor.component.ts`

Two-mode markdown editor component:

- **Inputs**: `value` (signal, the markdown string), `placeholder` (string), `rows` (number)
- **Outputs**: `valueChange` (emits updated string)
- **Internal state**: `previewMode` signal (default `false` — shows textarea)
- **Template modes**:

  **Edit mode** (`previewMode() === false`):
  ```
  <textarea rows="7" [ngModel]="value()" ...></textarea>
  <format-toolbar (insertSyntax)="onInsertSyntax($event)" 
                  (togglePreview)="previewMode.set(true)">
  </format-toolbar>
  ```

  **Preview mode** (`previewMode() === true`):
  ```
  <markdown [data]="value()"></markdown>
  <format-toolbar [previewMode]="true" 
                  (togglePreview)="previewMode.set(false)">
  </format-toolbar>
  ```

- `onInsertSyntax(wrapper)` — wraps selected text or inserts at cursor position, updates `value`
- Uses `FormsModule` for `ngModel` binding
- Imports `MarkdownComponent` from `ngx-markdown`
- Self-contained styles: border, radius matching existing field design tokens

### 2. `apps/frontend/src/app/shared/ui/markdown-editor/format-toolbar.component.ts`

Slim toolbar with markdown syntax insertion helpers:

- **Inputs**: `previewMode` (boolean)
- **Outputs**: `insertSyntax` (emits `{ prefix: string; suffix: string; multiline?: boolean }`), `togglePreview` (void)
- **Buttons**: B (bold `**`), I (italic `_`), S (strikethrough `~~`), link (`[]()` — prompts for URL), list (`- ` at line start), preview toggle
- Uses FontAwesome icons: `faBold`, `faItalic`, `faStrikethrough`, `faLink`, `faList`, `faEye` / `faEdit`
- Styled as a horizontal bar below the editor, minimalist (matching task-modal field aesthetic)

### 3. `apps/frontend/src/app/shared/ui/markdown-editor/markdown-editor.component.html`

(Could be inline or separate file — inline is fine for a component this focused)

### 4. `apps/frontend/src/app/shared/ui/markdown-editor/format-toolbar.component.html`

(Could be inline)

## Files to Modify

### 5. `apps/frontend/src/app/app.config.ts`

Add `provideMarkdown()` to the providers array:

```ts
import { provideMarkdown } from 'ngx-markdown';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing
    provideMarkdown(),
  ],
};
```

Default marked config (gfm = true, breaks = false) is fine. No custom options needed.

### 6. `apps/frontend/src/app/features/personal/components/personal-task-modal.component.ts`

- Add `MarkdownEditorComponent` to `imports` array
- No signal/logic changes needed — `draftDescription` stays a plain string signal

### 7. `apps/frontend/src/app/features/personal/components/personal-task-modal.component.html`

Replace the description `<textarea>` block (lines 54-66):

```html
<!-- BEFORE (remove) -->
<label class="field">
  <span class="field-label">Description</span>
  <textarea ...></textarea>
  @if (descriptionError()) { ... }
</label>

<!-- AFTER -->
<label class="field">
  <span class="field-label">Description</span>
  <app-markdown-editor
    [value]="draftDescription()"
    (valueChange)="draftDescription.set($event)"
    placeholder="Capture extra context, constraints, or subtasks here."
    rows="7"
  ></app-markdown-editor>
  @if (descriptionError()) {
    <p class="field-error-message">{{ descriptionError() }}</p>
  }
</label>
```

### 8. `apps/frontend/src/app/features/personal/components/personal-task-card.component.ts`

- Add `MarkdownPipe` from `ngx-markdown` to `imports`
- Also add `AsyncPipe` (required since the markdown pipe returns an Observable)

### 9. `apps/frontend/src/app/features/personal/components/personal-task-card.component.ts` (inline template)

Replace the description rendering block:

```html
<!-- BEFORE -->
@if (mode === 'default' && showDescription && task.description) {
  <p class="task-description">
    {{ task.description.length > 120 ? (task.description | slice: 0 : 120) + '...' : task.description }}
  </p>
}

<!-- AFTER -->
@if (mode === 'default' && showDescription && task.description) {
  <div class="task-description" [innerHTML]="task.description | markdown | async"></div>
}
```

Note: Use a `<div>` with `[innerHTML]` binding and the `markdown` pipe. The `| async` is needed because the pipe returns an Observable<string>. Style the div to match the existing `<p>` styling (truncation, line-clamp). Add `word-break: break-word` to prevent long unbroken text from overflowing.

For truncation, apply `display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;` to the rendered div — this handles rendered HTML naturally without needing character-count slicing.

## Data Model

**No changes.** `task.description` remains a plain `string` (VARCHAR in SQLite). Markdown rendering is purely a display concern. Exports, search, and notifications all operate on the raw markdown text — this is a key advantage over WYSIWYG/HTML storage.

## Verification

1. **Create a task with markdown** in the modal: type `**bold** and _italic_` in the description
2. **Toggle preview** — verify it renders correctly (bold, italic, lists, links)
3. **Save** the task
4. **View the task card** in Inbox/Today/Upcoming — description renders with markdown formatting, truncated to ~3 lines
5. **Re-open the modal** — description shows as raw markdown in the textarea (editable)
6. **Test toolbar buttons** — click B, select text, click B again — verify `**syntax wrapping**`
7. **Test link button** — verify it prompts for URL and inserts `[text](url)`
8. **Test in all views**: Inbox, Today (active), Upcoming, Search, Project detail (active)
9. **Verify no descriptions** appear in: Archive, completed sections of Today/Project-detail
10. **Visual**: Verify the toolbar matches the modal's design tokens, preview mode switches cleanly
11. **Accessibility**: Toolbar buttons have aria-labels, preview toggle announces state change
