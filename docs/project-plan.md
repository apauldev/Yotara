# Yotara Project Plan

> **⚠️ OUT OF USE — Historical snapshot only.**
>
> Planning is now tracked on the **[Yotara Roadmap](https://github.com/users/apauldev/projects/1)** GitHub Project board.
>
> Architectural decisions live in [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md). New work goes to GitHub Issues, not this file.
>
> Last meaningful update: 2026-06-01. **Known drift:** the P1 table shows Markdown preview (#10) and Data export (#12) as ⬜ Not started, but both shipped in 0.51.0 and 0.52.0.

This plan translates the implementation-aware roadmap into a project manager's action plan. It assumes a current pace of 1-2 hours per day and treats the personal-mode MVP as functionally complete, with remaining work focused on public-demo polish, high-value personal features, team mode, and distribution.

Status legend: ✅ Done, 🟡 Partial, ⬜ Not started.

## Current Baseline

Yotara already has the core personal task-manager foundation in place:

- ✅ Auth: login, sign up, session refresh, logout, onboarding mode selection, and change password
- ✅ Personal shell: sidebar/bottom navigation, top search form, quick-add entry point, user menu, and notifications icon placeholder
- ✅ Personal task views: Inbox, Today, Upcoming, project detail, and archive page shell
- ✅ Archive page behavior: archive list and restore toggle already work at the current MVP level
- ✅ Task CRUD foundation: paginated API loading, create/update/delete API, soft delete, labels on tasks, project assignment, priority, due date, simple mode, and personal buckets
- ✅ Personal project CRUD foundation: create, list, update, detail view, and project-scoped tasks
- ✅ Personal label CRUD: labels page, create/edit/delete modal, color selection, label counts, and task label filtering
- ✅ Shared UI primitives: accessible modal, reusable confirm dialog, logout confirm modal, page header, section header, button utility, date picker, and empty-state directive
- ✅ Settings foundation: theme selection, change password, and logout confirmation
- ✅ Search foundation: task/project/label search service and canonical \`/search?q=...\` route
- ✅ API/docs/devops foundation: OpenAPI docs, Swagger UI, Dockerfiles, local build-based Compose, Docker smoke script, and core API tests

## P0 - Personal Mode Polish

Target: 1-2 weeks. This is the public-demo gate.

| # | Task | Status | Effort | Next action |
|---|------|--------|--------|-------------|
| 1 | Archive lifecycle: explicit archive action, restore, permanent delete | ✅ Done | Low | Archive lifecycle properly implemented with \`archived_at\` timestamps, restore flow, and UI in place. |
| 2 | Confirmation dialogs for all destructive actions | ✅ Done | Low | Shared \`ConfirmDialog\` components used for task operations, archive actions, and label deletion. |
| 3 | Canonical global search: \`/search?q=...\` with label matches | ✅ Done | Medium | Canonical \`/search?q=...\` route is live with tabbed filtering and full-text matching. |
| 4 | 404 page: wildcard route, friendly error, link to Inbox | ✅ Done | Low | Friendly 404 page with parallax animation implemented. |
| 5 | Task loading states | ✅ Done | Low | Three-layer loading system: global animated top-of-page bar, per-service `loading()` signals that disable buttons during fetch, and descriptive status copy text. Fast local queries render data in 100–200ms, making skeleton placeholders unnecessary for this app's architecture. |
| 6 | Empty states for all main views | ✅ Done | Low | \`EmptyStateComponent\` used across every main view: Inbox/Today/Upcoming with contextual icons, projects-page, project-detail-page, labels-page, search-page, and archive-page (\`faBoxArchive\`). All empty states are consistent and intentional. |
| 7 | Form validation and error handling polish | ✅ Done | Low | Global error handling system with toast notifications and persistent logging implemented. |

P0 exit criteria:

- ✅ Archive behavior is understood and usable.
- ✅ Every destructive action (task/label delete) has a confirmation dialog.
- ✅ Search works at the canonical \`/search?q=...\` route.
- ✅ Unknown routes land on a useful 404 page.
- ✅ Main task lists feel stable while loading (global bar + button locking + status copy).
- ✅ Empty/error states feel intentional (Archive page now uses shared EmptyStateComponent — all views consistent).

After P0, the product is ready for a public demo link in the README.

## P1 - High-Value Personal Features

Target: 2-3 weeks after P0.

| # | Task | Status | Effort | Next action |
|---|------|--------|--------|-------------|
| 8 | Subtasks, one level | ✅ Done | Medium | Hierarchical task management with checklist UI and progress tracking implemented. |
| 9 | Recurring tasks: daily, weekly, monthly | ✅ Done | Medium | Automated materialization logic for recurring frequencies (daily to yearly) implemented. |
| 10 | Markdown preview in task description | ✅ Done (0.51.0) | Low | Markdown editor with format toolbar, preview toggle, and DOMPurify sanitization. |
| 11 | Browser notifications for due reminders | ⬜ Not started | Medium | Add permission management and a simple page-load or interval scheduler for due reminders. |
| 12 | Export data: JSON and CSV | ✅ Done (0.52.0/0.53.0) | Low | JSON/CSV export from Settings with granular toggles for subtasks, descriptions, and archived items. |
| 13 | Natural Language Task Entry: date parsing, projects (#), and labels (@) | ⬜ Not started | Medium | Enhance existing regex parser with \`chrono-node\` for dates. |


P1 exit criteria:

- Personal mode supports common power-user workflows without becoming team-mode-heavy.
- Users can trust their data because export is available.
- Task details support notes, repeated work, and simple checklists.

After P1, personal mode should feel complete and competitive with other lightweight task managers.

## P2 - Team Mode MVP

Target: 6-8 weeks. This is the critical path for SaaS and non-profit use.

| # | Task | Status | Effort | Next action |
|---|------|--------|--------|-------------|
| 13 | Workspace data model: workspaces, memberships, owner flag | ⬜ Not started | Medium | Add \`workspaces\` and \`workspace_members\` tables, then update API ownership checks. |
| 14 | Workspace switcher | ⬜ Not started | Low | Build sidebar dropdown to create/switch workspaces and store active workspace in app state. |
| 15 | Invite link flow | ⬜ Not started | Medium | Add invite token table, admin link generation, and \`/join/:token\` signup/join page. |
| 16 | Task assignment | ⬜ Not started | Low | Persist \`assigneeId\` on tasks and render initials/avatar in task rows. |
| 17 | Assigned to me smart list | ⬜ Not started | Low | Add a route/sidebar item that filters tasks by \`assigneeId = currentUserId\`. |
| 18 | Comments on tasks | ⬜ Not started | Medium | Add comments table/API and plain text comment section in the task modal. |
| 19 | Team Board | ⬜ Not started | Medium | Add people-centric board route with columns per member and drag-to-reassign behavior. |
| 20 | Workspace settings | ⬜ Not started | Low | Add members list and owner-only remove-member action. |
| 21 | Real-time updates | ⬜ Not started | High | Add WebSocket layer and broadcast task assignment, comment, and status changes within a workspace. |

P2 exit criteria:

- Workspaces and membership are real backend concepts.
- A team can invite members, assign tasks, comment, and manage members.
- The board gives teams a simple shared operating view.
- Updates feel current enough for collaborative use.

After P2, Yotara can be positioned as a SaaS for small teams and non-profits.

## P3 - Deployment And Distribution

Target: 2-3 weeks. This can run in parallel with late P2 once image builds are stable.

| # | Task | Status | Effort | Next action |
|---|------|--------|--------|-------------|
| 22 | Pre-built Docker images on tag | ⬜ Not started | Medium | Add GitHub Actions workflow to build and push API/frontend images to Docker Hub on release tags. |
| 23 | Docker Compose with pre-built images | 🟡 Partial | Low | Keep the current local-build Compose file and add a second Compose file that pulls versioned images. |
| 24 | Render.com template | ⬜ Not started | Medium | Add \`render.yaml\` blueprint for one-click deploy. |
| 25 | Railway.app template | ⬜ Not started | Medium | Add \`railway.toml\` or Railway deploy config and README deploy button. |
| 26 | Live demo instance | ⬜ Not started | Medium | Deploy an always-on demo instance and link it from the README. |

P3 exit criteria:

- A self-hoster can start Yotara without building images locally.
- A non-technical evaluator can try Yotara from a live demo link.
- Cloud deployment paths are documented and repeatable.

After P3, anyone can try Yotara instantly or deploy their own instance with low friction.

## P4 - Post-v1 Polish

Do this after real user feedback:

- ⬜ Kanban board with custom statuses
- ⬜ PWA installability with manifest and service worker
- ⬜ Localization groundwork, starting with English and Spanish
- ⬜ Notification center for in-app reminders and team events
- ⬜ Activity log for task history
- ⬜ Cross-mode search across personal and workspace tasks

## Sprint Plan

| Weeks | Focus | Deliverable |
|-------|-------|-------------|
| 1-2 | P0 | Archive lifecycle, confirmations, canonical search route, 404, loading states, empty states, validation polish |
| 3-5 | P1 | Subtasks, recurring tasks, markdown preview, browser notifications, export |
| 6-13 | P2 | Workspaces, assignment, comments, Team Board, real-time updates in the final two weeks |
| 14-16 | P3 | Pre-built Docker images, Compose with pulled images, one-click templates, live demo |

After week 16, Yotara should be ready for v1.0 across self-hosted and SaaS paths. P4 should be driven by user feedback rather than pre-launch guessing.

## Immediate Next Task

> Stale: this section suggested "Start with P1 #10 (markdown preview)" but that work shipped in 0.51.0. The current next actions are in `docs/ARCHITECTURE.md` → "Recommended roadmap" → Sprint 0.

Historical next task (for context only):

1. ~~Add Markdown preview toggle to task description in the detail modal (P1 #10).~~ Shipped 0.51.0.
2. Standardize destructive confirmations for project delete flows (once implemented).
