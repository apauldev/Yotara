# Yotara Project Plan

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
- ✅ Search foundation: task/project/label search service and search UI available through `/tasks?view=search&q=...`
- ✅ API/docs/devops foundation: OpenAPI docs, Swagger UI, Dockerfiles, local build-based Compose, Docker smoke script, and core API tests

## P0 - Personal Mode Polish

Target: 1-2 weeks. This is the public-demo gate.

| # | Task | Status | Effort | Next action |
|---|------|--------|--------|-------------|
| 1 | Archive lifecycle: explicit archive action, restore, permanent delete | 🟡 Partial | Low | Archive page and restore flow already work at the MVP level. The remaining gap is a true archived lifecycle state, explicit archive action, and permanent delete. |
| 2 | Confirmation dialogs for all destructive actions | 🟡 Partial | Low | Wire existing `ConfirmDialog` into task delete, project delete, archive, restore, and permanent delete flows. |
| 3 | Canonical global search: `/search?q=...` with label matches | 🟡 Partial | Medium | Make `/search?q=...` the main route and add task-label-name matching to task result ranking/context. |
| 4 | 404 page: wildcard route, friendly error, link to Inbox | ⬜ Not started | Low | Add a catch-all route and not-found page that works from personal and team shells. |
| 5 | Task loading skeletons | ⬜ Not started | Low | Replace spinner/copy-only loading states with skeleton rows for task lists and task panels. |
| 6 | Empty states for all main views | 🟡 Partial | Low | Extract `EmptyState` component and apply consistent icon/illustration states across Inbox, Today, Upcoming, Projects, Labels, Search, and Archive. |
| 7 | Form validation and error handling polish | 🟡 Partial | Low | Standardize API error mapping, retry actions, disabled/loading states, and user-facing error copy. |

P0 exit criteria:

- Archive behavior is understood and usable, with cleanup work limited to lifecycle clarity.
- Every destructive action has a confirmation dialog.
- Search works at the canonical `/search?q=...` route.
- Unknown routes land on a useful 404 page.
- Main task lists feel stable while loading.
- Empty/error states feel intentional enough for a public demo.

After P0, the product is ready for a public demo link in the README.

## P1 - High-Value Personal Features

Target: 2-3 weeks after P0.

| # | Task | Status | Effort | Next action |
|---|------|--------|--------|-------------|
| 8 | Subtasks, one level | ⬜ Not started | Medium | Add `parentTaskId` persistence and a checklist UI inside the task modal. |
| 9 | Recurring tasks: daily, weekly, monthly | ⬜ Not started | Medium | Add recurrence fields/rule storage, then materialize the next task occurrence through a simple load-time or save-time rule. |
| 10 | Markdown preview in task description | ⬜ Not started | Low | Add a sanitized preview toggle beside the existing description textarea. |
| 11 | Browser notifications for due reminders | ⬜ Not started | Medium | Add permission management and a simple page-load or interval scheduler for due reminders. |
| 12 | Export data: JSON and CSV | ⬜ Not started | Low | Start with client-side export from Settings using already-loaded tasks, projects, and labels. |

P1 exit criteria:

- Personal mode supports common power-user workflows without becoming team-mode-heavy.
- Users can trust their data because export is available.
- Task details support notes, repeated work, and simple checklists.

After P1, personal mode should feel complete and competitive with other lightweight task managers.

## P2 - Team Mode MVP

Target: 6-8 weeks. This is the critical path for SaaS and non-profit use.

| # | Task | Status | Effort | Next action |
|---|------|--------|--------|-------------|
| 13 | Workspace data model: workspaces, memberships, owner flag | ⬜ Not started | Medium | Add `workspaces` and `workspace_members` tables, then update API ownership checks. |
| 14 | Workspace switcher | ⬜ Not started | Low | Build sidebar dropdown to create/switch workspaces and store active workspace in app state. |
| 15 | Invite link flow | ⬜ Not started | Medium | Add invite token table, admin link generation, and `/join/:token` signup/join page. |
| 16 | Task assignment | ⬜ Not started | Low | Persist `assigneeId` on tasks and render initials/avatar in task rows. |
| 17 | Assigned to me smart list | ⬜ Not started | Low | Add a route/sidebar item that filters tasks by `assigneeId = currentUserId`. |
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
| 24 | Render.com template | ⬜ Not started | Medium | Add `render.yaml` blueprint for one-click deploy. |
| 25 | Railway.app template | ⬜ Not started | Medium | Add `railway.toml` or Railway deploy config and README deploy button. |
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
| 1-2 | P0 | Archive lifecycle, confirmations, canonical search route, 404, skeletons, empty states, validation polish |
| 3-5 | P1 | Subtasks, recurring tasks, markdown preview, browser notifications, export |
| 6-13 | P2 | Workspaces, assignment, comments, Team Board, real-time updates in the final two weeks |
| 14-16 | P3 | Pre-built Docker images, Compose with pulled images, one-click templates, live demo |

After week 16, Yotara should be ready for v1.0 across self-hosted and SaaS paths. P4 should be driven by user feedback rather than pre-launch guessing.

## Immediate Next Task

Start with P0 #3 and P0 #4 next: canonical search and 404. Archive is already working well enough for the current MVP.

Implementation slice:

1. Make `/search?q=...` the canonical route for search.
2. Add a friendly 404 page with a link back to Inbox.
3. Add task list skeleton loaders.
4. Extract shared empty-state and async-state helpers.
5. Standardize destructive confirmations across task, label, project, and future workspace flows.
6. Polish form validation, error messages, retry actions, and loading labels.

Acceptance criteria:

- Active task views exclude archived tasks.
- Archive page and restore behavior remain stable.
- The remaining archive work is limited to lifecycle cleanup and permanent delete.
