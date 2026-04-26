Create a single UI token map doc (color, spacing, radius, elevation, typography) and enforce usage in components instead of ad-hoc values.

Replace hardcoded semantic colors (#dd8b4c, #84a4f6, #c97c46, etc.) with named tokens (--status-overdue, --status-complete, etc.).

Define elevation tiers (elevation-1/2/3) and normalize shadows across cards, modals, FAB, and menus.

Establish a typography scale (display, h1, h2, body, caption, overline) and align current page-specific overrides to it.

Normalize uppercase micro-label styles (eyebrow, section heading, chip text) into reusable utility classes.

Audit color contrast for muted text/chips in light + dark themes to meet WCAG AA at all sizes.

Add explicit :focus-visible states for all interactive elements (buttons, links, chips, icon controls, cards).

Avoid removing default outlines without replacement; ensure custom focus rings are visible on every control.

Ensure touch target minimums (44px) for icon-only actions in topbar, task rows, and section tools.

Create a spacing scale (4/8-based) and audit layout gaps/padding for consistency between shell, pages, and cards.

Add a compact density mode (already hinted in UI) and define card/list height reductions.

Align topbar action cluster and page grid rhythm (brand/search/actions) to reduce visual drift at wide widths.

Componentize repeated card patterns (empty states, task stacks, section headers, chips) to reduce style divergence.

Create a shared chip system (priority/status/meta/labels) with variants and semantic color mapping.

Unify modal design language (radius, paddings, header density, footer actions) across generic and task modals.

Define interaction states for every control (default/hover/focus/active/disabled/loading/success/error).

Add keyboard navigation checks for menus/modals (trap focus, ESC close, arrow navigation where applicable).

Add subtle motion standards (durations/easing) and centralize transitions.

Run responsive pass at key breakpoints (320/375/768/1024/1280+) for sidebar, topbar search, modal, and FAB overlap.

Verify sticky/fixed controls do not occlude content (FAB on task list, mobile drawers).

Test dark theme parity screen-by-screen for chips, borders, status cues, and elevated surfaces.

Audit empty/loading/error states for each major page and ensure they are visually/systemically consistent.

Finish and polish global search UI consistency (topbar input vs dedicated search page styling).

Polish confirmation/dialog patterns to match one visual standard across delete/archive/logout flows.

Create a per-screen QA checklist (contrast, focus, keyboard, responsive, empty/loading/error, dark mode, density).

Add automated accessibility checks (axe) to CI and local test scripts for regression prevention.

Add visual regression snapshots for core screens (Inbox, Today, Upcoming, Project Detail, Modal, Login). 

Additional accessibility issues to add

    Task cards are mouse-clickable but not keyboard-activatable (semantic mismatch).
    article.task-card has (click)="select.emit()", but no tabindex, no keyboard handler, and no button/link semantics. Keyboard users can’t open task details via Enter/Space.

    Two <select> controls in task modal are unlabeled for AT (programmatic label missing).
    “Project” and “Status” use a visual <span class="field-label">, but the <select> elements are not wrapped in <label> and have no id/for, aria-label, or aria-labelledby.

    Invalid nested label structure in completion toggle (can confuse screen readers).
    A <label class="toggle-row"> contains another <label class="checkbox-control">. Nested labels are invalid HTML and can produce inconsistent AT behavior.

    Validation errors are visual-only in multiple places (missing aria-invalid / aria-describedby / live region patterns).
    Inputs get error classes and text, but no field-level ARIA wiring.

    Global/app errors and status text are not announced (role="alert" / aria-live absent).
    Example: capture errors and loading/status copy are plain text nodes.

    Focus visibility is still inconsistent (several inputs remove outline without universal replacement).
    You already improved some areas, but there are still outline: none patterns that need guaranteed :focus-visible fallback everywhere.

    Multiple h1s are indeed present in personal shell views (your heading concern is valid in this app structure).
    Sidebar brand uses h1 and page content also uses h1 (e.g., Inbox).
