# Yotara MVP Roadmap

This document outlines the complete list of screens, pages, and modals needed for the Yotara MVP. Items are grouped by priority and logical build order—with the first 8–10 screens forming the foundation for a usable personal task manager.

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
- ✅ Search foundation: task/project/label search service and canonical `/search?q=...` route
- ✅ Global status system: professional loading indicator, error toast notifications, and persistent logging to localStorage (#106)
- ✅ 404 page: friendly error page with animation and navigation (#103)
- ✅ API/docs/devops foundation: OpenAPI docs, Swagger UI, Dockerfiles, local build-based Compose, Docker smoke script, and core API tests

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
| 10 | Markdown preview in task description | ⬜ Not started | Low | Task modal has a textarea only. Add preview toggle and sanitization. |
| 11 | Browser notifications for due reminders | ⬜ Not started | Medium | Settings has disabled notification rows; no permission/scheduler/service worker flow yet. |
| 12 | Export data: JSON and CSV from Settings | ⬜ Not started | Low | Settings has disabled export row. Implement client export first, API export later if needed. |
| 13 | Natural Language Task Entry: date parsing, projects (#), and labels (@) | ⬜ Not started | Medium | Enhance existing regex parser with `chrono-node` for dates and align syntax with Todoist standards (#project, @label). |

**P1 target:** 2–3 weeks after P0.

### P2 – Team Mode MVP (Core for SaaS / Non-Profits)

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 12 | Database migration plan: move from SQLite to Postgres before team data model | ⬜ Not started | Medium | Team mode is expected to become multi-user and SaaS-like; lock the tenancy/database path before workspace tables land. |
| 13 | Workspace data model: workspaces and memberships | ⬜ Not started | Medium | Current backend only stores `user.workspaceMode`; no workspace tables yet. |
| 14 | Workspace switcher: create/switch workspaces | ⬜ Not started | Low | Team shell has placeholder workspace navigation/label only; no real switcher or persistence. |
| 15 | Invite link flow: token + `/join/:token` | ⬜ Not started | Medium | No invite tables/routes/pages. |
| 16 | Task assignment: `assigneeId` and avatar in lists | ⬜ Not started | Low | Shared/OpenAPI mention `assigneeId`, but DB schema and task UI do not persist/render it. |
| 17 | “Assigned to me” smart list | ⬜ Not started | Low | Depends on assignment. |
| 18 | Comments on tasks | ⬜ Not started | Medium | Shared `Comment` type exists; no DB/API/UI. |
| 19 | Team Board: columns per member, drag to reassign | ⬜ Not started | Medium | Depends on workspaces, membership, and assignment. |
| 20 | Workspace settings: members list + remove member | ⬜ Not started | Low | Depends on workspace membership. |
| 21 | Real-time updates: WebSockets for task changes | ⬜ Not started | High | No WebSocket layer yet. |

**P2 target:** 6–8 weeks. Critical path for SaaS launch.

**Database note:** If team mode is expected to become multi-user, concurrent, and SaaS-like, the relational model should move to Postgres before or alongside P2. Treat SQLite as a personal/self-hosted foundation, not the final team-mode backend.

### P3 – Deployment & Distribution

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 22 | Pre-built Docker images pushed to GHCR or Docker Hub on release | ⬜ Not started | Medium | Dockerfiles exist; add GitHub Actions workflow to build and push multi-platform images on tag. |
| 23 | Coverage reporting with threshold gates | ⬜ Not started | Low | Integrate c8/istanbul coverage collection; upload to Codecov; enforce minimum coverage in CI. |
| 24 | Dependabot / Renovate for automated dependency updates | ⬜ Not started | Low | Enable Dependabot on GitHub; group minor/patch updates; review monthly. |
| 25 | Security scanning (CodeQL + Snyk) | ⬜ Not started | Low | Add CodeQL analysis workflow; enable Dependabot security alerts; review weekly. |
| 26 | Docker Compose with pre-built images | 🟡 Partial | Low | Local build-based Compose is ✅ done, but pre-built image Compose is not. |
| 27 | Render.com template (`render.yaml`) | ⬜ Not started | Medium | Not present. |
| 28 | Railway.app template (`railway.toml`) | ⬜ Not started | Medium | Not present. |
| 29 | Live demo instance and README link | ⬜ Not started | Medium | Not present. |

**P3 target:** 2–3 weeks. Can run in parallel with P2 once image publishing is stable.

### P4 – Polish & Nice-to-Haves (Post-v1)

| # | Task | Status | Effort | Notes |
|---|------|--------|--------|-------|
| 30 | Kanban board with custom project statuses | ⬜ Not started | Medium | Keep post-v1 unless early users demand it. |
| 31 | PWA installability | ⬜ Not started | Medium | No manifest/service worker yet. |
| 32 | Localization groundwork: English + Spanish | ⬜ Not started | Medium | Current UI strings are component-local. |
| 33 | Notification center | ⬜ Not started | Medium | Depends on notification event model. |
| 34 | Activity log | ⬜ Not started | Low | Can share event model with comments/notifications. |
| 35 | Cross-mode search | ⬜ Not started | Medium | Depends on team-mode data model. |
| 36 | Natural language task entry in title bar (Todoist-style `every day`, `#project`, `@label`) | ⬜ Not started | Medium | Enhance existing `parseTaskCommand` with chrono-node and full syntax |
| 37 | Drag-and-drop reorder for subtasks inline | ⬜ Not started | Low | Subtasks ordered by `createdAt` only |
| 38 | "Repeat on due date" vs "repeat on completion" toggle | ⬜ Not started | Low | Currently always materializes on completion |
| 39 | Recurring subtasks (subtasks with their own repeat rules) | ⬜ Not started | Low | Subtask repeat field currently disabled |
| 40 | Skip / snooze single recurrence occurrence | ⬜ Not started | Low | No way to skip an instance without deleting |
| 41 | Multi-level subtask nesting (>1 level deep) | ⬜ Not started | Medium | Hard-coded to 1 level |
| 42 | Expand/collapse toggle on parent task card for subtasks | ⬜ Not started | Low | Subtasks always visible below parent |
| 43 | Recurring template separated from normal task lists | ⬜ Not started | Low | Template and instances currently mixed |
| 44 | Activity log for past completions of recurring tasks | ⬜ Not started | Low | Show history of completed instances |

### Recommended Sprint Order

| Weeks | Focus | Key deliverable |
|-------|-------|-----------------|
| 1–2 | P0 Personal polish | Archive clarification, confirmation modals, canonical search route, loading states, empty states, 404, validation polish |
| 3–5 | P1 Personal features | Subtasks, recurring tasks, markdown preview, browser notifications, export |
| 6–13 | P2 Team Mode | Workspaces, assignment, comments, Team Board, real-time updates in the final stretch |
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
  - Description textarea (markdown preview is P1)
  - Due date picker
  - Priority selector (Low | Medium | High)
  - Labels / tags multi-select
  - Project, simple mode, and personal bucket controls
  - Subtasks and recurring controls remain P1
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
9. 🟡 Settings basics + logout
10. ✅ Empty states + error handling (shared `EmptyStateComponent` used across all pages)
11. 🟡 Global search (service done, canonical `/search` route pending)
12. ✅ Labels / tags management for personal mode
13. 🟡 Team shell placeholders
14. ✅ Confirmation modal primitive + 404 page
15. ✅ Validation/error polish; loading states implemented (global bar + button locking + status copy)
16. ⬜ Language selection / localization groundwork
17. ⬜ Notification center + browser push support

### Phase 4: Enhanced UX
- Kanban view for projects
- Subtasks and recurring tasks UI
- Markdown preview in task detail

### Phase 5: Team Mode (Post-MVP)
- Postgres-backed workspace and membership model
- Workspaces + member management
- Task assignment
- Comments & activity log
- Real-time collaboration
- Shared notification preferences

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
- 🟡 Search/filter infrastructure that can grow into team scope
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
- Personal search service and canonical `/search?q=...` route
- Shared modal and confirmation dialog primitives
- Logout, label delete, and task complete/restore confirmation flows
- Settings foundation: theme selection, change password, logout
- Shared page header, section header, date picker, and empty-state directive
- OpenAPI docs and Swagger UI
- Dockerfiles, local build-based Compose deployment, and smoke checks
- Inbox counter pipe

### 🔄 In Progress
- Team-mode shell placeholders and workspace-mode routing
- Settings shell beyond theme/password/logout
- Canonical global search routing (`/search?q=...`)
- Archive page migration to shared `EmptyStateComponent`

### 📋 Not Started
- Kanban project view
- Subtasks and recurring tasks UI
- Team workspace membership and assignment features
- Coverage reporting and threshold gates
- Dependabot automated dependency updates
- Security scanning (CodeQL + Snyk)
- Pre-built Docker images on GHCR/Docker Hub (Phase 6)
- Compose file that pulls pre-built images
- One-click cloud deploy templates (Phase 6)
- Workspace-level notifications and comments/activity log
- Preference settings beyond theme
- Export / data and privacy controls
- Cross-mode search and filter enhancements
- Localization / language support
- Notification preferences and push delivery
- PWA installability and badge counts

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
| Team Mode Shell | 1.5-2 | Workspaces switcher, member list |
| Polish & Testing | 1-1.5 | Empty states, error handling |
| **Total** | **~9-11 days** | 2-week sprint with buffer |

---

## Next Steps

- [ ] Make `/search?q=...` the canonical global search route (route exists but redirects to `/tasks`)
- [x] Migrate archive page to use shared `EmptyStateComponent`

---

## Questions & Decisions Needed

- **Recurring tasks**: Support simplified version (daily/weekly/monthly) or full cron?
- **Subtasks**: Full nesting support or just one level?
- **Kanban**: Include in MVP or as Phase 4?
- **Team mode**: Hide completely or show greyed-out tab in MVP?
- **Notifications**: Real-time via WebSocket or polling?
- **Archive**: Manual archive only, or auto-archive after completion?
- **Search**: Single global search or separate personal/team search scopes?
- **Permissions**: What is the minimum viable team role model?
- **Database**: Should Postgres migration happen before P2 team mode, or be treated as a hard precondition for it?
- **Languages**: English first, then Spanish, then other locales as demand proves out?
- **Languages**: English first, then Spanish, Hindi, Chinese, Japanese, Korean, Russian, plus easy LTR European additions like German, French, Portuguese, and Italian?

---

For detailed technical setup, see [PROJECT_README.md](./PROJECT_README.md).
For testing patterns, see [testing.md](./testing.md).
patterns, see [testing.md](./testing.md).
