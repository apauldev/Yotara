# Yotara MVP Roadmap

This document outlines the complete list of screens, pages, and modals needed for the Yotara MVP. Items are grouped by priority and logical build order—with the first 8–10 screens forming the foundation for a usable personal task manager.

---

## 1. Entry & Auth Screens (Must Have)

### Login / Sign In
- **Status**: ✅ Already built
- Centered form with email, password, forgot password link, create account CTA

### Register / Sign Up
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
- **Status**: 🟡 Placeholder UI exists, full project data model still pending
- Project name header + description
- **View switcher**: List | Kanban
  - List view: traditional task list
  - Kanban view: To Do | In Progress | Done columns
- Add task button (inline and/or floating action button)
- Edit/archive project options

### Task Detail / Edit Modal ⭐ (Most Important)
- **Status**: ✅ Built for personal-mode task create/edit
- **Triggered from**: task list click or create action
- **Core fields**:
  - Title (editable)
  - Checkbox + completed state
  - Markdown description (textarea + preview toggle)
  - Due date picker
  - Start date picker (optional)
  - Priority selector (Low | Medium | High)
  - Labels / tags multi-select
  - Subtasks (list with check/add/delete/reorder)
  - Recurring toggle (basic: daily | weekly | monthly)
- **Team mode additions**:
  - Assignee dropdown
  - Comments section
  - Activity log
- **Actions**: Save | Delete | Close

---

## 4. Team Mode–Specific Screens

### Workspaces Overview (`/workspaces`)
- List of workspaces (cards or simple list view)
- Create workspace button/modal

### Workspace Settings / Members
- **Modal or page** (`/workspaces/:id/settings`)
- Workspace name, description, icon/color
- Members list with avatars + role badges
- Invite by email or public link
- (Optional) role/permission management

---

## 5. Utility & Settings Screens

### Settings (`/settings`)
- **Status**: Not started
- **Account tab**
  - Email display/change
  - Password change
  - Delete account option
- **Appearance tab**
  - Theme selector: Light | Dark | Auto
- **Preferences tab**
  - Default view (Inbox | Today | Upcoming)
  - Date format (US | ISO | etc.)
  - Quick-add behavior
- **Data & Privacy tab**
  - Export data (JSON / CSV button)
- **About section**
  - Version, license, links

### Labels / Tags Management
- Dedicated page or modal
- Create/edit/delete labels
- Color picker for each label
- Search/filter labels

### Global Search Results
- Triggered from top bar search icon
- Route: `/search?q=…` or search overlay/modal
- Results grouped by:
  - Project
  - Due date
  - Completion status

---

## 6. Micro-Screens & States

### Empty States
- Inbox empty illustration + message
- Today empty state
- No projects state
- No results (search)

### Loading States
- Skeleton loaders for task lists
- Loading spinners for async operations

### Error States
- Network error message with retry
- Unauthorized / session expired
- 404 / Not Found page
- Generic error fallback

### Notifications & Alerts
- In-app notification panel/dropdown
- Mentions, assignments, comments (team mode)
- (Optional) toast notifications for quick feedback

### Confirmation Dialogs
- Delete task confirmation
- Leave workspace confirmation
- Delete project confirmation

---

## 7. Deployment & Distribution

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
8. 🟡 Project create + project detail (data model still pending)

### Phase 3: Polish & Secondary Features
9. 🟡 Settings basics + logout
10. ✅ Empty states + error handling
11. 🟡 Global search
12. 🟡 Labels / tags management
13. 🟡 Workspace switcher and member list UI
14. 🟡 404 page + delete confirmation modal
15. 🟡 Task loading skeletons + validation/error polish

### Phase 4: Enhanced UX
- Kanban view for projects
- Subtasks and recurring tasks UI
- Markdown preview in task detail

### Phase 5: Team Mode (Post-MVP)
- Workspaces + member management
- Task assignment
- Comments & activity log
- Real-time collaboration

### Phase 6: Deployment & Distribution (Growth)
- Pre-built Docker images on Docker Hub
- Docker Compose with pre-built images (no local build)
- Render.com one-click deploy template
- Railway.app one-click deploy template
- Coolify deployment documentation (optional)

### Delivery / Ops
- API docs exposed at `/docs`
- Paginated task list endpoint
- Soft delete support for tasks
- Docker and Compose deployment path
- Docker smoke script for local verification
- GitHub Actions CI for Docker image builds and pushes
- Environment variable documentation for all platforms

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
- OpenAPI docs and Swagger UI
- Docker deployment and smoke checks
- Inbox counter pipe

### 🔄 In Progress
- Team-mode shell and workspace primitives
- Project data model and project detail screens
- Settings shell and account/logout flows

### 📋 Not Started
- Kanban project view
- Subtasks and recurring tasks UI
- Global search
- Team workspace membership and assignment features
- Labels / tags management
- 404 page and confirmation dialogs
- Task loading skeletons and form validation polish
- Pre-built Docker images (Phase 6)
- One-click cloud deploy templates (Phase 6)

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

- [ ] Set up feature module structure in `apps/frontend/src/app/features`
- [ ] Create task-detail modal component
- [ ] Implement Today / Upcoming list views
- [ ] Add project create & list views
- [ ] Build settings module
- [ ] Integrate real-time updates (optional for MVP)
- [ ] User testing & iterate

---

## Questions & Decisions Needed

- **Recurring tasks**: Support simplified version (daily/weekly/monthly) or full cron?
- **Subtasks**: Full nesting support or just one level?
- **Kanban**: Include in MVP or as Phase 4?
- **Team mode**: Hide completely or show greyed-out tab in MVP?
- **Notifications**: Real-time via WebSocket or polling?

---

For detailed technical setup, see [PROJECT_README.md](./PROJECT_README.md).
For testing patterns, see [testing.md](./testing.md).
