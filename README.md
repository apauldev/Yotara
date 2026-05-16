# Yotara

<div align="center">

<img src="./docs/assets/yotara-logo.svg" alt="Yotara logo" width="120" />

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:173F35,50:3E7B63,100:B7D3C3&height=220&section=header&text=Yotara&fontSize=56&fontColor=F7F6F2&fontAlignY=38&desc=Flow%20through%20your%20day%2C%20naturally.&descSize=18&descAlignY=58" alt="Yotara banner" />

<p>
  <a href="https://github.com/apauldev/Yotara/actions"><img src="https://img.shields.io/github/actions/workflow/status/apauldev/Yotara/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white" alt="Build Status" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-7BA58D?style=for-the-badge&logo=opensourceinitiative&logoColor=white" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/pnpm-9.x-3E7B63?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/version-0.1.0--alpha-1C5D4B?style=for-the-badge" alt="Version" />
</p>

<p>
  <a href="./PROJECT_README.md"><img src="https://img.shields.io/badge/docs-project_guide-24473c?style=for-the-badge&logo=readme&logoColor=F7F6F2" alt="Project guide" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/contributing-welcome-7BA58D?style=for-the-badge&logo=github&logoColor=white" alt="Contributing" /></a>
  <a href="#contributors"><img src="https://img.shields.io/github/all-contributors/apauldev/Yotara?color=3E7B63&style=for-the-badge" alt="All Contributors" /></a>
</p>

<h3>A high-performance, self-hosted task engine for focused individuals and lean teams.</h3>

<p>
  Yotara bridges the gap between minimalist personal to-do apps and heavyweight project management suites. 
  It is designed to be calm, fast, and obvious for individual use, yet capable of stretching into team collaboration without the process theater.
</p>

---

[**Explore Docs**](./PROJECT_README.md) • [**View Roadmap**](./ROADMAP.md) • [**Join Discussion**](https://github.com/apauldev/Yotara/discussions) • [**Report Bug**](https://github.com/apauldev/Yotara/issues)

</div>

---

## 🎨 The Yotara Experience

Most productivity software forces a compromise: elegant personal tools that break when shared, or enterprise monsters that feel like a second job. **Yotara is the middle ground.**

<table>
  <tr>
    <td width="50%">
      <h3>🎯 Personal First</h3>
      <p>A workflow that centers on <i>you</i>. Inbox, Today, and Upcoming views ensure you always know what's next without the noise of an empty corporate dashboard.</p>
    </td>
    <td width="50%">
      <h3>🤝 Team Ready</h3>
      <p>Collaboration that layers onto your personal flow. Share projects and tasks when you need to, without adopting sprints, epics, or ceremony.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🛡️ Sovereign Data</h3>
      <p>Self-hosted by design. Built on a portable SQLite + Drizzle stack, giving you full control over your data, privacy, and infrastructure.</p>
    </td>
    <td width="50%">
      <h3>⚡ High Performance</h3>
      <p>Zero-lag interactions driven by Angular 21 and a Fastify backend. Optimized for speed, from paginated API endpoints to local WAL-mode SQLite.</p>
    </td>
  </tr>
</table>

---

## ✨ Key Features

<details open>
<summary><b>💎 Personal Mode & Productivity</b></summary>
<br />

- **Unified Inbox:** Capture everything, refine later. Supported by a hero quick-capture experience.
- **Dynamic Views:** Smart filters for `Today`, `Upcoming`, and `Archive` based on real-time task metadata.
- **Smart Metadata:** Rich task details including priorities, due dates, "Simple Mode" toggles, and personal focus buckets.
- **Global Search:** Blazing fast search across tasks, projects, and labels with matched-context highlighting.
- **Mindful Journaling:** Rotating daily prompts to keep your focus aligned with your long-term goals.
</details>

<details>
<summary><b>🛠️ Engineering & DX Highlights</b></summary>
<br />

- **Modern Monorepo:** Clean `pnpm` workspace structure with shared packages and automated code quality.
- **Robust Error System:** Global status tracking, automated toast notifications, and persistent local logging.
- **API-First Design:** Fully documented OpenAPI/Swagger spec served directly from the Fastify backend.
- **Docker First:** Multi-stage Dockerfiles and optimized Compose configurations for easy deployment.
</details>

---

## 🚀 Recent Milestones

> We're building fast. Here's what just landed:

- ✅ **Task Pagination & Sorting:** Zero-lag handling of thousands of tasks (#107).
- ✅ **Global Status System:** Real-time loading indicators and professional notification toasts (#106).
- ✅ **Lifecycle Management:** Full archive, restore, and permanent delete flows with `archived_at` timestamps (#101).
- ✅ **Surgical UI Refinement:** Refreshed labels, projects, and task views with an integrated insight panel.
- ✅ **Security & Settings:** settings-based password management and secure session handling.

---

## 📸 Visual Preview

<p align="center">
  <img src="./screenshots/screen.png" alt="Yotara personal today view screenshot" width="48%" />
  <img src="./screenshots/screen 2.png" alt="Yotara personal projects view screenshot" width="48%" />
</p>

<p align="center">
  <img src="./screenshots/screen 3.png" alt="Yotara personal inbox view screenshot" width="48%" />
</p>

<p align="center">
  <sub><i>Current build previews showing the refined, calm personal-mode experience.</i></sub>
</p>

---

## 🛠️ Tech Stack

<div align="center">

| Component | Technology |
| :--- | :--- |
| **Frontend** | [Angular 21](https://angular.dev), [Tailwind CSS](https://tailwindcss.com), [Spartan UI](https://www.spartan.ng) |
| **Backend** | [Fastify](https://www.fastify.io), [TypeScript](https://www.typescriptlang.org), [Better Auth](https://www.better-auth.com) |
| **Database** | [SQLite](https://www.sqlite.org), [Drizzle ORM](https://orm.drizzle.team) |
| **DevOps** | [Docker](https://www.docker.com), [pnpm](https://pnpm.io), [Husky](https://typicode.github.io/husky) |

<br />

<img src="https://skillicons.dev/icons?i=angular,ts,fastify,sqlite,docker,tailwind,githubactions" alt="Tech Stack Icons" />

</div>

---

## 🏁 Quick Start

Getting Yotara running locally takes less than 2 minutes.

```bash
# 1. Clone the repository
git clone https://github.com/apauldev/Yotara.git
cd Yotara

# 2. Install dependencies
pnpm install

# 3. Boot the full stack (API, Frontend, and DB Studio)
pnpm dev
```

> **Note:** For Docker-based deployment and detailed environment configuration, see the [**Project Guide**](./PROJECT_README.md).

---

## 🤝 Contributing

Yotara is an open-source project, and we love community involvement. 

1.  **Check the [ROADMAP.md](./ROADMAP.md)** to see our current priorities.
2.  **Browse [Issues](https://github.com/apauldev/Yotara/issues)** for `good-first-issue` labels.
3.  **Read [CONTRIBUTING.md](./CONTRIBUTING.md)** for our development standards.

---

## ✨ Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

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
  <p>Built with ❤️ for focused work.</p>
  <img src="https://capsule-render.vercel.app/api?type=rect&color=173F35&height=30&section=footer" width="100%" />
</div>
