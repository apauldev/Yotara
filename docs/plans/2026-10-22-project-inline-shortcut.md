# Plan: Inline Project Shortcut and Capture-Token Date Fix

> **Owner:** @apauldev
> **Date:** 2026-10-22
>
> Give the capture bar a first-class project shortcut, stop capture tokens from
> breaking NLP date recognition, and make unresolved tokens honest instead of
> silently surviving in the saved title.

---

## 1. Verified findings (2026-10-22 session)

Reproduced against the dev stack (`apps/api/data/yotara.db`, Playwright on
`localhost:4200`). Input: `go to meeting tomorrow at 9am #call !admin`.

| Piece | Expected | Actual |
|:---|:---|:---|
| `tomorrow at 9am` | Date + time draft | ✅ "resolves to Friday, Oct 23, 2026, 9:00 AM" |
| `#call` | "Call" label applied, tag stripped | ✅ (case-insensitive) |
| `!admin` | File into the "Admin" project | ❌ `!` is priority-only; token stays as literal text; **no way to set a project inline** |
| `!admin` after the date phrase | Date still resolves | ❌ **date draft vanishes; created task has no due date/time** |

The date failure comes from `COMMAND_TOKEN_PATTERN`
(`apps/frontend/src/app/features/personal/utils/task-due-date-parser.ts`,
line 114). The mask only covers the priority whitelist and `#tags`:

```ts
const COMMAND_TOKEN_PATTERN =
  /(?:^|\s)(?:!(?:h|l|m|high|med|medium|low)\b|#[\w-]+\b)/gi;
```

`!admin` survives masking, and after the parser accepts the "tomorrow at 9am"
time suffix, the leftover non-punctuation text trips the fail-closed rejection
(`validateCandidateContext` → `reject('unsupported')`), discarding the whole
phrase. Any unrecognized `!word` after a live date phrase silently deletes the
date.

Secondary finding from the same session: unresolved tokens are stored raw in
the task title with no feedback while typing (the test account, which lacks a
"Call" label, stored the title verbatim: `go to meeting tomorrow at 9am #call
!admin`). Phase 1 chose to preserve unknown tags rather than delete text —
correct instinct — but preservation is currently invisible.

## 2. Product decisions

**The capture bar supports three inline commands, one per sigil:**

| Sigil | Target | Status |
|:---|:---|:---|
| `#name` | Label (case-insensitive, live label names) | Existing |
| `!h` / `!high` / `!m` / `!med` / `!medium` / `!l` / `!low` | Priority | Existing |
| `@name` | Project (case-insensitive, live project names) | **New** |

- `!` stays priority-only. Project matching is a distinct sigil so a label and
  project that share a name stay distinguishable — the current account already
  has "Ideas" as both.
- **Single-word names first.** The token grammar is `[\w-]+` (ASCII word
  characters and hyphens), exactly like labels today. Space-containing and
  non-Unicode-safe project names ("Deep Work") are not inline-matchable in this
  iteration; the dropdown and modal remain the way to file into them. This keeps
  the grammar context-free (one token, one match) and matches the label
  behavior users already know.
- **Resolution is preservation-first.** Only tokens that resolve to a real
  entity are stripped from the title. Unresolved `@x` / `#x` / `!word` stay in
  the title verbatim, and the capture bar must say so visually (see §5).
- **Inline project tokens are only parsed for NEW tasks.** An existing task's
  stored title is authoritative; editing never re-parses or re-strips.
- **Precedence when several project sources exist:** inline `@token` > capture
  bar dropdown > context default (project detail, etc.). The inline token is the
  most deliberate gesture in the input, so it wins. With multiple resolved
  `@tokens` in one title, the first resolved token wins and all resolved tokens
  are stripped; unresolved ones stay.
- Capture still creates tasks with `status = 'inbox'`; this branch does not
  change the Inbox model. Scope interactions with
  `docs/plans/2026-10-22-inbox-quick-capture.md` in §8.

## 3. Scope

**In scope**

- Extend `parseTaskCommand` with project recognition, resolution, and stripping.
- Mask command tokens in `parseTaskDueDate` uniformly for `#`, `!`, `@`, so
  capture tokens can never poison the NLP date phrase.
- Capture bar: `@` triggers project autocomplete (suggestions from the live
  project list), keyboard navigation, token insertion, and an opportunity
  affordance for unresolved tokens.
- Highlighter support for project tokens and the unresolved-token state.
- Task page submit path: resolve the project token, apply precedence.
- Task modal: preselect the parsed project when creating from a capture title.
- Unit, component, and e2e tests.
- Copy and docs updates for the inline-commands help text.

