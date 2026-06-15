# Yotara

<div align="center">

<img src="./docs/assets/yotara-logo.svg" alt="Yotara logo" width="100" />

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:173F35,50:3E7B63,100:B7D3C3&height=240&section=header&text=Yotara&fontSize=56&fontColor=F7F6F2&fontAlignY=36&desc=Flow%20through%20your%20day%2C%20naturally.&descSize=18&descAlignY=56" alt="Yotara banner" />

<br />

<a href="https://github.com/apauldev/Yotara/actions"><img src="https://img.shields.io/github/actions/workflow/status/apauldev/Yotara/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI&color=3E7B63" alt="CI" /></a>
<a href="https://github.com/apauldev/Yotara/releases"><img src="https://img.shields.io/github/v/release/apauldev/Yotara?style=for-the-badge&logo=github&color=173F35" alt="Release" /></a>
<a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-7BA58D?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="License" /></a>
<a href="https://github.com/apauldev/Yotara/security"><img src="https://img.shields.io/badge/security-CodeQL-1C5D4B?style=for-the-badge&logo=github&logoColor=white" alt="Security" /></a>
<a href="https://github.com/apauldev/Yotara/graphs/contributors"><img src="https://img.shields.io/github/contributors/apauldev/Yotara?style=for-the-badge&color=24473c" alt="Contributors" /></a>
<a href="https://github.com/apauldev/Yotara"><img src="https://img.shields.io/github/stars/apauldev/Yotara?style=for-the-badge&logo=github&color=B7D3C3&logoColor=173F35" alt="Stars" /></a>

<br />

<h3>A calm, self-hosted task manager for focused people and quiet teams.</h3>

<p>
  Yotara is designed to feel like a clear desk and a deep breath. It sits between minimalist to-do lists and heavy project management suites, keeping the useful parts and leaving the noise behind. Built for personal flow first, with team collaboration that appears only when needed.
</p>

<p>
  <em>Take a task, place it gently, and let the rest of the day keep its shape.</em>
</p>

<br />

<a href="./PROJECT_README.md"><img src="https://img.shields.io/badge/docs-project_guide-24473c?style=for-the-badge&logo=readme&logoColor=F7F6F2" alt="Project Guide" /></a>
<a href="./docs/ARCHITECTURE.md"><img src="https://img.shields.io/badge/architecture-deep_dive-3E7B63?style=for-the-badge&logo=bookstack&logoColor=white" alt="Architecture" /></a>
<a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributing-welcome-7BA58D?style=for-the-badge&logo=github&logoColor=white" alt="Contributing" /></a>
<a href="https://github.com/apauldev/Yotara/issues"><img src="https://img.shields.io/github/issues/apauldev/Yotara?style=for-the-badge&logo=github&color=B7D3C3&logoColor=173F35" alt="Issues" /></a>

</div>

---

## The Yotara Experience

Most productivity tools ask you to trade calm for capability. Yotara tries to keep both. It is built for people who want structure without feeling managed by the software itself.

<table>
  <tr>
    <td width="50%">
      <h3>Personal First</h3>
      <p>Inbox, Today, and Upcoming views keep the next step visible without turning your workspace into a storm of widgets. Everything stays close, readable, and easy to return to.</p>
    </td>
    <td width="50%">
      <h3>Team Mode (Planned)</h3>
      <p>Personal mode is the focus today. Team mode is planned.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>Sovereign Data</h3>
      <p>Self-hosted by design. Built on a portable SQLite + Drizzle stack so your data, privacy, and infrastructure stay in your hands.</p>
    </td>
    <td width="50%">
      <h3>Quiet Performance</h3>
      <p>Fast interactions powered by Angular 21 and Fastify. The stack is tuned for low-friction navigation, responsive APIs, and a database that stays out of the way.</p>
    </td>
  </tr>
</table>

---

## Why Yotara?

<h3>
  Not another todo app. Not another project management suite.<br />
  Something in between that respects your attention.
</h3>

| Instead of... | You get... |
|:---|---|
| **Todoist / TickTick** -- polished but SaaS, subscription fatigue, your data on their servers | Self-hosted, offline-capable SQLite, no recurring bills, full data ownership |
| **Vikunja / Plane** -- powerful but heavy, complex UI, overkill for one person | Lightweight Angular + Fastify stack, Simple Mode when you just need a list |
| **Obsidian / Notion** -- infinitely flexible but infinite setup, you spend more time organizing than doing | Opinionated defaults that work out of the box. Structure without the blank-page paralysis |
| **Paper / sticky notes** -- no notifications, no search, no recurring tasks | Full-text search, smart filters, recurring tasks, keyboard shortcuts -- but still calm |

