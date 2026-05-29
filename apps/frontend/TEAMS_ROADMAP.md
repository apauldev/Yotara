# Teams Roadmap — Solo to 30

Yotara's team mode is designed so you can start working alone and add people
without switching tools. Each phase unlocks the next stage of company growth.

Status legend: ✅ Done, 🟡 Partial, ⬜ Not started.

---

## Principles

1. **One tool, no migrations.** You should never outgrow Yotara. Each phase adds
   capabilities, not friction.
2. **Capture speed first.** Best-in-class quick-add is the hook. Team features
   layer on top, they don't replace it.
3. **Simple, not enterprise-complex.** Projects, assignments, a board, and a
   message board. No sprints, no story points, no custom workflows.
4. **Board is a view, not an identity.** The task is the atomic unit. The board
   is one way to see it.
5. **Self-hosted as a feature.** A single binary that runs a whole 30-person
   company on a $5 VPS. No Postgres, no Redis, no queue workers.

---

## Phase 0 — Solo Founder (Current)

The personal mode is the foundation. Everything else builds on it.

- [x] Quick-add capture from every screen
- [x] Inbox / Today / Upcoming views
- [x] Projects with task lists
- [x] Labels, priorities, due dates
- [x] Subtasks (1-level) with progress tracking
- [x] Recurring tasks (daily/weekly/monthly/yearly)
- [x] Markdown editor with format toolbar and preview
- [x] Archive lifecycle (done → archived → restore)
- [x] Full-text search
- [x] Bottom-sheet modal on mobile
- [x] Docker compose (local build)

**Gate for Phase 1:** Personal mode feels polished. Capture is sub-second.
Mobile feels native.

---

## Phase 1 — First Hire (The Team Jump)

This is the most important phase. Without it, Yotara loses the user at their
first hire to established alternatives.

### Team Activation

- [ ] Workspace creation (name, optional description)
- [ ] Personal-to-team upgrade flow (convert existing data or start fresh)
- [ ] Invite by email or shareable link
- [ ] Join flow with basic acceptance
- [ ] Workspace switcher in the shell

**Why this order:** The user needs to feel the team is a separate space, not
that their personal inbox got cluttered with work tasks.

### Task Assignment

- [ ] `assigneeId` on tasks (single assignee for v1)
- [ ] Assignee avatar + name in task card and modal
- [ ] Filter by "assigned to me" in workspace views
- [ ] Assignee picker in the task modal (show workspace members)

**Why this order:** Assignment is the first team action. Before the board,
before the message board — the simplest team coordination is "who's doing
this?"

### Board View

- [ ] Project-level board view (columns = task statuses)
- [ ] Drag-and-drop between columns
- [ ] Quick-add task directly on the board
- [ ] Board as an optional view toggle on the project page (list / board)

**Constraints to keep it simple:**
- Columns are fixed to task status (`inbox`, `today`, `upcoming`, `done`) for
  v1 — no custom column creation. This prevents scope-creeping into complex
  workflow hell.
- Drag reassigns status only. Not priority, not assignee. Keep drag simple.

### Message Board

- [ ] Posts table with `projectId`, author, markdown body
- [ ] Comments table with `postId`, author, markdown body
- [ ] Post list view per project (reverse chronological)
- [ ] Post detail with threaded comments
- [ ] Inline markdown editor for posts (reuse existing component)
- [ ] Activity feed on project home showing recent posts + task changes

**Why this order:** The message board gives the project a "home" beyond the
task list. It's where context lives — "why are we doing this?", "update on
the client call", "specs for the landing page." Without it, the project feels
like a filtered task list.

**Simplifications vs similar tools:**
- No email-in replies (in-app only)
- No file uploads (markdown image links only)
- No rich text (markdown only)
- Flat thread model (comments on a post, not nested replies)

### Activity Feed

- [ ] Per-project activity feed (task created, completed, assigned, comment
      added)
- [ ] Workspace-wide feed on the team home page
- [ ] Feed entries link back to the task or post

### Phase 1 Gate

- Workspace with 2+ members can:
  - Create and view a project
  - Assign tasks to each other
  - See tasks on a board
  - Write a message board post and reply to it
  - See what happened recently in the activity feed

All of this must feel **at least as fast** as the personal mode. Team features
that are slow or buggy will drive users to alternatives on day one.

---

## Phase 2 — Small Team (5–10 People)

### Team Admin

- [ ] Member list with join date and last active
- [ ] Remove member from workspace
- [ ] Leave workspace flow
- [ ] Workspace-level labels (shared across projects)

### Recurring Team Cycles

- [ ] Project-level iteration/cycle toggles (weekly, biweekly, monthly)
- [ ] Cycle view: tasks scoped to the current cycle
- [ ] Cycle rollover (unfinished tasks carry to next cycle automatically)

This is intentionally not "sprints" — no velocity tracking, no story points,
no retro ceremonies. Just a timebox for focus.

### Cross-Project Search

- [ ] Workspace-scoped search across all projects
- [ ] Filter by project, assignee, label, status
- [ ] Saved searches for common queries