**Out of scope**

- Space-containing or Unicode project names inline (follow-up §9).
- Creating projects from the capture bar (labels offer create; projects keep
  their dedicated page for this iteration).
- Removing the seeded Inbox project / default-project fallback (own plan).
- Changing the date parser's single-phrase fail-closed grammar itself; only the
  token mask changes.
- Re-parsing tokens when editing existing tasks or subtasks.

## 4. Parser changes

### `apps/frontend/src/app/features/personal/utils/task-command-parser.ts`

- Extend `ParsedTaskCommand`:

```ts
export interface ParsedTaskCommand {
  title: string;
  priority?: Priority;
  labelNames: string[];
  projectName?: string;              // resolved project name, undefined if none
  unresolvedLabelNames: string[];    // existing
  unresolvedProjectNames: string[];  // new
}
```

- New pattern: `/\/(?:^|\s)@([\w-]+)\b/` — same shape as the label pattern.
- New option: `knownProjectNames?: string[]`. Resolution mirrors labels:
  case-insensitive, first-match-wins, only resolved tokens are removed from the
  title, unresolved tokens are collected in `unresolvedProjectNames` and left
  in place.
- When no `knownProjectNames` are supplied (legacy callers), preserve the old
  behavior: extract-and-strip every `@token`? No — the label precedent sends the
  live list everywhere except tests. Pass `undefined` → treat `@tokens` as
  unresolved and leave them untouched (do not silently strip). Extraction only
  happens for callers that explicitly ask for it.
- Multiple resolved project tokens: strip all, apply the first.
- The final `title.trim().replace(/\s+/g, ' ')` normalization is unchanged.

### `apps/frontend/src/app/features/personal/utils/task-due-date-parser.ts`

- Replace the whitelist mask with a sigil-level mask:

```ts
const COMMAND_TOKEN_PATTERN = /(?:^|\s)[#!@][\w-]+\b/gi;
```

- Rationale: the capture grammar now recognizes-or-preserves every `#`/`!`/`@`
  token as capture metadata. For purposes of date recognition these tokens are
  never prose, so the phrase validator must not see them. This closes the
  `!admin` hole and keeps known-token behavior identical.
- `maskCommandTokens` keeps its blank-space-preserving replacement
  (`' '.repeat(match.length)`) so offsets used by highlighting stay stable.
- Document in the function contract: a sentence like "email
  bob@example.com tomorrow" is safe — the `@` there is not preceded by a word
  boundary/space, so it is not a token. A spaced false positive
  ("email bob @example tomorrow") leaves the date intact instead of dying, and
  the unresolved-token hint in §5 covers discoverability.

## 5. Capture bar changes

`apps/frontend/src/app/features/personal/components/capture-bar.component.ts`

- **Trigger detection.** `onCaptureInput` mirrors the `#` logic for `@`:
  text since the last `@` before the caret becomes the active project search,
  non-word characters close it. The two active searches are mutually exclusive
  (whichever sigil is closest to the caret wins).
- **Suggestions.** A project suggestion list reuses the tag-suggestions
  presentation: options from `ProjectService.projects()` filtered by the active
  search, substring match, top 5, keyboard navigation (↑/↓/Enter/Tab/Escape)
  shared with the label list. No "Create" affordance; when nothing matches, the
  list shows a muted "No project named 'x'" row and a click/Enter leaves the
  token in place.
- **Insertion.** Selecting a suggestion inserts `@CanonicalName ` using the same
  word-boundary-aware replacement logic as `insertLabelToken` (capture the
  pre-async search string, refuse to rewrite a token that kept typing).
- **Highlighter.** `highlightInlineCommands(text, labels, projects)` colors
  resolved project tokens with a dedicated neutral accent, priority tokens as
  today, and — the new honesty affordance — renders unresolved `#x` / `@x` /
  `!word` tokens in a subdued "won't apply" style (existing CSS variable, e.g.
  `--on-surface-muted`; no new color constants per the hardcoded-color lint
  rule). The hint is deliberate: preservation with feedback, never silent.
- **Submit behavior is unchanged from the parser's result:** the page-level
  `handleCapture()` consumes `projectName` alongside `labelNames`.

## 6. Page, workspace, and modal changes

- **`task-list-page.component.ts` `handleCapture()`** — pass `projects` names
  into `parseTaskCommand`; resolve `projectName` → project id from
  `ProjectService`; apply precedence (inline token > bar select >
  `defaultCaptureProjectId()`); quick path includes the id on create; details
  path forwards it to `openCreateTaskModal`.