> **Yotara is for:** makers, writers, students, freelancers, small teams, and anyone who needs task management that stays out of the way. If you have ever felt managed by your task manager, this is the antidote.

---

## Features

<details open>
<summary><b>Personal Productivity</b></summary>
<br />

| Feature | Description |
|:---|:---|
| **Inbox** | Capture everything now, sort later. A soft landing for incoming thoughts. |
| **Today** | See what matters right now. Tasks due today or marked for today. |
| **Upcoming** | Plan your week. Tasks grouped by due date with weekly rhythm. |
| **Projects** | Group related tasks. Custom colors, live task counts, soft delete. |
| **Labels** | Categorize tasks across projects. Multi-label support for cross-cutting concerns. |
| **Archive** | Completed tasks move here. Restore or permanently delete with full lifecycle management. |
| **Search** | Full-text search across tasks, projects, and labels with context highlighting. |

</details>

<details>
<summary><b>Smart Task Management</b></summary>
<br />

| Feature | Description |
|:---|:---|
| **Recurring Tasks** | Daily, weekly, monthly, or yearly with edge-case handling for month-ends and leap years. |
| **Subtasks** | Break big tasks into smaller steps. One level of nesting keeps it simple. |
| **Simple Mode** | Hide dates and metadata when you just need a flat list. Toggle per task. |
| **7 Themes** | Dark mode, light mode, and everything between. Custom CSS properties for your own. |
| **Keyboard Shortcuts** | Navigate every view without touching the mouse. Power-user speed. |
| **Daily Tips** | Rotating productivity prompts on login. A small nudge, not a notification. |

</details>

<details>
<summary><b>Engineering & DX</b></summary>
<br />

| Feature | Description |
|:---|:---|
| **Modern Monorepo** | pnpm workspace with shared packages, automated code quality, and consistent tooling. |
| **API-First Design** | Fully documented OpenAPI/Swagger spec served from the Fastify backend. Auto-generated. |
| **Typed Error System** | HTTP-status-aware error hierarchy. Meaningful 4xx responses instead of opaque 500s. |
| **Docker First** | Multi-stage Dockerfiles, Docker Compose, and CI smoke tests for production-ready deployment. |
| **Automated Releases** | Semantic versioning from conventional commits. CI builds, tags, and publishes changelogs. |

</details>

---

## Recent Milestones

A few fresh leaves on the branch. Yotara is actively developed and improving every sprint.

- Typed Error Hierarchy -- replaced bare `throw new Error` with typed, HTTP-aware errors across the entire API.
- Preferences Store -- centralized all `localStorage` access into a single injectable service instead of scattered magic strings.
- Signal-Driven UI -- replaced `setTimeout` hacks with proper Angular signals for loading bars and state transitions.
- Docker CI Smoke Tests -- code PRs build images and run a full stack smoke test before merge. Docs-only and screenshot-only changes skip CI.
- OpenAPI Docs -- auto-generated Swagger UI served at `/docs` with full request/response schemas.
- Task Pagination -- server-side pagination for smooth handling of thousands of tasks.
- Lifecycle Management -- archive, restore, and permanent delete with `archived_at` timestamps.

---

## Screenshots

<p align="center">
  <img src="./screenshots/screen.png" alt="Yotara today view" width="48%" />
  <img src="./screenshots/screen 2.png" alt="Yotara projects view" width="48%" />
</p>

<p align="center">
  <img src="./screenshots/screen 3.png" alt="Yotara inbox view" width="48%" />
</p>

<p align="center">
  <sub><i>Current build. A calm, settled personal-mode experience.</i></sub>
</p>

---

## Tech Stack

<div align="center">

