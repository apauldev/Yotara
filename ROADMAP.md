# Yotara MVP Roadmap

> **Superseded by [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).** This document is kept as a historical snapshot of the planned MVP surface area. The live source of architectural decisions, runtime anti-patterns, and priority ordering is `docs/ARCHITECTURE.md`. New work goes to GitHub Issues, not this file. Last meaningful update: 2026-05-29.

This document outlines the complete list of screens, pages, and modals needed for the Yotara MVP. Items are grouped by priority and logical build order—with the first 8–10 screens forming the foundation for a usable personal task manager.

### Competitive Recommendations

Based on the current product direction versus comparable task managers, the next best improvements are:

- Make the quick-add flow the clear hero interaction everywhere, especially in the personal shell and inbox.
- Keep the task modal lightweight by default and reveal advanced metadata progressively.
- Continue the mobile finish pass so task detail, markdown, and toolbar controls feel thumb-friendly rather than desktop-shaped.
- Strengthen post-capture triage with smarter defaults for project, labels, priority, and due date suggestions.
- Improve search and resurfacing so richer task metadata feels valuable after the initial entry.
- Add keyboard-first shortcuts and faster command-style actions for power users.
- Keep low-level features like subtasks and markdown, but avoid letting them dominate the main task entry path.
- Treat mobile density, spacing, and touch targets as core product quality, not cosmetic polish.
- Prioritize “what should I do next?” clarity over exposing every metadata field at once.

---

## Implementation-Aware Priority Roadmap

Status legend: ✅ Done, 🟡 Partial, ⬜ Not started.

### Verified Done In Current Code