### Notifications (In-App)

- [ ] Notification on assignment
- [ ] Notification on comment or reply
- [ ] Notification when task status changes (opt-in per task)
- [ ] Notification center bell icon in the shell
- [ ] Read/unread state
- [ ] "Mark all read"

### Phase 2 Gate

A 10-person team can work across multiple projects without losing track of
what's happening. New members get up to speed from the activity feed and
notification history.

---

## Phase 3 — Growing Team (10–30 People)

### Simple Permissions

- [ ] Two roles: **Admin** (can manage members, delete projects) and **Member**
      (can create and work in projects)
- [ ] Project-level privacy: public (all workspace members) or private
      (selected members only)
- [ ] Transfer project ownership

### Project Templates

- [ ] Save a project as a template (structure + task list, no assignees or
      due dates)
- [ ] Create project from template
- [ ] Template library per workspace
- [ ] Onboarding template for new workspaces (suggested default templates)

### Workload View

- [ ] Simple workload board: tasks grouped by assignee, sorted by due date
- [ ] Shows current cycle or date range
- [ ] Visual indicator for over-assignment (> N tasks due)

This is NOT a Gantt chart or resource management tool. It's a "who has too
much on their plate?" view that takes 2 seconds to scan.

### API + Integrations Foundation

- [ ] Personal API tokens (generate/revoke in settings)
- [ ] REST API for tasks, projects, and posts (mostly already exists from
      personal mode)
- [ ] Webhook support (fire on task created, completed, assigned)
- [ ] Documented API with examples (OpenAPI spec already exists)

### Data Export

- [ ] Workspace export (all projects, tasks, posts as JSON)
- [ ] Per-project export
- [ ] Import from CSV
- [ ] Import from JSON

### Phase 3 Gate

A 30-person company can run on Yotara exclusively. No missing feature is a
hard blocker for daily work. New hires are productive on day one.

---

## Phase 4 — Deployment & Distribution

### Self-Hosted Polish

- [ ] Pre-built Docker images pushed to Docker Hub and GHCR on release
- [ ] Docker Compose with pre-built images (no local build required)
- [ ] One-click deploy to Railway
- [ ] One-click deploy to Render
- [ ] Environment variable documentation for all configurable options

### Admin Dashboard

- [ ] Workspace-level usage stats (active users, task volume)
- [ ] Invite link management (revoke, regenerate)
- [ ] Instance health page (DB status, storage used, uptime)

### Phase 4 Gate

A non-technical founder can deploy Yotara for their team in under 5 minutes
without touching a terminal.

---

## What We Are NOT Building

These are deliberately excluded to stay focused:

| Feature | Why not |
|---|---|
| Custom status workflows | Dead end to workflow complexity. Tasks have statuses. That's it. |
| Story points / velocity | Requires estimation culture. Most small teams don't have one. |
| Time tracking | A product category on its own. Integrate a time tracker instead. |
| Gantt / timeline | Attracts the wrong comparisons and complexity. |
| Real-time chat | Slack already won. Activity feed + notifications is enough. |
| Kanban-only mode | The app is task-first. Board is a view, not an identity. |
| Resource management | Overkill for 30 people. Workload view covers the need. |
| SAML / SSO / SCIM | Enterprise features for 500+. Not relevant at this stage. |
| Native mobile apps | PWA + responsive web covers 95% of need. Revisit at 100k users. |
| Guest / limited access | Complex permissions model. Invite + remove is simpler. |

---

## Build Order (Recommended Sprints)

| Sprint | Focus | Key deliverable |
|--------|-------|-----------------|
| 1 | Team activation | Workspace creation, invite flow, member list |
| 2 | Assignment | Assignee on tasks, "assigned to me" filter, picker UI |
| 3 | Board view | Project board, drag status, view toggle |
| 4 | Message board | Posts, comments, project activity feed |
| 5 | Team admin | Remove member, leave workspace, workspace labels |
| 6 | Notifications | Notification center, task subscriptions |
| 7 | Cycles | Iteration toggles, cycle view, rollover |
| 8 | Search | Cross-project search, filters, saved searches |
| 9 | Permissions | Admin/member roles, project privacy |
| 10 | Templates | Project templates, template library |
| 11 | Workload | Workload view, over-assignment indicator |
| 12 | API + export | API tokens, webhooks, CSV/JSON import |
| 13–14 | Polish | Docker images, one-click deploy, admin dashboard |

Each sprint is 1-2 weeks of focused work. Phases 1-2 (sprints 1-6) are the
critical path to a shippable team product.

---

## Success Check — Phase 1 Walkthrough

A new user should be able to do this in under 5 minutes:

1. Sign up → land in personal inbox ✅
2. Create a project → add a few tasks ✅
3. Invite a teammate by email → they accept ✅
4. Assign a task to them → they see it ✅
5. Open the board → drag a task to "done" ✅
6. Write a post in the project → teammate replies ✅
7. See all this in the activity feed ✅

If this flow exists and feels fast, Phase 1 is shippable.