- **`personal-task-workspace.component.ts`** — `openCreateTaskModal` gains no
  new signature; an explicit project id simply arrives through the existing
  `projectId` parameter.
- **`personal-task-modal.component.ts` `hydrateDraft()`** — when creating from
  an `initialTitle`, also seed `draftProjectId` from the parsed project
  (labels already seed this way). The modal keeps its own project dropdown as
  the visible control; no `@`-autocomplete inside the modal in this iteration.
  Editing an existing task never parses tokens.

## 7. Tests

**Parser (`task-command-parser.spec.ts`)**

- Resolves case-insensitively and strips: `@admin` → `projectName: 'Admin'`,
  title cleaned.
- Unresolved `@x` stays in the title and lands in `unresolvedProjectNames`.
- First-resolved wins with several `@tokens`; all resolved tokens stripped.
- Does not match mid-word (`foo@bar`) or after punctuation preceding characters.
- No `knownProjectNames` → nothing extracted, nothing stripped.
- Priority + label + project in one title, both orders.
- Priority whitelist untouched (`!admin` is never a priority).

**Due-date parser (`task-due-date-parser.spec.ts`)**

- `go to meeting tomorrow at 9am !admin` → status `date`, 9:00 AM (regression).
- Same with `#call`, `@admin`, unknown `!word`, and combinations thereof.
- `bob@example.com tomorrow` is not treated as a token; `@example` alone in
  prose does not kill the date.
- Prior behavior for valid priority words and tags is unchanged.

**Capture bar (`capture-bar` component specs, task-list page specs)**

- Typing `@` opens project suggestions; ↑/↓/Enter selects and inserts the
  token; Escape closes without touching the title.
- Token insertion is boundary-safe while an async insert completes.
- Submit applies the resolved project; inline token beats the dropdown select.
- Unresolved token leaves the title intact and shows the muted style.
- Date preview persists when a token follows the phrase (component-level
  regression for §1).

**Task modal specs**

- Create-from-title seeds `draftProjectId` from the parsed token and shows it
  in the summary; save files into that project.
- Editing does not re-strip tokens.

**e2e (`apps/frontend/e2e/specs/authenticated`)**

- Capture `PW e2e @<seeded-project> filing` quick capture → task verified in
  the project's detail page.
- `… tomorrow at 9am @<seeded-project>` → date and project on the API response.

## 8. Relationship to the Inbox quick-capture plan

`docs/plans/2026-10-22-inbox-quick-capture.md` removes the seeded Inbox
project, the default-project fallback, and makes "No project" the capture
default. Sequencing is safe in either order, but note:

- With that plan shipped, `@project` becomes the primary one-keystroke filing
  path on capture; the "precedence" rule above (inline token first) is designed
  to survive it unchanged.
- The plan's notification copy rules apply verbatim to token-filed captures: a
  token-filed task announces the project, never `Inbox (Project)`.
- Do not implement the "No project" reset inside this branch; keep branches
  orthogonal.

## 9. Follow-ups

- Space-containing and Unicode project names inline via longest-match against
  the live list (the label combobox could adopt the same extension).
- Consider the same "unresolved hint" for the task modal title input.
- Revisit the suggestion overlay covering the date preview row while open
  (observed in the geometry probe; affects labels today too).
- The labels-pane "Add task" modal hides the Project picker below the fold on
  ≤960px viewports (session finding; separate fix).

## 10. Implementation order

1. `task-command-parser.ts` project support + unit tests (pure, TDD).
2. `task-due-date-parser.ts` sigil-level mask + regression tests.
3. Capture-bar `@` trigger, project suggestions, insertion.
4. Highlighter + unresolved-token styling.
5. Submit-path precedence in `task-list-page`, modal seeding.
6. Component and e2e suites, docs copy.

Suggested branch: `feat/project-inline-shortcut`.

## 11. Acceptance criteria

- `go to meeting tomorrow at 9am #call @admin` creates a task with the Call
  label, the Admin project, tomorrow 9:00 AM due time, title `go to meeting`,
  and all tokens stripped.
- `… at 9am !admin` (no Admin project match for `!`) keeps `!admin` in the
  title, keeps the date, and visibly hints that the token did not apply.
- Unresolved `@x` / `#x` tokens never delete text and never affect the date
  draft.
- Inline `@token` beats the capture dropdown when both are set.
- Editing a task never rewrites its title or re-assigns its project.
- All parser, date-parser, capture-bar, modal, and e2e suites pass.
