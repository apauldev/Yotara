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

<h3>A calm, self-hosted task manager for focused people and quiet teams.</h3>

<p>
  Yotara is designed to feel like a clear desk and a deep breath. It sits between minimalist to-do lists and heavy project management suites, keeping the useful parts and leaving the noise behind. Built for personal flow first, with team collaboration that appears only when needed.
</p>

<p>
  <em>Take a task, place it gently, and let the rest of the day keep its shape. 🍃</em>
</p>

---

[**Explore Docs**](./PROJECT_README.md) • [**View Roadmap**](./ROADMAP.md) • [**Join Discussion**](https://github.com/apauldev/Yotara/discussions) • [**Report Bug**](https://github.com/apauldev/Yotara/issues)

</div>

---

## 🌿 The Yotara Experience

Most productivity tools ask you to trade calm for capability. **Yotara tries to keep both.** It is built for people who want structure without feeling managed by the software itself.

<table>
  <tr>
    <td width="50%">
      <h3>🌱 Personal First</h3>
      <p>Inbox, Today, and Upcoming views keep the next step visible without turning your workspace into a storm of widgets. Everything stays close, readable, and easy to return to.</p>
    </td>
    <td width="50%">
      <h3>🤝 Team Ready</h3>
      <p>Share projects and tasks only when collaboration matters. No ceremony for the sake of ceremony, just enough structure for the work to move along smoothly.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🛡️ Sovereign Data</h3>
      <p>Self-hosted by design. Built on a portable SQLite + Drizzle stack so your data, privacy, and infrastructure stay in your hands.</p>
    </td>
    <td width="50%">
      <h3>⚡ Quiet Performance</h3>
      <p>Fast interactions powered by Angular 21 and Fastify. The stack is tuned for low-friction navigation, responsive APIs, and a database setup that stays out of the way.</p>
    </td>
  </tr>
</table>

---

## ✨ Key Features

<details open>
<summary><b>💎 Personal Mode & Productivity</b></summary>
<br />

- **Unified Inbox:** Capture everything now, sort it out later. A soft landing zone for incoming thoughts.
- **Dynamic Views:** Smart filters for `Today`, `Upcoming`, and `Archive` based on live task metadata.
- **Smart Metadata:** Priorities, due dates, `Simple Mode`, and personal focus buckets, all organized without clutter.
- **Global Search:** Fast search across tasks, projects, and labels with matched-context highlighting.
- **Mindful Journaling:** Rotating daily prompts to keep your attention pointed in a useful direction.
</details>

<details>
<summary><b>🛠️ Engineering & DX Highlights</b></summary>
<br />

- **Modern Monorepo:** A clean `pnpm` workspace with shared packages and automated code quality checks.
- **Robust Error System:** Global status tracking, toast notifications, and persistent local logging.
- **API-First Design:** Fully documented OpenAPI/Swagger spec served from the Fastify backend.
- **Docker First:** Multi-stage Dockerfiles and Compose setups for straightforward deployment.
</details>

---

## 🚀 Recent Milestones

> A few fresh leaves on the branch:

- ✅ **Task Pagination & Sorting:** Smooth handling of thousands of tasks (#107).
- ✅ **Global Status System:** Real-time loading indicators and notification toasts (#106).
- ✅ **Lifecycle Management:** Archive, restore, and permanent delete flows with `archived_at` timestamps (#101).
- ✅ **Surgical UI Refinement:** Refreshed labels, projects, and task views with an integrated insight panel.
- ✅ **Security & Settings:** Settings-based password management and secure session handling.

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
  <sub><i>Current build previews showing a calmer, more settled personal-mode experience.</i></sub>
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

Yotara is an open-source project, and community care keeps it growing.

1. **Check the [ROADMAP.md](./ROADMAP.md)** to see current priorities.
2. **Browse [Issues](https://github.com/apauldev/Yotara/issues)** for `good-first-issue` labels.
3. **Read [CONTRIBUTING.md](./CONTRIBUTING.md)** for development standards.

---

## ✨ Contributors

Thanks go to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

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
  <p>Built with care for focused work, one quiet task at a time. 🌿</p>
  <img src="https://capsule-render.vercel.app/api?type=rect&color=173F35&height=30&section=footer" width="100%" />
</div>