| Layer | Technology |
|:---|:---|
| **Frontend** | [Angular 21](https://angular.dev) (standalone, signals, lazy routes) |
| **Backend** | [Fastify 5](https://www.fastify.io) + [TypeScript](https://www.typescriptlang.org) |
| **Auth** | [Better Auth](https://www.better-auth.com) (session cookies, CORS, CSRF) |
| **Database** | [SQLite](https://www.sqlite.org) + [Drizzle ORM](https://orm.drizzle.team) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com) + CSS custom properties |
| **Icons** | [Font Awesome](https://fontawesome.com) |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) + [Docker](https://www.docker.com) |
| **Package** | [pnpm](https://pnpm.io) workspaces |

<br />

<img src="https://skillicons.dev/icons?i=angular,ts,fastify,sqlite,drizzle,tailwind,docker,githubactions" alt="Tech stack icons" />

</div>

---

## Quick Start

Getting Yotara running locally takes under a minute.

```bash
git clone https://github.com/apauldev/Yotara.git
cd Yotara
pnpm install
pnpm dev
```

This starts three services in parallel:

| Service | URL | Purpose |
|:---|:---|:---|
| **Frontend** | http://localhost:4200 | Angular dev server with hot reload |
| **API** | http://localhost:3000 | Fastify backend with auto-reload |
| **Drizzle Studio** | https://local.drizzle.studio | Database GUI for inspection |

### Environment

The dev runner (`pnpm dev`) loads `apps/api/.env` automatically. To configure:

```bash
cp apps/api/.env.example apps/api/.env
# Then edit apps/api/.env to set your values
```

For Docker deployment, see [DOCKER.md](./DOCKER.md).

---

## Project Structure

```
Yotara/
  apps/
    api/                Fastify + Drizzle backend
      src/
        routes/         Route handlers (tasks, projects, labels, auth, me)
        services/       Business logic layer
        db/             Schema, migrations, client
        docs/           OpenAPI spec generation
      drizzle/          SQLite migrations
    frontend/           Angular 21 application
      src/app/
        core/           Auth guards, services, interceptors
        features/       Feature modules (personal, team, onboarding)
        shared/         Reusable UI primitives, pipes, directives
  packages/
    shared/             Domain types, DTOs, auth client
  docs/                 Architecture guide, roadmap, assets
  scripts/              Dev runner, release automation, versioning
```

---

## Contributing

Yotara is open source, and community care keeps it growing. We would love your help.

1. Start with the [Architecture Guide](./docs/ARCHITECTURE.md) to understand the lay of the land.
2. Browse [good first issues](https://github.com/apauldev/Yotara/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) to find something to work on.
3. Read the [Contributing Guide](./CONTRIBUTING.md) for setup, conventions, and PR process.

---

## Contributors

Thanks go to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/apauldev"><img src="https://avatars.githubusercontent.com/u/6706835?v=4?s=100" width="100px;" alt="Arul"/><br /><sub><b>Arul</b></sub></a><br /><a href="https://github.com/apauldev/Yotara/commits?author=apauldev" title="Code">Code</a> <a href="https://github.com/apauldev/Yotara/commits?author=apauldev" title="Documentation">Docs</a> <a href="#design-apauldev" title="Design">Design</a> <a href="#ideas-apauldev" title="Ideas, Planning, & Feedback">Ideas</a> <a href="#maintenance-apauldev" title="Maintenance">Maintenance</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/shivansh090"><img src="https://avatars.githubusercontent.com/u/116243866?v=4?s=100" width="100px;" alt="Shivansh Vikram Singh"/><br /><sub><b>Shivansh Vikram Singh</b></sub></a><br /><a href="https://github.com/apauldev/Yotara/commits?author=shivansh090" title="Documentation">Docs</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

Want to see your name here? Check the [contributing guide](./CONTRIBUTING.md).

---

## Versioning

Yotara follows Semantic Versioning powered by Conventional Commits and automated release workflows.

| Commit Type | Bump | Example |
|:---|:---:|:---|
| `feat:` | Minor | `feat: add recurring task support` |
| `fix:` | Patch | `fix: correct date overflow in February` |
| `feat!:` or `fix!:` | Major | `feat!: redesign task data model` |
| `docs:`, `refactor:`, `test:` | Patch | `refactor: extract PreferencesStore` |

Automated releases run via GitHub Actions when code is merged to `main`. Docs-only and screenshot-only changes are skipped. The release workflow: version bump, changelog, tag, and GitHub Release. All hands-off.

---

## Security

If you discover a security vulnerability, please report it privately via the [Security Policy](./SECURITY.md). Every report is taken seriously.

---

## License

[MIT](./LICENSE). Do what you like, just keep the license notice.

---

<div align="center">
  <br />
  <p>
    <em>Built with care for focused work, one quiet task at a time.</em>
  </p>
  <img src="https://capsule-render.vercel.app/api?type=rect&color=173F35&height=30&section=footer" width="100%" />
</div>
