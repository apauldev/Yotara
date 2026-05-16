# Yotara

<div align="center">

<img src="./docs/assets/yotara-logo.svg" alt="Yotara logo" width="88" />

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:173F35,50:3E7B63,100:B7D3C3&height=220&section=header&text=Yotara&fontSize=56&fontColor=F7F6F2&fontAlignY=38&desc=Flow%20through%20your%20day%2C%20naturally.&descSize=18&descAlignY=58" alt="Yotara banner" />

<p>
  <a href="./PROJECT_README.md"><img src="https://img.shields.io/badge/docs-project_guide-24473c?style=for-the-badge&logo=readme&logoColor=F7F6F2" alt="Project guide" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributing-welcome-7BA58D?style=for-the-badge&logo=github&logoColor=white" alt="Contributing" /></a>
  <a href="#contributors"><img src="https://img.shields.io/github/all-contributors/apauldev/Yotara?color=3E7B63&style=for-the-badge" alt="All Contributors" /></a>
  <img src="https://img.shields.io/badge/self--hosted-yes-3E7B63?style=for-the-badge&logo=docker&logoColor=white" alt="Self-hosted" />
  <img src="https://img.shields.io/badge/open_source-MIT-7BA58D?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="MIT license" />
  <img src="https://img.shields.io/badge/stack-Angular%2021%20%2B%20Fastify%20%2B%20SQLite-1C5D4B?style=for-the-badge&logo=typescript&logoColor=white" alt="Tech stack" />
</p>

<h3>A high-performance, self-hosted task manager built for focused individuals and lean teams.</h3>

<p>
  Yotara bridges the gap between minimalist personal to-do apps and heavyweight project management suites. 
  It is designed to be calm, fast, and obvious for individual use, yet capable of stretching into team collaboration without the process theater.
</p>

<p>
  <a href="./PROJECT_README.md"><strong>Quick Start</strong></a>
  ·
  <a href="#the-yotara-philosophy"><strong>Philosophy</strong></a>
  ·
  <a href="#current-capabilities"><strong>Capabilities</strong></a>
  ·
  <a href="./ROADMAP.md"><strong>Roadmap</strong></a>
  ·
  <a href="./CONTRIBUTING.md"><strong>Contributing</strong></a>
</p>

</div>

---

## The Yotara Philosophy

Software often forces a choice: elegant personal tools that break when shared, or enterprise monsters that feel like a second job. Yotara is the middle ground.

*   **Personal First:** A workflow that centers on *you*—Inbox, Today, and Upcoming—not an empty corporate dashboard.
*   **Team Ready:** Collaboration that layers on top of your personal flow, rather than replacing it with sprints and epics.
*   **Sovereign Data:** Self-hosted by design. You own your data, your stack, and your privacy.

## Current Capabilities

Yotara is in active development, with a robust **Personal Mode** already in production-ready shape.

### 💎 Personal Mode Experience
- **Focused Shell:** Dedicated views for `Inbox`, `Today`, `Upcoming`, `Projects`, `Labels`, and `Archive`.
- **Smart Metadata:** Capture priority, due dates, "Simple Mode" toggles, and personal buckets (Sanctuary, Deep Work, etc.).
- **Global Search:** Fast, unified search across tasks, projects, and labels.
- **Journaling & Clarity:** Rotating daily prompts to keep your focus aligned with your goals.

### 🛠️ Architecture & DX
- **Modern Stack:** Built with **Angular 21**, **Fastify**, **Better Auth**, and **Drizzle ORM**.
- **Performance First:** SQLite persistence with WAL mode and paginated API endpoints for lightning-fast loads.
- **Robust Error Management:** Global status tracking, automated toast notifications, and a persistent logging system.
- **API-First:** Full OpenAPI/Swagger documentation served directly from the backend.
- **Monorepo DX:** Clean pnpm workspace structure with shared packages and automated code quality tools.

### 🚀 Recent Progress
- ✅ **Task Pagination & Sorting:** Handles thousands of tasks with zero lag (#107).
- ✅ **Global Status System:** Professional loading indicators and error toast notifications (#106).
- ✅ **Archive Lifecycle Complete:** Full archive, restore, and permanent delete flows with `archived_at` timestamps (#101).
- ✅ **404 Page:** Friendly error page with animation and navigation (#103).
- ✅ **Enhanced Task Capture:** Robust task input with improved UX (#102).
- ✅ **UI & Styling Polish:** Refreshed labels, projects, and task list pages with insight panel (#97, #96, #98).
- ✅ **Change Password Flow:** Complete settings-based password management (#99).
- ✅ **Comprehensive UI Primitives:** Accessible modals, confirmation dialogs, and reusable page headers.
- ✅ **Docker Ready:** Local build-based Compose deployment with health checks.

## Visual Preview

<p align="center">
  <img src="./screenshots/screen.png" alt="Yotara personal today view screenshot" width="48%" />
  <img src="./screenshots/screen 2.png" alt="Yotara personal projects view screenshot" width="48%" />
</p>

<p align="center">
  <img src="./screenshots/screen 3.png" alt="Yotara personal inbox view screenshot" width="48%" />
</p>

<p align="center">
  <sub>
    <i>Current build previews showing the refined personal-mode experience.</i>
  </sub>
</p>

## Tech Stack

<p align="center">
  <img src="https://skillicons.dev/icons?i=angular,ts,fastify,sqlite,docker" alt="Angular TypeScript Fastify SQLite Docker" />
</p>

- **Frontend:** Angular 21, Tailwind CSS, Spartan UI
- **Backend:** Fastify, TypeScript, Better Auth
- **Database:** SQLite, Drizzle ORM
- **Operations:** Docker, Docker Compose, pnpm Workspaces

## Quick Start

Full setup instructions, environment variables, and API details live in the [**Project Guide**](./PROJECT_README.md).

```bash
# Clone the repository
git clone https://github.com/apauldev/Yotara.git
cd Yotara

# Install dependencies
pnpm install

# Start development environment (API, Frontend, and DB Studio)
pnpm dev
```

## Contributing

We welcome contributions of all kinds! Whether you're fixing a bug, suggesting a feature, or improving documentation, your help is appreciated.

- **Check the [ROADMAP.md](./ROADMAP.md)** to see what we're building next.
- **Read [CONTRIBUTING.md](./CONTRIBUTING.md)** for our development standards and PR process.
- **Join the discussion** by opening an issue or a pull request.

## Contributors

This project follows the [all-contributors](https://allcontributors.org) specification. 

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/apauldev"><img src="https://avatars.githubusercontent.com/u/6706835?v=4?s=100" width="100px;" alt="Arul"/><br /><sub><b>Arul</b></sub></a><br /><a href="https://github.com/apauldev/Yotara/commits?author=apauldev" title="Code">💻</a> <a href="https://github.com/apauldev/Yotara/commits?author=apauldev" title="Documentation">📖</a> <a href="#design-apauldev" title="Design">🎨</a> <a href="#ideas-apauldev" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-apauldev" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/shivansh090"><img src="https://avatars.githubusercontent.com/u/116243866?v=4?s=100" width="100px;" alt="Shivansh Vikram Singh"/><br /><sub><b>Shivansh Vikram Singh</b></sub></a><br /><a href="https://github.com/apauldev/Yotara/commits?author=shivansh090" title="Documentation">📖</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

---

<div align="center">
  <sub>Built for focused work, not workflow theater.</sub>
</div>