- ✅ Auth: login, sign up, session refresh, logout, onboarding mode selection, and change password
- ✅ Personal shell: sidebar/bottom navigation, top search form, quick-add entry point, user menu, and notifications icon placeholder
- ✅ Personal task views: Inbox, Today, Upcoming, project detail, and archive page shell with full restore/archive lifecycle
- ✅ Archive page behavior: complete archive list with restore and permanent delete, proper `archived_at` timestamp handling
- ✅ Task CRUD foundation: paginated API loading, create/update/delete API, soft delete, labels on tasks, project assignment, priority, due date, simple mode, and personal buckets
- ✅ Subtasks: hierarchical task management (1-level deep) with automatic progress tracking (completed/total counts) and parent project inheritance
- ✅ Recurring tasks: automated task materialization for daily, weekly, monthly, and yearly frequencies with robust calendar-based date math
- ✅ Personal project CRUD foundation: create, list, update, detail view, and project-scoped tasks
- ✅ Personal label CRUD: labels page, create/edit/delete modal, color selection, label counts, and task label filtering
- ✅ Shared UI primitives: accessible modal, reusable confirm dialog, logout confirm modal, page header, section header, button utility, date picker, and empty-state directive
- ✅ Settings foundation: theme selection, change password flow, and logout confirmation
- ✅ Search foundation: task/project/label search service and canonical `/search?q=...` route with standalone component
- ✅ Global status system: professional loading indicator, error toast notifications, and persistent logging to localStorage (#106)
- ✅ 404 page: friendly error page with animation and navigation (#103)
- ✅ API/docs/devops foundation: OpenAPI docs, Swagger UI, Dockerfiles, local build-based Compose, Docker smoke script, and core API tests
- ✅ Markdown support: editor with format toolbar, preview toggle, and DOMPurify sanitization
- ✅ Data export: JSON and CSV export from Settings with granular toggles (subtasks, descriptions, archived items)
- ✅ Insights panel: daily productivity insights with Font Awesome icons, persistence, and settings toggle
- ✅ Task list refactor: page decomposed into components, smooth list animations, proper pagination
- ✅ Archive migrated to shared `EmptyStateComponent`
- ✅ Automated release script with semver analysis, dry-run support, and idempotency
- ✅ "Don't show again" option on complete task confirmation

### P0 – Personal Mode Polish (Must Have Before Public Demo)

| # | Task | Status | Effort | Current code reality / next action |
|---|------|--------|--------|------------------------------------|
| 1 | Archive view: show `archived` tasks with restore and permanent delete buttons | ✅ Done | Low | Completed in #101. Archive lifecycle properly implemented with `archived_at` timestamps, restore flow, and UI in place. |
| 2 | Confirmation dialogs: reusable modal for delete/archive actions | ✅ Done | Low | Shared `Modal` and `ConfirmDialog` components fully implemented and used throughout app for logout, label delete, task operations, and archive actions. |
| 3 | Global search results page (`/search?q=...`): titles, descriptions, labels | ✅ Done | Medium | Canonical `/search?q=...` route is live with lazy-loaded `SearchPageComponent`. Supports tabbed filtering (all/tasks/projects/labels), pagination, date/alpha sort, and query params via shell search bar. Search service handles full-text matching with scoring, recency and urgency bonuses. |
| 4 | 404 page: friendly error with link to Inbox | ✅ Done | Low | Implemented in #103 with animation. Friendly 404 page with navigation back to inbox. |
| 5 | Task loading states | ✅ Done | Low | Three-layer loading system: global animated top-of-page progress bar (AppStatusComponent), per-service `loading()` signals that disable action buttons during fetch, and descriptive status copy text. Fast local SQLite queries (<200ms) render data with no perceptible delay, making skeleton placeholders unnecessary. |
| 6 | Empty states for Inbox, Today, Upcoming, Projects, Labels, Archive | ✅ Done | Low | `EmptyStateComponent` used across every main view: Inbox/Today/Upcoming with contextual icons and copy (faCloud, faSun, faCalendarDay), projects-page, project-detail-page, labels-page, search-page, and archive-page. All empty states are consistent and intentional. |
| 7 | Form validation and error polish | ✅ Done | Low | Basic validation ✅ present in all forms. Global error handling system implemented (#106) with professional toast notifications, error interception, and persistent logging. Validation copy and disabled/loading states standardized. |

**P0 target:** 1–2 weeks at 1–2 hours/day. This is the public-demo gate. **P0 is now complete.**

### P0.5 – Technical Hardening (Robustness Gates)

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| H1 | **Database Transactions:** Wrap multi-step writes (create/update task + labels + subtasks) in atomic transactions | ⬜ Not started | Low | Prevents partial data corruption if one step in a multi-table write fails. |
| H2 | **N+1 Query Optimization:** Optimize task list retrieval to batch label fetching | ⬜ Not started | Medium | Current `Promise.all` per-row DB calls will lag at scale. Move to a single joined or batched query. |
| H3 | **Structured Error Handling:** Implement custom API error classes and global Fastify error mapping | ⬜ Not started | Low | Replace `new Error()` strings with typed errors (e.g., `TaskValidationError`) for consistent HTTP status codes. |
| H4 | **Task List Scalability:** Replace single `pageSize=100&includeSubtasks=true` fetch with server-driven per-page requests | ⬜ Not started | Medium | Current `task.service.ts` fetches all tasks+subtasks in one call, then slices client-side. All `computed()` filters assume full dataset in memory. Tasks beyond 100 are invisible. |

### P1 – High-Value Personal Features

| # | Task | Status | Effort | Current code reality / next action |
|---|------|--------|--------|------------------------------------|
| 8 | Subtasks UI: checklist inside task modal | ✅ Done | Medium | Hierarchical task management implemented. Subtasks inherit parent project and are excluded from main lists by default. Modal includes subtask creation and completion tracking. |
| 9 | Recurring tasks: daily/weekly/monthly | ✅ Done | Medium | Automated materialization logic implemented in API service. Supports daily, weekly, monthly, and yearly cycles. New instances generated upon completion of the previous instance. |
| 10 | Markdown preview in task description | ✅ Done | Low | Markdown editor with format toolbar, preview toggle, and DOMPurify sanitization implemented. |
| 11 | Browser notifications for due reminders | ⬜ Not started | Medium | Settings has disabled notification rows; no permission/scheduler/service worker flow yet. |
| 12 | Export data: JSON and CSV from Settings | ✅ Done | Low | Export implemented in Settings with JSON/CSV formats, granular toggles for subtasks, descriptions, and archived items. Backend export mode bypasses 100-task pagination limit. Project and label IDs resolved to human-readable names in exports. |
| 13 | Natural Language Task Entry: date parsing, projects (#), and labels (@) | ⬜ Not started | Medium | Enhance existing regex parser with `chrono-node` for dates and align syntax with standard conventions (#project, @label). |

**P1 target:** 2–3 weeks after P0.

### P2a – Team Mode Foundation (Core for SaaS / Non-Profits)

> Items in this section are numbered `P2a-N` to disambiguate from the `12`/`13` used in P1 (a historical duplicate-numbering bug, kept here for back-compat with the original MVP scope).

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| P2a-1 | **Database strategy for team mode:** SQLite for self-hosted, Turso or Postgres for cloud SaaS | ⬜ Not started | Medium | Self-hosted instances keep SQLite (one DB per company, works at 30-person scale with WAL mode). Cloud SaaS needs a hosted database for multi-tenancy and team isolation. Turso is the leading candidate — keeps the SQLite dialect, adds replication and edge distribution. |
| P2a-2 | **Permissions: owner vs member roles** | ⬜ Not started | Medium | MVP team mode needs at least `owner` (invite, remove, delete workspace) and `member` (manage tasks, comment). Add a `role` field to workspace membership. |
| P2a-3 | **Workspace data model: workspaces and memberships** | ⬜ Not started | Medium | Current backend only stores `user.workspaceMode`; no workspace tables yet. |
| P2a-4 | **Workspace-scoped labels and projects** | ⬜ Not started | Low | Clarify and implement: labels and projects are workspace-scoped in team mode, user-scoped in personal mode. Affects the data model — decide early. |
| P2a-5 | **Workspace switcher: create/switch workspaces** | ⬜ Not started | Low | Team shell has placeholder workspace navigation/label only; no real switcher or persistence. |
| P2a-6 | **Workspace settings: members list + remove member** | ⬜ Not started | Low | Depends on workspace membership. |
| P2a-7 | **Invite link flow: token + `/join/:token`** | ⬜ Not started | Medium | No invite tables/routes/pages. |
| P2a-8 | **Task assignment: `assigneeId` and avatar in lists** | ⬜ Not started | Low | Shared/OpenAPI mention `assigneeId`, but DB schema and task UI do not persist/render it. |
| P2a-9 | **"Assigned to me" smart list** | ⬜ Not started | Low | Depends on assignment. |
| P2a-10 | **Activity log for workspace changes** | ⬜ Not started | Medium | Basic audit trail: who changed what, when. Needed for accountability in shared workspaces. Shares event model with comments/notifications. |

**P2a target:** 4–6 weeks. Workspace, roles, assignment, and invite are the critical path for a usable team mode.

### P2b – Team Collaboration (Post-Foundation)

> Numbered `P2b-N` for consistency with the P2a fix.

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| P2b-1 | **Comments on tasks (flat, simple)** | ⬜ Not started | Medium | Shared `Comment` type exists; no DB/API/UI. Start with flat comments, edit/delete, no threading. Markdown support optional for MVP. |
| P2b-2 | **Team Board: columns per member, drag to reassign** | ⬜ Not started | Medium | Depends on workspaces, membership, and assignment. Basic kanban with drag-to-reassign as the hero team interaction. |
| P2b-3 | **Real-time updates: polling** | ⬜ Not started | Medium | Instead of WebSockets, use polling (10–30s interval) for task changes in team mode. Dramatically simpler, sufficient for small teams. Upgrade to WebSockets later if demand warrants. |

**P2b target:** 3–4 weeks after P2a. Comments, board, and basic live sync complete the team experience.

**Database note:** Self-hosted instances keep SQLite — one DB per company, sufficient for 30-person teams with WAL mode. The managed cloud version needs a hosted database (Turso or Postgres) for multi-tenancy and team isolation. Use Drizzle so the schema stays portable across backends.

### P3 – Deployment & Distribution

> Numbered `P3-N`. Most of these items are now Sprint 0 in `docs/ARCHITECTURE.md`.

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| P3-1 | Pre-built Docker images pushed to GHCR or Docker Hub on release | ⬜ Not started | Medium | Dockerfiles exist; add GitHub Actions workflow to build and push multi-platform images on tag. |
| P3-2 | Coverage reporting with threshold gates | ⬜ Not started | Low | Integrate c8/istanbul coverage collection; upload to Codecov; enforce minimum coverage in CI. |
| P3-3 | Dependabot / Renovate for automated dependency updates | ⬜ Not started | Low | Enable Dependabot on GitHub; group minor/patch updates; review monthly. |
| P3-4 | Security scanning (CodeQL + Snyk) | ⬜ Not started | Low | Add CodeQL analysis workflow; enable Dependabot security alerts; review weekly. |
| P3-5 | Docker Compose with pre-built images | 🟡 Partial | Low | Local build-based Compose is ✅ done, but pre-built image Compose is not. |
| P3-6 | Render.com template (`render.yaml`) | ⬜ Not started | Medium | Not present. |
| P3-7 | Railway.app template (`railway.toml`) | ⬜ Not started | Medium | Not present. |
| P3-8 | Live demo instance and README link | ⬜ Not started | Medium | Not present. |

**P3 target:** 2–3 weeks. Can run in parallel with P2 once image publishing is stable.

### P4 – Polish & Nice-to-Haves (Post-v1)

> Numbered `P4-N`. Most items are intentionally deferred — see `docs/ARCHITECTURE.md` for the runtime anti-patterns that should be closed before adding any of this.

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| P4-1 | Kanban board with custom project statuses | ⬜ Not started | Medium | Keep post-v1 unless early users demand it. |
| P4-2 | PWA installability | ⬜ Not started | Medium | No manifest/service worker yet. |
| P4-3 | Localization groundwork: English + Spanish | ⬜ Not started | Medium | Current UI strings are component-local. |
| P4-4 | Notification center | ⬜ Not started | Medium | Depends on notification event model. |
| P4-5 | Cross-mode search | ⬜ Not started | Medium | Depends on team-mode data model. |
| P4-6 | Natural language task entry in title bar (`every day`, `#project`, `@label`) | ⬜ Not started | Medium | Enhance existing `parseTaskCommand` with chrono-node and full syntax |
| P4-7 | Drag-and-drop reorder for subtasks inline | ⬜ Not started | Low | Subtasks ordered by `createdAt` only |
| P4-8 | "Repeat on due date" vs "repeat on completion" toggle | ⬜ Not started | Low | Currently always materializes on completion |
| P4-9 | Recurring subtasks (subtasks with their own repeat rules) | ⬜ Not started | Low | Subtask repeat field currently disabled |
| P4-10 | Skip / snooze single recurrence occurrence | ⬜ Not started | Low | No way to skip an instance without deleting |
| P4-11 | Multi-level subtask nesting (>1 level deep) | ⬜ Not started | Medium | Hard-coded to 1 level |
| P4-12 | Expand/collapse toggle on parent task card for subtasks | ⬜ Not started | Low | Subtasks always visible below parent |
| P4-13 | Recurring template separated from normal task lists | ⬜ Not started | Low | Template and instances currently mixed |
| P4-14 | Activity log for past completions of recurring tasks | ⬜ Not started | Low | Show history of completed instances |
| P4-15 | Task duplication | ⬜ Not started | Low | Copy a task (title, description, labels, project, priority) as new. Covers unplanned repeat work. |
| P4-16 | Data import (JSON/CSV) | ⬜ Not started | Medium | Accept the same format export already generates. Migration path from Todoist/TickTick/Things. |
| P4-17 | Drag-to-reorder tasks in list views | ⬜ Not started | Medium | `order` column exists in schema but never written. Users need visual priority beyond sort-by-date. |
| P4-18 | Bulk actions (multi-select + action bar) | ⬜ Not started | Medium | Checkbox select on task cards → action bar for Move to Today/Upcoming, Add label, Archive. |
| P4-19 | "Add to Today" from capture bar | ⬜ Not started | Low | Third button or `^today` inline command. Cuts 3-click triage flow to 1 click. |
| P4-20 | Calendar view (monthly/weekly) | ⬜ Not started | Medium | Needs `GET /tasks?from=...&to=...` endpoint. Recurring needs "repeat on due date" first. |
| P4-21 | Undo toast for archive/delete/complete | ⬜ Not started | Low | 5-second toast with undo. Data model already soft-delete; pure UI wrapper. |
| P4-22 | Keyboard shortcuts | ⬜ Not started | Low | `N`=capture bar, `?`=reference, `J`/`K`=navigate, `Enter`=open, `1-4`=switch views. |

### Recommended Sprint Order

| Weeks | Focus | Key deliverable |
|-------|-------|-----------------|
| 1–2 | P0 Personal polish | Archive clarification, confirmation modals, canonical search route, loading states, empty states, 404, validation polish |
| 3–5 | P1 Personal features | Subtasks ✅, recurring tasks ✅, markdown preview ✅, browser notifications ⬜, export ✅ |
| 6–10 | P2a Team Foundation | DB strategy (SQLite self-hosted, Turso/Postgres cloud), workspaces, roles, invite, assignment, "Assigned to me", workspace-scoped labels/projects |
| 11–13 | P2b Team Collaboration | Comments, Team Board with drag-to-reassign, polling-based live sync |
| 14–16 | P3 Deployment & CI hardening | Docker images pushed to GHCR/Docker Hub, Compose with pulled images, coverage gates, Dependabot, security scanning, one-click templates, live demo |

After week 16, Yotara should be ready for both self-hosted and SaaS v1.0. Use P4 for feedback-driven follow-up work.

---

## 1. Entry & Auth Screens (Must Have)

### Login / Sign In
- **Status**: ✅ Already built
- Centered form with email, password, forgot password link, create account CTA

### Register / Sign Up
- **Status**: ✅ Built
- Email, password, confirm password input
- Optional username field
- Auto-login after success → redirect to onboarding or inbox

### Welcome / Onboarding
- **Status**: ✅ Built
- 1–3 step flow or single screen with mode cards
- Two big cards: "Personal & Simple" vs "Light Team Sharing"
- "Continue" button creates default workspace/project
- Shown only once through the user onboarding flag

### Forgot Password (Optional MVP)
- Email input → send reset link
- Can implement later if time permits

---

## 2. Main Protected App Structure

### App Shell / Layout Wrapper
- **Status**: ✅ Built
- Persistent layout for authenticated routes
- Left sidebar (desktop) / bottom nav (mobile)
- Top bar with:
  - Quick add task input
  - Search button
  - Notifications bell
  - User avatar/menu
- Mode toggle switch (Personal ↔ Team) as visual indicator

### Sidebar Navigation
- **Status**: ✅ Built for personal mode; 🟡 placeholder-only for team workspace switching
- Logo + app name
- **Inbox** (default view)
- **Today**
- **Upcoming**
- **Projects** (expandable list)
- **Labels / Tags** (collapsible if many)
- **Settings**
- (Team mode only) **Workspaces Switcher**

---

## 3. Core Task & Productivity Screens

### Inbox / Home (`/` or `/inbox`)
- **Status**: ✅ Built
- Default view after login
- Displays uncategorized/inbox tasks + quick capture focus
- List view with task items
- Empty state when no tasks

### Today (`/today`)
- **Status**: ✅ Built
- Tasks due today + overdue (highlighted)
- Sorted by priority
- Quick daily focus view

### Upcoming (`/upcoming`)
- **Status**: ✅ Built
- Tasks grouped by week / date
- Sections: This Week, Next Week, Later
- Visual timeline sense

### Project / List Detail (`/projects/:id` or `/lists/:slug`)
- **Status**: ✅ Built for personal mode
- Project name header + description
- Project-scoped task list with add-task actions
- Edit from the directory and detail views
- Kanban view remains a later enhancement
- Archive/delete project options remain a separate follow-up slice

### Task Detail / Edit Modal ⭐ (Most Important)
- **Status**: ✅ Built for personal-mode task create/edit
- **Triggered from**: task list click or create action
- **Core fields**:
  - Title (editable)
  - Checkbox + completed state
  - Description textarea with markdown editor, format toolbar, and live preview
  - Due date picker
  - Priority selector (Low | Medium | High)
  - Labels / tags multi-select
  - Project, simple mode, and personal bucket controls
  - Subtasks: checklist creation and completion tracking (✅ done)
  - Recurring controls: daily/weekdays/weekly/monthly/yearly scheduling (✅ done)
- **Team mode additions**:
  - Assignee dropdown
  - Comments section
  - Activity log
- **Actions**: Save | Delete | Close

---

## 4. Personal Mode Work That Sets Up Team Mode

These features should be built as personal-mode improvements first, but they should be designed so the same model can carry into team mode later.

### Personal Mode Product Design / UX Polish
- Personal mode should feel like a calm, focused operating system for one user, not a generic task dashboard
- Quick capture should be the hero interaction, with refinement optional and never blocking capture
- The shell should keep navigation simple and predictable, with Inbox, Today, Upcoming, Projects, Labels, and Archive clearly separated by intent
- The task detail model should use progressive disclosure so simple tasks stay lightweight while advanced metadata remains available
- Empty states should teach the product model and guide the next action instead of feeling like a blank void
- Search should reinforce confidence that anything captured can be found later
- Visual hierarchy should stay calm and spacious, with strong color reserved for state, priority, and primary actions
- Status language should be consistent across done, archived, simple mode, buckets, and priority so the mental model stays stable
- Preferences should feel minimal and useful, especially for theme, density, and quick-add behavior
- Accessibility and keyboard support should be treated as part of the product finish, not only technical compliance

### Task lifecycle and archive flow
- Personal mode should distinguish between `done` and `archived`
- Team mode will need the same distinction so closed work does not clutter active collaboration views
- Archive should become the shared “out of active workflow” state across both modes

### Search and filtering
- Personal search should start with titles, descriptions, projects, and labels
- Team mode will extend the same search surface to assignees, comments, and shared workspace tasks
- Build search as a cross-cutting app capability, not a one-off page

### Labels / tags
- Personal labels establish task organization before team complexity arrives
- Team mode can reuse the same label system for workspace-wide tagging and filtering

### Settings and preferences
- Personal settings should cover default view, theme, and quick-add behavior
- Team mode should inherit the same account settings shell and add workspace preferences later

### Shell hierarchy and navigation
- Make personal mode’s primary actions feel lighter than the surrounding chrome
- Keep secondary controls visually quieter than capture, search, and core navigation
- Make the personal/team switch communicate product intent clearly without looking like a disabled control

### Empty, loading, and error states
- Empty states should be designed for Inbox, Today, Upcoming, Projects, Labels, Search, and Archive with specific guidance for each page
- Loading and error states should stay consistent across task and project surfaces so the app feels coherent under stress
- These states should be written to support future team-mode complexity as well
- These are not just polish
- They become the baseline UX for team collaboration once multiple users, slower loads, and permission errors enter the product

### Confirmation dialogs
- Task delete/archive confirmations in personal mode should set the dialog pattern for workspace actions later
- Team mode will need the same pattern for leave workspace, remove member, and delete project flows

### Project detail groundwork
- Personal project detail should establish the data shape for shared workspaces later
- Team mode can then layer assignments, comments, and board views on top of the same project foundation

### Notifications and reminders
- Personal mode should include browser notifications for due dates, reminders, and key task updates
- The same notification infrastructure should later carry team mentions, assignments, and workspace activity
- Build around service workers and backend push delivery so the feature works when the app is not open

### Language and localization support
- Start with English as the default product language
- Add Spanish next if there is demand from early users
- Add Chinese, Korean, Japanese, Arabic, Hindi, and Russian as the next major language set
- Add German, French, Portuguese, and Italian as easy LTR expansion languages
- Keep the UI text layer separate from components so additional languages can be added later without rewiring the app
- Treat localized date/time/copy formatting as part of settings and not as hardcoded UI text
- Defer right-to-left layout support to a later phase
- Revisit RTL only if Arabic or other RTL language demand becomes real

### Accessibility and interaction polish
- Ensure every interactive shell control has visible focus states and keyboard behavior
- Preserve readable contrast for muted text, chips, and metadata in light and dark themes
- Keep touch targets large enough for mobile use, especially in the top bar and task rows
- Standardize modal, menu, and confirmation behavior so the shell feels consistent across the app

---

## 5. Team Mode–Specific Screens

### Workspaces Overview (`/workspaces`)
- List of workspaces (cards or simple list view)
- Create workspace button/modal

### Workspace Settings / Members
- **Modal or page** (`/workspaces/:id/settings`)
- Workspace name, description, icon/color
- Members list with avatars + role badges
- Invite by email or public link
- (Optional) role/permission management
- Workspace-level notification preferences
- Member language / locale preferences if supported by the workspace model

---

## 6. Utility & Settings Screens

### Settings (`/settings`)
- **Status**: 🟡 Partial
- **Account tab**
  - Password change is ✅ built
  - Logout confirmation is ✅ built
  - Email/profile management remains open
  - Delete account option
- **Appearance tab**
  - Theme selector is ✅ built with current product themes
- **Preferences tab**
  - Default view (Inbox | Today | Upcoming)
  - Date format (US | ISO | etc.)
  - Quick-add behavior
  - Language selector
  - Right-to-left layout support deferred
- **Data & Privacy tab**
  - Export data (JSON / CSV button)
- **About section**
  - Version, license, links

### Labels / Tags Management
- **Status**: ✅ Built for personal mode
- Dedicated page or modal
- Create/edit/delete labels
- Color picker for each label
- Filter labels and view matching tasks

### Global Search Results
- **Status**: ✅ Done
- Triggered from top bar search icon
- Canonical route: `/search?q=...`
- Results grouped by:
  - Project
  - Due date
  - Completion status
  - Tabbed filtering (all / tasks / projects / labels)

### Notifications Center
- **Status**: ⬜ Not started
- In-app notification list or panel
- Read/unread states
- Due reminders, assignments, mentions, and system notices
- Sync with push notifications so the same events appear in-app and on device

### PWA / Installable Mobile Web App
- **Status**: ⬜ Not started
- App manifest
- Service worker registration
- Install prompt and homescreen icon support
- Push notifications for supported browsers
- Badge count support where available

---

## 7. Micro-Screens & States

### Empty States
- **Status**: ✅ Done (shared `EmptyStateComponent` used across all pages: Inbox, Today, Upcoming, Projects, Labels, Search, Project Detail, Archive)
- Inbox empty illustration + message ✅
- Today empty state ✅
- No projects state ✅
- No results (search) ✅
- Archive empty state ✅ (migrated to shared EmptyStateComponent)

### Loading States
- **Status**: ✅ Done — three-layer system
- Global animated top-of-page progress bar (AppStatusComponent)
- Per-service `loading()` signals that disable buttons during async operations
- Descriptive status copy text per view ("Loading your inbox...", etc.)
- No skeleton screens — fast local queries (<200ms) make them unnecessary; the bar + button lock provide polished feedback without skeleton flicker

### Error States
- **Status**: 🟡 Partial
- Network error message with retry
- Unauthorized / session expired
- 404 / Not Found page ✅ (animated parallax forest with return-to-inbox link)
- Generic error fallback ✅ (global toast notifications, persistent error logging)

### Notifications & Alerts
- **Status**: ⬜ Not started beyond a shell icon/disabled settings copy
- In-app notification panel/dropdown
- Mentions, assignments, comments (team mode)
- (Optional) toast notifications for quick feedback
- Browser push notifications for the installable web app
- Notification permission management and subscription refresh flow

### Confirmation Dialogs
- **Status**: ✅ Done
- Delete task confirmation ✅
- Leave workspace confirmation (deferred to team mode)
- Delete project confirmation ✅
- Shared modal and confirm dialog primitives are ✅ built
- Logout, label delete, and task complete/restore confirmations are ✅ wired

---

## 8. Deployment & Distribution

### Pre-Built Docker Images
- **Status**: Not started
- **Effort**: 2 hours
- **Impact**: 200-300 early users (indie devs)
- Build `apauldev/yotara-api` and `apauldev/yotara-frontend` images
- Setup GitHub Actions CI to push on release tags
- Push to Docker Hub for instant zero-build deployment
- Update docs with: `docker run -p 8080:80 apauldev/yotara:latest`

### Docker Compose with Pre-Built Images
- **Status**: Not started
- **Effort**: 1 hour
- **Impact**: Primary deployment method for self-hosters
- Create root `docker-compose.yml` that pulls pre-built images (not building locally)
- Document environment variables clearly (BETTER_AUTH_SECRET, DATABASE_URL, TRUSTED_ORIGINS)
- Include volume setup for SQLite data persistence
- Add health check endpoints to both containers

### One-Click Cloud Deploy Templates
- **Status**: Not started
- **Effort**: 3-4 hours (per platform)
- **Impact**: 300-400 users (low-friction cloud deployers)

#### Render.com Template
- Create `render.yaml` blueprint
- Auto-configure API + frontend services
- Environment variables UI in dashboard
- Auto-rebuild on GitHub push

#### Railway.app Template
- Create `railway.toml` config
- One-click "Deploy to Railway" button on README
- Handles secrets and environment setup

#### Coolify (Optional)
- Add Coolify deployment documentation
- Target: indie devs running their own VPS

### Mobile packaging options
- Keep the mobile web experience excellent first
- Consider a PWA as the default mobile distribution path
- If demand proves out, evaluate a lightweight hybrid wrapper later rather than maintaining a separate native app

---

## Build Order (Fastest Path to MVP)

### Phase 1: Authentication & Shell (Foundation)
1. ✅ Login + Register + auto-redirect
2. ✅ Onboarding mode choice → create default data
3. ✅ App shell + sidebar + top quick-add
4. ✅ Auth guard on all protected routes

### Phase 2: Core Task Management (Usable Product)
5. ✅ Inbox list + task item component
6. ✅ Task create & detail modal
7. ✅ Today + Upcoming views
8. ✅ Project create + project detail

### Phase 3: Polish & Secondary Features
9. ✅ Settings basics + logout (theme, password change, export, logout)
10. ✅ Empty states + error handling (shared `EmptyStateComponent` used across all pages)
11. ✅ Global search (standalone component with tabbed filtering, pagination, date/alpha sort)
12. ✅ Labels / tags management for personal mode
13. 🟡 Team shell placeholders
14. ✅ Confirmation modal primitive + 404 page
15. ✅ Validation/error polish; loading states implemented (global bar + button locking + status copy)
16. ✅ Data export: JSON and CSV from Settings with granular toggles
17. ✅ Insights panel with persistence and settings toggle

### Phase 4: Enhanced UX
- Kanban view for projects
- Subtasks and recurring tasks UI
- ✅ Markdown preview in task detail

### Phase 5: Team Mode Foundation (Post-MVP)
- DB strategy for team mode (SQLite self-hosted, Turso/Postgres cloud)
- Workspace data model with owner/member roles
- Workspace switcher and settings
- Workspace-scoped labels and projects
- Invite link flow
- Task assignment and "Assigned to me" smart list
- Basic activity log for workspace changes

### Phase 5b: Team Collaboration (Post-Foundation)
- Flat comments on tasks
- Team Board with drag-to-reassign
- Polling-based live sync (upgrade to WebSockets later if needed)

### Phase 6: Deployment & Distribution (Growth)
- Pre-built Docker images on Docker Hub
- Docker Compose with pre-built images (no local build)
- Render.com one-click deploy template
- Railway.app one-click deploy template
- Coolify deployment documentation (optional)

### Delivery / Ops
- ✅ API docs exposed at `/docs`
- ✅ Paginated task list endpoint
- ✅ Soft delete support for tasks
- ✅ Dockerfiles, local Compose deployment path, and Docker smoke script
- ✅ Workspace-mode aware routing and guards
- ✅ Shared task state model that supports personal views and leaves room for team fields
- ✅ Reusable modal and confirmation dialog primitives
- ✅ 404 friendly error page with parallax animation
- ✅ Shared `EmptyStateComponent` used across task-list, projects, project-detail, and labels pages
- ✅ Search/filter infrastructure with standalone search component, tabbed filtering, and scoring
- ✅ Automated release script with semver analysis, dry-run support, and idempotency
- ⬜ Release gating: release workflow waits for CI checks to pass before publishing (currently triggers on push regardless of CI status)
- ⬜ Dependency vulnerability scan: add `pnpm audit` to CI lint/test step for early CVE detection
- ⬜ GitHub Release body: trim to latest release notes instead of attaching the full CHANGELOG.md
- ⬜ Coverage reporting with minimum threshold gates
- ⬜ Dependabot automated dependency updates
- ⬜ Security scanning (CodeQL + Snyk)
- ⬜ GitHub Actions CI for Docker image builds and pushes to GHCR/Docker Hub
- ⬜ Pre-built image Compose path and platform-specific environment docs
- ⬜ Selective Docker smoke: only run Docker build + smoke on PRs that touch Dockerfiles, compose, or API/frontend source (currently runs on every push)
- ⬜ Notification delivery pipeline with push subscriptions
- ⬜ Localization-ready text and formatting layers
- ⬜ PWA installability for mobile web users

---

## Current Build Status

### ✅ Complete
- Login / Sign In form
- Register / Sign Up form
- Onboarding mode selector (Personal / Team)
- Personal-mode app shell & navigation
- Auth guard integration
- Task service (CRUD + paginated task loading)
- Task API with pagination and soft delete
- Project create + project detail screens
- Personal labels page and label CRUD
- Personal search service and standalone search component with canonical `/search?q=...` route
- Shared modal and confirmation dialog primitives
- Logout, label delete, and task complete/restore confirmation flows
- Settings foundation: theme selection, change password, logout, export
- Shared page header, section header, date picker, and empty-state directive
- OpenAPI docs and Swagger UI
- Dockerfiles, local build-based Compose deployment, and smoke checks
- Inbox counter pipe
- Subtasks: 1-level deep with parent project inheritance and progress tracking
- Recurring tasks: daily/weekdays/weekly/monthly/yearly with end-date caps
- Markdown editor with format toolbar, preview toggle, and DOMPurify sanitization
- Data export: JSON and CSV from Settings with granular toggles
- Insights panel with daily productivity insights, persistence, and settings toggle
- "Don't show again" on complete task confirmation
- Task list refactored into components with smooth animations and proper pagination
- Archive page migrated to shared EmptyStateComponent
- Automated release script with semver analysis, dry-run support, and idempotency

### 🔄 In Progress
- Team-mode shell placeholders and workspace-mode routing

### 📋 Not Started
- DB strategy for team mode (SQLite self-hosted, Turso/Postgres cloud)
- Workspace data model, roles, and membership (P2a)
- Workspace-scoped labels and projects (P2a)
- Invite link flow (P2a)
- Task assignment and "Assigned to me" (P2a)
- Activity log for workspace changes (P2a)
- Comments on tasks (P2b)
- Team Board with drag-to-reassign (P2b)
- Polling-based live sync (P2b)
- Kanban project view
- Coverage reporting and threshold gates
- Dependabot automated dependency updates
- Security scanning (CodeQL + Snyk)
- Pre-built Docker images on GHCR/Docker Hub (Phase 6)
- Compose file that pulls pre-built images
- One-click cloud deploy templates (Phase 6)
- Localization / language support
- Browser notification preferences and push delivery
- Notification center
- PWA installability and badge counts
- Skip / snooze recurrence occurrences
- Recurring subtasks
- Multi-level subtask nesting
- Task duplication (P4-15)
- Data import (P4-16)
- Drag-to-reorder tasks in list views (P4-17)
- Bulk actions (P4-18)
- "Add to Today" from capture bar (P4-19)
- Calendar view (P4-20)
- Undo toast (P4-21)
- Keyboard shortcuts (P4-22)

---

## Component Structure Recommendations (Angular)

```
apps/frontend/src/app/
├── core/
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   └── onboarding.guard.ts
│   ├── interceptors/
│   │   └── api-prefix.interceptor.ts
│   └── services/
│       ├── auth-state.service.ts
│       └── task.service.ts
├── shared/
│   ├── components/
│   │   ├── page-header/
│   │   └── task-item/
│   ├── directives/
│   ├── pipes/
│   │   └── task-count.pipe.ts
│   └── ui/
│       ├── button/
│       ├── modal/
│       └── ...
├── features/
│   ├── auth/
│   │   ├── login/
│   │   └── register/
│   ├── onboarding/
│   │   └── pages/
│   │       └── start-screen/
│   ├── tasks/
│   │   ├── components/
│   │   │   ├── task-list/
│   │   │   ├── task-detail/
│   │   │   └── task-item/
│   │   └── pages/
│   │       ├── inbox-page/
│   │       ├── today-page/
│   │       ├── upcoming-page/
│   │       ├── project-detail-page/
│   │       └── task-create-page/
│   ├── projects/
│   │   ├── components/
│   │   │   └── project-form/
│   │   └── pages/
│   │       └── projects-page/
│   ├── settings/
│   │   └── pages/
│   │       └── settings-page/
│   └── team/ (post-MVP)
│       ├── components/
│       └── pages/
└── layout/
    └── app-shell/
```

---

## Estimated Effort (2-Week Sprint)

| Screen | Est. Days | Notes |
|--------|-----------|-------|
| App Shell / Sidebar | 1-1.5 | Layout + routing plumbing |
| Inbox / Today / Upcoming | 1.5-2 | Reuse list component, 3x variations |
| Task Create Modal | 1.5-2 | Most complex: forms, date pickers, subtasks |
| Project Detail + Kanban | 1.5-2 | Fallback to list view for MVP |
| Settings + Account | 1-1.5 | Plus theme toggle |
| P2a: DB strategy + Workspaces | 4-5 | DB strategy (SQLite self-hosted, Turso/Postgres cloud), data model, invite, assignment |
| P2b: Board + Comments | 2-3 | Team Board, flat comments, polling |
| Polish & Testing | 1-1.5 | Empty states, error handling |
| **Total** | **~13-17 days** | 2.5–3.5 week sprint with buffer |

---

## Pre-Launch Priorities

### 1. Push filtering to the API (highest impact)

The frontend fetches all tasks and filters in JavaScript with computed signals. The backend already supports `status`, `completed`, and `overdue` query params. Using them per-view eliminates the expand loop, removes most computed signals, and makes the app scale to any number of tasks.

Tracked in: `apps/frontend/TODO.md` (Pre-Launch section), `apps/api/TODO.md` (Pre-Launch section)

### 2. Server-side archive search

Archive search currently fetches 100 recent completed tasks and filters client-side. Build `GET /tasks/search?q=...` so the server finds matches without a data limit.

### 3. Remove stale frontend complexity

After #1 and #2, remove the active-task expand loop, stale alias signals (`archivedTasks`, `completedTasks`), and consolidate the auth-gate boilerplate shared across services.

## Next Steps

- [x] Make `/search?q=...` the canonical global search route — standalone component shipped in v0.51.0
- [x] Migrate archive page to use shared `EmptyStateComponent`
- [x] Fix 100-task hard limit with server-driven pagination (H4) — archive page done; full fix requires pushing filtering to API
- [x] Fix archive page clamp — when deleting the last task on a page, currentPage now clamps to the last valid page and pagination stays visible
- [ ] Push filtering to the API — see #1 above
- [ ] Build server-side archive search — see #2 above
- [ ] Fix error handling mismatch between services and routes (H3 / API P0)

---

## Questions & Decisions Needed

- **Recurring tasks**: Support simplified version (daily/weekly/monthly) or full cron?
- **Subtasks**: Full nesting support or just one level?
- **Kanban**: Include in MVP or as Phase 4?
- **Team mode**: Hide completely or show greyed-out tab in MVP?
- **Real-time**: Polling (10–30s) for team MVP; upgrade to WebSockets if demand warrants — ✅ decided for P2b.
- **Archive**: Manual archive only, or auto-archive after completion?
- **Search**: Single global search or separate personal/team search scopes?
- **Permissions**: Owner vs member roles in MVP — ✅ decided for P2a.
- **Database**: SQLite for self-hosted (one DB per company, works at 30-person scale with WAL mode). Turso or Postgres for cloud SaaS multi-tenancy — ✅ decided.
- **Workspace-scoped labels/projects**: Yes, workspace-scoped in team mode, user-scoped in personal mode — ✅ decided for P2a.
- **Languages**: English first, then Spanish, then other locales as demand proves out?
- **Languages**: English first, then Spanish, Hindi, Chinese, Japanese, Korean, Russian, plus easy LTR European additions like German, French, Portuguese, and Italian?

---

For detailed technical setup, see [PROJECT_README.md](./PROJECT_README.md).
For testing patterns, see [testing.md](./testing.md).
patterns, see [testing.md](./testing.md).
