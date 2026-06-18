# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.59.6](https://github.com/apauldev/Yotara/compare/v0.59.5...v0.59.6) (2026-06-18)


### Bug Fixes

* exclude overdue tasks from view=today ([49135e9](https://github.com/apauldev/Yotara/commit/49135e96afd4d57fbf596d5b026846638ab6aaae))
* exclude today/overdue tasks from view=upcoming ([7db0df2](https://github.com/apauldev/Yotara/commit/7db0df2e01400df236111e6b44a4b53ab37d5f73))
* increase max pageSize from 100 to 1000 for allActiveTasks query ([613ccc8](https://github.com/apauldev/Yotara/commit/613ccc8902ec64a5154df8db4e5c9b99dc69debd))
* restore task-load error reporting for network and 5xx failures ([4df5786](https://github.com/apauldev/Yotara/commit/4df57862d329a929404883fd08eb1ebd90a9c30f))
* stop subtasks from consuming per-view page rows ([407177a](https://github.com/apauldev/Yotara/commit/407177a5efcf40ec81a02ed7ffad471fa57981ac))


### Refactoring

* remove expand loop, stale signals, and client-side date helpers from TaskService ([719e309](https://github.com/apauldev/Yotara/commit/719e309ad62f1bc03e104e33f13ae6fe8e274088))


### Tests

* add coverage for timezone helpers, export endpoint, and per-view errors ([d2b0c00](https://github.com/apauldev/Yotara/commit/d2b0c00d8371714d1e7dd9812e0d96a9b0f00a20))

## [0.59.5](https://github.com/apauldev/Yotara/compare/v0.59.4...v0.59.5) (2026-06-17)


### Bug Fixes

* decouple settings login-tips toggle from session-only dismissal ([da93de4](https://github.com/apauldev/Yotara/commit/da93de46e73eed0fff7c64f2f698b7caabfdafc2))


### Chores

* add no-op test:coverage script to shared package ([f3c68ae](https://github.com/apauldev/Yotara/commit/f3c68aeb60ee1e1546f880e0859f75a952007b62))


### Refactoring

* migrate application preferences to signal-based store ([1c0f694](https://github.com/apauldev/Yotara/commit/1c0f694038ffb8affa54cb977e3719ae539c76d2))


### Tests

* fix regressions in PersonalShellComponent and PreferencesStore ([7243c8d](https://github.com/apauldev/Yotara/commit/7243c8d83fa4f6da1e582db64a30f4f3c94e283e))

## [0.59.4](https://github.com/apauldev/Yotara/compare/v0.59.3...v0.59.4) (2026-06-16)


### Bug Fixes

* drop explicit version from pnpm/action-setup ([fae438b](https://github.com/apauldev/Yotara/commit/fae438b28956eb4e298a8fbf057cfbee848ee741))
* pin pnpm version and fix prettier formatting ([af305ee](https://github.com/apauldev/Yotara/commit/af305ee82906dea2b73d9e58e35047c8e2c5f99e))


### Chores

* **deps-dev:** bump drizzle-kit from 0.31.9 to 0.31.10 ([818ec14](https://github.com/apauldev/Yotara/commit/818ec1460b77cc60b721ec2f7e0756378ac99c64))
* **deps-dev:** bump prettier from 3.8.1 to 3.8.4 ([124de94](https://github.com/apauldev/Yotara/commit/124de9434d36a4dd54dd79ef67ec30e4b21d2351))
* **deps-dev:** bump the commitlint group across 1 directory with 2 updates ([89c532b](https://github.com/apauldev/Yotara/commit/89c532b68efa9b1960e509769c524b4032c10ac5))
* **deps-dev:** bump the eslint group across 1 directory with 2 updates ([2639724](https://github.com/apauldev/Yotara/commit/26397249497b7b7ac203efcf84e7f08003c09989))
* **deps:** bump dompurify from 3.4.7 to 3.4.8 ([7edffa6](https://github.com/apauldev/Yotara/commit/7edffa64159b1c4ccb3216b4472a0a35a3259865))
* **deps:** bump tailwind-merge from 3.5.0 to 3.6.0 ([dd08189](https://github.com/apauldev/Yotara/commit/dd08189e56554f62d2e0a0f123e1b07753e5d401))
* regenerate lockfile after dependabot bumps ([825d829](https://github.com/apauldev/Yotara/commit/825d8296045142f9ff53c92c62b490a55cd43644))

## [0.59.3](https://github.com/apauldev/Yotara/compare/v0.59.2...v0.59.3) (2026-06-16)


### Bug Fixes

* use absolute URL for CLA link in PR template and contributing guide ([198a973](https://github.com/apauldev/Yotara/commit/198a973ee7fd87fb20219753c52cd569aed03dea))


### Chores

* add CLA with DCO and CLAassistant setup ([b8e02e3](https://github.com/apauldev/Yotara/commit/b8e02e390e3430a7c2101dcda8e85e5b4067abb4))
* add code coverage with c8 and Codecov ([1d8459b](https://github.com/apauldev/Yotara/commit/1d8459b227d8ac0dd72a37f9ed1b4fd98400e35e))

## [0.59.2](https://github.com/apauldev/Yotara/compare/v0.59.1...v0.59.2) (2026-06-15)


### Documentation

* fix README inaccuracies and add env file loading to dev runner ([0f50a0b](https://github.com/apauldev/Yotara/commit/0f50a0ba4ec6957df86ef2862bee31c6f4de227a))
* readme improved ([4cf70da](https://github.com/apauldev/Yotara/commit/4cf70da0f02b0b44ea301cd0651b794d168af31b))

## [0.59.1](https://github.com/apauldev/Yotara/compare/v0.59.0...v0.59.1) (2026-06-15)


### Bug Fixes

* make docker-compose.yml respect .env overrides via variable interpolation ([099b63d](https://github.com/apauldev/Yotara/commit/099b63dd117d546e5b2910edd4f73ecae16ebff9))
* remove root .env.example — no auto-load mechanism exists ([2b99c23](https://github.com/apauldev/Yotara/commit/2b99c233b0f4613b8d8736970e881081404558d4))


### Documentation

* fix CI recovery — re-run the workflow, not pnpm release ([22b7196](https://github.com/apauldev/Yotara/commit/22b71968404a708061cee16faf84d4f9c379499b))
* fix doc issues from review — broken links, wrong paths, incomplete lists ([6b18a6a](https://github.com/apauldev/Yotara/commit/6b18a6a6cdf98ab3673e95af542f15f2e72c19f2))
* fix documented task filters to match implementation ([c69ed20](https://github.com/apauldev/Yotara/commit/c69ed209376edf33ad2bd2c5ca158ef9b45598bf))
* remove email verification claim — not implemented ([4cf786b](https://github.com/apauldev/Yotara/commit/4cf786b0cb1345f3cebe60419f7b74e7e2d92f03))

## [0.59.0](https://github.com/apauldev/Yotara/compare/v0.58.4...v0.59.0) (2026-06-15)


### Features

* **frontend:** add post-login tip popup with 30 productivity tips ([40a3636](https://github.com/apauldev/Yotara/commit/40a3636065ed6ac463827f92f842837648cfc6fa))

## [0.58.4](https://github.com/apauldev/Yotara/compare/v0.58.3...v0.58.4) (2026-06-14)


### Bug Fixes

* **frontend:** preserve 250ms minimum loading-bar display interval ([2753145](https://github.com/apauldev/Yotara/commit/275314571caa78fd98e73811439e13425366fad2))
* **frontend:** replace 4 setTimeout UI hacks with signal-driven state ([4a29052](https://github.com/apauldev/Yotara/commit/4a2905275d9cb07f27794ae2f8ec6e3decc92cc1))


### Documentation

* add Sprint 1a (setTimeout removal) to roadmap ([994dcac](https://github.com/apauldev/Yotara/commit/994dcacd9ab39f6af9892d6d65e7568adcf28da0))

## [0.58.3](https://github.com/apauldev/Yotara/compare/v0.58.2...v0.58.3) (2026-06-09)


### Tests

* **frontend:** update specs to use PreferencesStore instead of direct localStorage ([1072907](https://github.com/apauldev/Yotara/commit/107290765d080b13e14204726d4f8e914092f9a7))

## [0.58.2](https://github.com/apauldev/Yotara/compare/v0.58.1...v0.58.2) (2026-06-09)


### Refactoring

* **frontend:** centralize localStorage access in PreferencesStore ([972d160](https://github.com/apauldev/Yotara/commit/972d1606e6ea20241964443ff19068de25767905))

## [0.58.1](https://github.com/apauldev/Yotara/compare/v0.58.0...v0.58.1) (2026-06-09)


### Bug Fixes

* **api:** replace as any cast on status query param with TaskStatus type ([86ba1c1](https://github.com/apauldev/Yotara/commit/86ba1c1f9ce52f2936ba32655c8759c41b2e3fc7))

## [0.58.0](https://github.com/apauldev/Yotara/compare/v0.57.2...v0.58.0) (2026-06-08)


### Features

* **api:** replace bare `throw new Error` with typed error hierarchy ([61ed6a7](https://github.com/apauldev/Yotara/commit/61ed6a7082a46c3242c0d8273b14b38fff1c29a4))


### Bug Fixes

* **api:** declare 400 response in PATCH /tasks/:id schema ([e27a996](https://github.com/apauldev/Yotara/commit/e27a9967192a2a4898a9503eec9365084c55a67a))
* **api:** narrow unknown error type in setErrorHandler for Fastify v5 ([3f8208e](https://github.com/apauldev/Yotara/commit/3f8208ecd0addd9b87ea4747ee8e72b69fc79f5e))


### Documentation

* **ARCHITECTURE:** mark Sprint 0 items complete in checklist ([3370480](https://github.com/apauldev/Yotara/commit/337048041b7e5fa560f34db80b0b0b150106b57e))

## [0.57.2](https://github.com/apauldev/Yotara/compare/v0.57.1...v0.57.2) (2026-06-08)


### Bug Fixes

* **frontend:** properly serialize Error objects in LogService ([c2a4f41](https://github.com/apauldev/Yotara/commit/c2a4f4157de4598875066672609d15fd988ff4b1))


### Documentation

* p2- no new information added in old doc ([8bd5ce6](https://github.com/apauldev/Yotara/commit/8bd5ce6c925f73fbeb8036e83a667254bbb42d70))
* updated docs for more single mode ([0c12a78](https://github.com/apauldev/Yotara/commit/0c12a78fc0dff78f627e99ef4b7c5f2fdcd896aa))


### Chores

* **frontend:** suppress console.error lint warning in main.ts ([75a5bc7](https://github.com/apauldev/Yotara/commit/75a5bc7c85dcfe3617c32b30a8f5e836988a6203))


### Refactoring

* **frontend:** migrate console.error sites to LogService ([d135406](https://github.com/apauldev/Yotara/commit/d13540610c0a5612e1f1250b5ddd2820a1ee1c7a))
* migrate console.error to LogService across frontend ([9a8b9cf](https://github.com/apauldev/Yotara/commit/9a8b9cfb6be5b16079389fbd3b9a5c49e01e4588))

## [0.57.1](https://github.com/apauldev/Yotara/compare/v0.57.0...v0.57.1) (2026-06-06)


### Bug Fixes

* **docker:** add architecture-agnostic fallback for native binary ([ae27834](https://github.com/apauldev/Yotara/commit/ae278340146098c40656c44797c906ad0acdf555))
* **docker:** replace hardcoded better-sqlite3 path with dynamic pnpm rebuild ([c76d457](https://github.com/apauldev/Yotara/commit/c76d4577f0d1582da11657c378aa48443d4f78c6))

## [0.57.0](https://github.com/apauldev/Yotara/compare/v0.56.0...v0.57.0) (2026-06-06)


### Features

* **docker:** optimize API image with multi-stage build, fix .dockerignore ([8a4c37f](https://github.com/apauldev/Yotara/commit/8a4c37ffd39ae0dee9ad0a3089aafb372499d77f))

## [0.56.0](https://github.com/apauldev/Yotara/compare/v0.55.1...v0.56.0) (2026-06-05)


### Features

* **security:** harden CI/CD pipeline with security scanning and release gating ([62c43a2](https://github.com/apauldev/Yotara/commit/62c43a27b21443c69ef171a3f92e7f3901213bdd))


### Bug Fixes

* check out main before release, use npm for dependabot ([992943c](https://github.com/apauldev/Yotara/commit/992943cfcc402a6ec6680ae3248ae533e46f2ca5))

## [0.55.1](https://github.com/apauldev/Yotara/compare/v0.55.0...v0.55.1) (2026-06-03)


### Documentation

* consolidate planning docs into ARCHITECTURE.md, add CI security tooling ([302f6e6](https://github.com/apauldev/Yotara/commit/302f6e640043beb3d45e31d72bdf0ce42d749dc9))
* fixed frontend and backend docs issue ([223849f](https://github.com/apauldev/Yotara/commit/223849fa26d0d8f39a37e1656c4d3689580ea22e))

## [0.55.0](https://github.com/apauldev/Yotara/compare/v0.54.1...v0.55.0) (2026-06-01)


### Features

* add paginated archive browsing, search, and backend task filters ([29aff6a](https://github.com/apauldev/Yotara/commit/29aff6a3b99947d6531b2fe09d69110a22ddd083))


### Bug Fixes

*  clamp archive page after totals shrink ([c29b4e1](https://github.com/apauldev/Yotara/commit/c29b4e154c303e1b38fdc8fc05152ebae00d65d6))
* paginate archive search across multiple pages ([d200eb0](https://github.com/apauldev/Yotara/commit/d200eb0a3b156f79f69eba4c67c74c255993e399))
* prettier issues were fixed ([34392ce](https://github.com/apauldev/Yotara/commit/34392ce0a995054c809609324a2c6adfa08ad223))

## [0.54.1](https://github.com/apauldev/Yotara/compare/v0.54.0...v0.54.1) (2026-05-29)


### Documentation

* docs are updated with new work ([d716903](https://github.com/apauldev/Yotara/commit/d71690316f2cb306f09d66578daea8fa844ecee4))
* update docs to take care of 2 p2's ([503baef](https://github.com/apauldev/Yotara/commit/503baef30f49779289e49a9ad130082ed6154e6a))
* updated roadmap with issues ([91ed32b](https://github.com/apauldev/Yotara/commit/91ed32b38b2714301aad0a390bf5a82e446c34a5))

## [0.54.0](https://github.com/apauldev/Yotara/compare/v0.53.0...v0.54.0) (2026-05-29)


### Features

* add "don't show again" option to complete task confirmation ([7224958](https://github.com/apauldev/Yotara/commit/7224958095635b87581d94dd12078502cdcda71c))
* **insights:** polish UI and add persistence with settings toggle ([a02d8f4](https://github.com/apauldev/Yotara/commit/a02d8f4e42fcf231ec06c5959580ca66398e64bf))


### Bug Fixes

* **ci:** resolve circular data logging error and improve test isolation ([9a6d9fe](https://github.com/apauldev/Yotara/commit/9a6d9fe88dc8acd0a75cc93a4a06259c17cd493d))
* restore page reset when task totals change ([b9bd18c](https://github.com/apauldev/Yotara/commit/b9bd18c3068d3e3af0f569493742099d1085eec9))
* smooth list animation, fix duplicate task creation ([d5c87b3](https://github.com/apauldev/Yotara/commit/d5c87b372deb1146241d0aaaa91c22b678f59d9e))


### Refactoring

* **task-list:** decompose page into components, fix error swallowing and pagination ([6829caf](https://github.com/apauldev/Yotara/commit/6829caf21883d8f27a522e542c88da9dde8665e6))

## [0.53.0](https://github.com/apauldev/Yotara/compare/v0.52.0...v0.53.0) (2026-05-28)


### Features

* add CSV data export for tasks, projects, and labels ([e471e92](https://github.com/apauldev/Yotara/commit/e471e92c010df1c5677ecc8380ed7155866969f7))
* **settings:** implement robust JSON and CSV data export ([bf495a6](https://github.com/apauldev/Yotara/commit/bf495a67584495b409e0e6d6e25cf5c233cabd87))


### Bug Fixes

* exclude archived tasks by archive state ([ad1d8b3](https://github.com/apauldev/Yotara/commit/ad1d8b3f27902b5ee3ca1fb2c5ca144cb63c5224))

## [0.52.0](https://github.com/apauldev/Yotara/compare/v0.51.4...v0.52.0) (2026-05-28)


### Features

* markdown support added wip ([2695172](https://github.com/apauldev/Yotara/commit/26951729e9ca97091cd520e134293bfa21b147bd))


### Bug Fixes

* add css tooltips, missing z-index, and toolbar spec coverage ([a4cf767](https://github.com/apauldev/Yotara/commit/a4cf7674a8faf6badc4b4f7febe2440f3c9c65b9))
* linting issues fixed ([7460cdd](https://github.com/apauldev/Yotara/commit/7460cdd8382981a8a6983fddc690aadeb4375faf))
* lockfile was out of date, because of new packages and no new pnpm install ([8ac96dd](https://github.com/apauldev/Yotara/commit/8ac96dda86733c80f0f28fbf349a374155bd68f5))
* made mobile stronger for the modal ([16a3ee4](https://github.com/apauldev/Yotara/commit/16a3ee4b1d2d1a2d054819353d06c6c351675952))

## [0.51.4](https://github.com/apauldev/Yotara/compare/v0.51.3...v0.51.4) (2026-05-27)


### Bug Fixes

* version compatibility fixed ([70a94a3](https://github.com/apauldev/Yotara/commit/70a94a3eea874a4d3813727822c63ef4dc508652))

## [0.51.3](https://github.com/apauldev/Yotara/compare/v0.51.2...v0.51.3) (2026-05-27)


### Bug Fixes

* p2 - provide workspace dependencies in archive specs ([62a2d3f](https://github.com/apauldev/Yotara/commit/62a2d3f9aa92de394818d3a1c59ba5f9644d9b0d))


### Chores

* migrate Archive page to shared EmptyStateComponent, close P0 ([660da3c](https://github.com/apauldev/Yotara/commit/660da3c7af76a17bcba4c8db153664c0be3995a9)), closes [#5](https://github.com/apauldev/Yotara/issues/5) [#6](https://github.com/apauldev/Yotara/issues/6)

## [0.51.2](https://github.com/apauldev/Yotara/compare/v0.51.1...v0.51.2) (2026-05-26)


### Documentation

* loading details are updated ([e17b058](https://github.com/apauldev/Yotara/commit/e17b058fe48643d8d40bce634b033f4849cb7ac9))

## [0.51.1](https://github.com/apauldev/Yotara/compare/v0.51.0...v0.51.1) (2026-05-26)


### Documentation

* updated roadmap and project plan ([bed1689](https://github.com/apauldev/Yotara/commit/bed1689af227f8a31f14f717f7d44f8a929d41bc))

## [0.51.0](https://github.com/apauldev/Yotara/compare/v0.50.1...v0.51.0) (2026-05-25)


### Features

* added search as a standalone component ([8f0da50](https://github.com/apauldev/Yotara/commit/8f0da500242b1aa7921c8ea742f9ac1be4587b0c))


### Bug Fixes

* build failed half way and brought up an edge case that was fixed ([7041dad](https://github.com/apauldev/Yotara/commit/7041dad574ccc61add60decd585c182ecfa55a48))
* p2 regression- view mode issues between inbox/today/upcoming ([c19bd08](https://github.com/apauldev/Yotara/commit/c19bd0848f6463d812f24d324acc28d26ce2c2e6))
* p2- dry run is fixed, no state mutations ([0f35321](https://github.com/apauldev/Yotara/commit/0f35321b4ddd75a0b5da9441af6d71c0ce5da747))


### Documentation

* added some more thoughts for harderning ([0e69ab7](https://github.com/apauldev/Yotara/commit/0e69ab7020bc43b191a058c8d31463479522d098))

## [0.50.1](https://github.com/apauldev/Yotara/compare/v0.50.0...v0.50.1) (2026-05-23)


### Documentation

* updated docs for ci cd ([99bd776](https://github.com/apauldev/Yotara/commit/99bd77637c640b6753d1d284a0ca07047936619a))

## [0.50.0](https://github.com/apauldev/Yotara/compare/v0.43.19...v0.50.0) (2026-05-23)


### Features

* new release script to make sure versioning is correct ([6087a1f](https://github.com/apauldev/Yotara/commit/6087a1f5c1ac51c0fa3c19f0bd87da5a17ef5d1e))


### Chores

* align version to 0.49.1 ([c712fdc](https://github.com/apauldev/Yotara/commit/c712fdccb580854373faf74d50e9d0ec2e984a25))

## [0.43.19](https://github.com/apauldev/Yotara/compare/v0.43.18...v0.43.19) (2026-05-23)


### Documentation

* this is not needed anymore ([868a36b](https://github.com/apauldev/Yotara/commit/868a36bf31c30454d29def70e8234e2d3a7c76b1))

## [0.43.18](https://github.com/apauldev/Yotara/compare/v0.43.17...v0.43.18) (2026-05-23)


### Features

* added recurring and subtasks, work in progress ([eec29b8](https://github.com/apauldev/Yotara/commit/eec29b8efcac9335b6a13dfa3aef6e277d80f75a))
* propagate labels and simpleMode to subtasks, show labels on card ([5575387](https://github.com/apauldev/Yotara/commit/557538760a45d2adb13a26a17c384cee428646bb))
* repeat refine with days, enddate, calendar, layout fixes ([c59e1b8](https://github.com/apauldev/Yotara/commit/c59e1b8c152c662b111271943521378d6a2af38a))


### Bug Fixes

* blocked subtask of subtask creation at service level ([f10e8c6](https://github.com/apauldev/Yotara/commit/f10e8c6ffa49ce103e903e89d33ecde6be8639cb))
* ci is fixed, github was trying to access a merge that didn't exist ([052b4d7](https://github.com/apauldev/Yotara/commit/052b4d76afe87e32c484c254ad889be91fb0a6e9))
* ci/ cd errors fixed ([e110786](https://github.com/apauldev/Yotara/commit/e1107863b2c26aff809c15e8185bd8e28bb0f780))
* cleaned dead code ([865c7e5](https://github.com/apauldev/Yotara/commit/865c7e584edfa46608016c061eb0d5132bfb858a))
* dates were not robust, fixed with luxon, tests updated, edge cases handled ([f5101f2](https://github.com/apauldev/Yotara/commit/f5101f24361dfc75ad540084d7347b27999ec9be))
* p1 - write null to clear parent/recurrence fields on update ([c6eca5b](https://github.com/apauldev/Yotara/commit/c6eca5bc43d84d230d166efaa631f11ec204e9d0))
* projectid null assigns default project ([6ebf507](https://github.com/apauldev/Yotara/commit/6ebf5075bdd3f3dd19f7ccdf74de3cb918d07dd1))
* recurrance materialization fixed ([82eab4f](https://github.com/apauldev/Yotara/commit/82eab4f8fd1465fc476d372149f3466d3f81dcc8))


### Documentation

* updated tasks docs ([ab7ea63](https://github.com/apauldev/Yotara/commit/ab7ea633dcdd6362a07ced1a81209bfe0c862d3f))

## [0.43.17](https://github.com/apauldev/Yotara/compare/v0.43.16...v0.43.17) (2026-05-23)


### Documentation

* docs are updated to the current status of the repo ([e44cd3b](https://github.com/apauldev/Yotara/commit/e44cd3b475f5e580a233d2b5e49c71a7775115f1))

## [0.43.16](https://github.com/apauldev/Yotara/compare/v0.43.15...v0.43.16) (2026-05-21)


### Features

* (versioning) enforce git metadata integrity in CI with environment fallbacks ([31e9bbb](https://github.com/apauldev/Yotara/commit/31e9bbb10e448b2689f4d02a33ddf4979ae1e712))
* **versioning:** implement robust automated release system and commit enforcement ([4cb742a](https://github.com/apauldev/Yotara/commit/4cb742a174b308ddf3501b66f3ce4dd9849dde6a))

## [0.43.15](https://github.com/apauldev/Yotara/compare/v0.43.14...v0.43.15) (2026-05-21)


### Features

* (frontend) implement generic EmptyStateComponent ([2ede374](https://github.com/apauldev/Yotara/commit/2ede3743c66335f175eb45154005ea3d0f30e599))

## [0.43.14](https://github.com/apauldev/Yotara/compare/v0.43.13...v0.43.14) (2026-05-21)


### Refactoring

* add back navigation support to PageHeaderComponent ([2527657](https://github.com/apauldev/Yotara/commit/2527657900d05e17ea67ce667f998545d1d22b1c))

## [0.43.13](https://github.com/apauldev/Yotara/compare/v0.43.12...v0.43.13) (2026-05-21)


### Miscellaneous

* Updated planning for CI/CD ([4cbeb46](https://github.com/apauldev/Yotara/commit/4cbeb46819a26a289969c52c48b0f6cb8d12af7f))

## [0.43.12](https://github.com/apauldev/Yotara/compare/v0.43.11...v0.43.12) (2026-05-20)


### Features

* CI- optimize workflows and fix docker entrypoints ([038b446](https://github.com/apauldev/Yotara/commit/038b4462288f110fce6ba6a77f5dfea5509e8cd2))


### Bug Fixes

* Fixed 2 p1 codex pointed ([4af3619](https://github.com/apauldev/Yotara/commit/4af3619fd7125cac2976240403d31f139795bfd1))
* Fixed API Entry Point, Absolute CMD Path,  Better Diagnostics ([1250481](https://github.com/apauldev/Yotara/commit/1250481068a4f457ad3a72516c2059758236c704))
* Fixed dockerfiles, made CI workflow better ([bde8d07](https://github.com/apauldev/Yotara/commit/bde8d07cd59f98f7e3a59b2f4b677de6cb75aec1))
* Ignored Scripts on Install, Copied Build Scripts ([a66d99a](https://github.com/apauldev/Yotara/commit/a66d99a03900f19f2d2392dcc5fa95a4ebdd1d06))
* Migrated pnpm confid, updated dockerfiles, better rebuild ([2a2dc5e](https://github.com/apauldev/Yotara/commit/2a2dc5ee03da766b23f09b88c3695dc4b662dff5))
* Updated both Dockerfiles to install python3, make, and g++, Added RUN pnpm rebuild better-sqlite3, Monorepo Consistency ([e644705](https://github.com/apauldev/Yotara/commit/e644705118da6d0dafe3824d34d5868ff2ee7614))
* version file was not getting generated. Fixing it. ([ef7596e](https://github.com/apauldev/Yotara/commit/ef7596e1f960a9c350c05b84985f062ed6dc2d70))

## [0.43.11](https://github.com/apauldev/Yotara/compare/v0.43.10...v0.43.11) (2026-05-20)


### Miscellaneous

* Adding more thoughts before teammode starts ([4470c75](https://github.com/apauldev/Yotara/commit/4470c7573dce8ca6d60afd176a86172764a51daa))

## [0.43.10](https://github.com/apauldev/Yotara/compare/v0.43.9...v0.43.10) (2026-05-20)


### Features

* **api:** standardize app-owned SQLite timestamps as ISO strings ([29ac45f](https://github.com/apauldev/Yotara/commit/29ac45fefd304b1c1373e69435e833a013e9ee27))


### Bug Fixes

* P2 Skip no-op timestamp rewrites during DB bootstrap ([ac357ff](https://github.com/apauldev/Yotara/commit/ac357ff6baa426926d772182241627a09ec9e270))

## 0.43.9 (2026-05-18)


### Features

* add archive nav and consistent task completion checkbox UI ([0dbf602](https://github.com/apauldev/Yotara/commit/0dbf602045be436f87a50300af6b1797e9de1c22))
* add backend projects domain persistence with API endpoints, database schema, and comprehensive tests ([110a4ee](https://github.com/apauldev/Yotara/commit/110a4eeda9d7fcb0b8e320ebbe03c54fe2836907))
* **frontend:** add account logout dropdown with confirmation modal ([2ae6e30](https://github.com/apauldev/Yotara/commit/2ae6e3007acf3d81830136dec1dea149e7f250c3))
* **frontend:** add post-login left nav shell ([d87ff84](https://github.com/apauldev/Yotara/commit/d87ff84f7f6d7fc167002a0cc1e65967fc32bab5))
* **frontend:** implement complete project management system ([79ff595](https://github.com/apauldev/Yotara/commit/79ff595f366488768490112ec6470f7c6ed99dce))
* **frontend:** install and configure spartan-ng UI framework ([ab5afce](https://github.com/apauldev/Yotara/commit/ab5afcebdaf0a08b557a6f40f7392cc41ca52875))
* **frontend:** standardize and reskin page headers across the sanctuary ([4b2e417](https://github.com/apauldev/Yotara/commit/4b2e417af510b90365c38353be25d2ead825f59d))
* implement global status, error, and persistent logging system ([1c556cd](https://github.com/apauldev/Yotara/commit/1c556cd183a6a297bc94cb37e7af34f7a8360154))
* integrate Better Auth with Fastify/Angular and Drizzle SQLite ([f1c1fd7](https://github.com/apauldev/Yotara/commit/f1c1fd75a0d4e8bbe17f6cca4aa321c3c1fee38e))
* **personal:** add personal mode shell and task metadata flow ([e8e0fd8](https://github.com/apauldev/Yotara/commit/e8e0fd89f59f34dd6a03976cda993b715d94d1f8))
* the task flow for mobile is now much more robust ([8cab8c2](https://github.com/apauldev/Yotara/commit/8cab8c27b1f43d48d24cb8feeda5f037436e1320))


### Bug Fixes

* added fixes for codex flagged issues in code ([6705174](https://github.com/apauldev/Yotara/commit/67051743ca7f0eb45571196bd63c92b9a55011ee))
* codex recommendation + same menu tap closing ([9c266e2](https://github.com/apauldev/Yotara/commit/9c266e23b25c40c0bc3d5c0b7db43c0f076342a2))
* dropdown menu issue in personal shell ([d203c78](https://github.com/apauldev/Yotara/commit/d203c78b27d6a8a64cb091f94241f685e73e295c))
* Fixing github actions version update ([833c477](https://github.com/apauldev/Yotara/commit/833c4772140b578c194bf6d79cb4b3db8e9d3d2e))
* **frontend:** improve mobile nav and task auth handling ([7aa2843](https://github.com/apauldev/Yotara/commit/7aa2843c01a9a72dc862a68eec3b3708e986f469))
* Mobile fix for sidebar menu ([30c770b](https://github.com/apauldev/Yotara/commit/30c770bd42c4bcfb97cf2d489e65529c16c4b992))
* modals were broken for mobile, fixing ([582cd9b](https://github.com/apauldev/Yotara/commit/582cd9be7889828e12a59a4e346d087d8c160a26))
* **projects:** surface edit errors and stabilize project task order ([db88a7b](https://github.com/apauldev/Yotara/commit/db88a7ba7101bc24f6502b715c4e05a9565af938))


### Documentation

* add API documentation examples for task endpoints ([26729c9](https://github.com/apauldev/Yotara/commit/26729c9ae49c5e2b9d0ae878c38eff7cb255b8ec))
* add Phase 6 deployment & distribution roadmap ([00da7d4](https://github.com/apauldev/Yotara/commit/00da7d4e7f4cf796cdd44651b90b2033ef82c648))
* enhance README with comprehensive setup and development guides ([cb30a8c](https://github.com/apauldev/Yotara/commit/cb30a8c8d42530d3703406d069169e4c4e68e05c))
* move task API examples to project guide ([3e112ec](https://github.com/apauldev/Yotara/commit/3e112ecce9635d082368dd713831cefc80cca9d3))
* refresh repository readme ([decf334](https://github.com/apauldev/Yotara/commit/decf334721c3253cb04d8d9d497c3073641270a4))
* remove duplicate task api examples ([622d54a](https://github.com/apauldev/Yotara/commit/622d54a4e33ec0461af065619801c4fc40e9625c))


### Chores

* add all-contributors setup ([952715a](https://github.com/apauldev/Yotara/commit/952715a254f1e679f844377e84d357b4c26aad6c))
* add automated versioning tool ([d8b796b](https://github.com/apauldev/Yotara/commit/d8b796b897ea7e7ff9abff1d8b55374c189f81be))
* add code quality tooling and verify coverage ([15aeb11](https://github.com/apauldev/Yotara/commit/15aeb11d90dc4299ae8bc7ecf065b507d8093d61))
* add stylelint setup ([cd9fe2b](https://github.com/apauldev/Yotara/commit/cd9fe2b4167e75f97001043db4842acc921ba74f))
* add vscode workspace setup ([e0969c8](https://github.com/apauldev/Yotara/commit/e0969c810d838eb20951f9bb4f0436833bd0b250))
* automate frontend version generation and ignore artifacts ([8b53d0b](https://github.com/apauldev/Yotara/commit/8b53d0b931d6f70681c5ca44dff932cb25d9e92d))
* bump version to 0.43.8 to resolve CI collision ([5c47a86](https://github.com/apauldev/Yotara/commit/5c47a86a1fca5209af99c9926d13170b75ff9009))
* optimize github actions with parallelism and professional release notes ([2ec4dc0](https://github.com/apauldev/Yotara/commit/2ec4dc0ceba64073d622fe165433cf59eacbc79f))
* **release:** 0.43.0 ([f484f80](https://github.com/apauldev/Yotara/commit/f484f801df1093df73e5adb4e485a0ee5b3cbf1e))
* **release:** 0.43.1 ([79fff69](https://github.com/apauldev/Yotara/commit/79fff69b4ea5f1acf69867f39c613cedf1214673))
* **release:** 0.43.2 ([662e302](https://github.com/apauldev/Yotara/commit/662e302605b6b236c42b5e71f8b06580ad4dd201))
* **release:** 0.43.2 ([d3f6d60](https://github.com/apauldev/Yotara/commit/d3f6d60e590c1c92e8ad845172eb9a70b2dc3a57))
* **release:** 0.43.3 ([95f9f2a](https://github.com/apauldev/Yotara/commit/95f9f2a8c2813f34d994a049ab4dfa95f20cedc3))
* **release:** 0.43.4 ([8fb6183](https://github.com/apauldev/Yotara/commit/8fb6183d652b5b34d49af490376d7ea3373d3660))
* **release:** 0.43.5 ([e11354f](https://github.com/apauldev/Yotara/commit/e11354f1e55ae9326f6f90155c3ec6a14e622620))
* **release:** 0.43.6 ([6673733](https://github.com/apauldev/Yotara/commit/6673733ea0142019f106ed359cd3c5f6e934d403))
* **release:** 0.43.7 ([98077c0](https://github.com/apauldev/Yotara/commit/98077c0b71d44d724b5bbbd9771244fb1a1fabbd))
* resolve merge conflicts in changelog and package.json ([3b7198b](https://github.com/apauldev/Yotara/commit/3b7198b1617ef9127d9cd5e586d7430fb935042a))
* sync version metadata for parallelized CI ([a3b4953](https://github.com/apauldev/Yotara/commit/a3b495323663373dc4a3386c9b023695b2be0d39))
* sync version metadata for v0.43.3 ([425ee00](https://github.com/apauldev/Yotara/commit/425ee000e1049b8877c839def1bc3d9dc2f2bc00))


### Miscellaneous

* Added some planning docs ([79eed15](https://github.com/apauldev/Yotara/commit/79eed15d238ae04ef12366b9f30f9fd590a672c1))


### Performance

* truly parallelize CI by removing redundant install job barrier ([b63cccb](https://github.com/apauldev/Yotara/commit/b63cccb9ab0a2872ebe648015f0bc55ad91af48e))

## [0.43.7](https://github.com/apauldev/Yotara/compare/v0.43.6...v0.43.7) (2026-05-18)


### Chores

* automate frontend version generation and ignore artifacts ([1cdd49d](https://github.com/apauldev/Yotara/commit/1cdd49d98f3b0c6c6aca270acd357b013b725736))

## [0.43.6](https://github.com/apauldev/Yotara/compare/v0.43.5...v0.43.6) (2026-05-18)


### Miscellaneous

* Added some planning docs ([2a33c45](https://github.com/apauldev/Yotara/commit/2a33c45a1b7b5169b2dda3983c5326e872fc2bf4))

## [0.43.5](https://github.com/apauldev/Yotara/compare/v0.43.2...v0.43.5) (2026-05-17)


### Chores

* optimize github actions with parallelism and professional release notes ([45f0370](https://github.com/apauldev/Yotara/commit/45f0370e3bd8f4b22a2c2b5cd553f329f14e731f))
* **release:** 0.43.2 ([7a17d46](https://github.com/apauldev/Yotara/commit/7a17d464c87cc97fd1734c9bc0c6d29c6d4b2f01))
* **release:** 0.43.3 ([c6f8a0f](https://github.com/apauldev/Yotara/commit/c6f8a0f52932d4cf25ffa3f4fb9dc351b8d2504e))
* **release:** 0.43.4 ([d61de51](https://github.com/apauldev/Yotara/commit/d61de519ee461948e8d3b4b88300c55397ac9a2c))
* resolve merge conflicts in changelog and package.json ([549f7eb](https://github.com/apauldev/Yotara/commit/549f7eb7fa6da515b40704700bcd46e382131234))
* sync version metadata for parallelized CI ([dcdfc52](https://github.com/apauldev/Yotara/commit/dcdfc52d2c5b044e189aa6657f2f05785e472b83))
* sync version metadata for v0.43.3 ([72484cd](https://github.com/apauldev/Yotara/commit/72484cd04ffaa1a7143ab7c16009b2b74adb9162))


### Performance

* truly parallelize CI by removing redundant install job barrier ([d379692](https://github.com/apauldev/Yotara/commit/d3796922ee264ec702158ca894f6fe355764d769))

## [0.43.4](https://github.com/apauldev/Yotra/compare/v0.43.3...v0.43.4) (2026-05-17)


### Chores

* resolve merge conflicts in changelog and package.json ([549f7eb](https://github.com/apauldev/Yotra/commit/549f7eb7fa6da515b40704700bcd46e382131234))
* sync version metadata for v0.43.3 ([72484cd](https://github.com/apauldev/Yotra/commit/72484cd04ffaa1a7143ab7c16009b2b74adb9162))


### Performance

* truly parallelize CI by removing redundant install job barrier ([d379692](https://github.com/apauldev/Yotra/commit/d3796922ee264ec702158ca894f6fe355764d769))

## [0.43.2](https://github.com/apauldev/Yotra/compare/v0.43.1...v0.43.2) (2026-05-17)


### Chores

* **release:** 0.43.2 ([9ac1da8](https://github.com/apauldev/Yotra/commit/9ac1da88fd907329e14f8beec3e6afe8186dde2d))

## [0.43.3](https://github.com/apauldev/Yotra/compare/v0.43.1...v0.43.3) (2026-05-17)

### Bug Fixes

* Fixing github actions version update ([7ffdbc2](https://github.com/apauldev/Yotra/commit/7ffdbc2f657cffd68728fcde29303301f8fb73ed))

### Chores

* optimize github actions with parallelism and professional release notes ([45f0370](https://github.com/apauldev/Yotra/commit/45f0370e3bd8f4b22a2c2b5cd553f329f14e731f))

## 0.43.2 (2026-05-17)

### Features

* add archive nav and consistent task completion checkbox UI ([cceb75e](https://github.com/apauldev/Yotara/commit/cceb75eb012360669c1d2600fb2f49d886ee793c))
* add backend projects domain persistence with API endpoints, database schema, and comprehensive tests ([cd87f6a](https://github.com/apauldev/Yotara/commit/cd87f6a7325589a6dc8d72e0814f20f5399b9866))
* **frontend:** add account logout dropdown with confirmation modal ([76d2101](https://github.com/apauldev/Yotara/commit/76d21017b477c53c0130ed8acec7f3b42f662af7))
* **frontend:** add post-login left nav shell ([c186a30](https://github.com/apauldev/Yotara/commit/c186a30cd9597b6ae00676057742164029d9f3ab))
* **frontend:** implement complete project management system ([66127c0](https://github.com/apauldev/Yotara/commit/66127c0977a86ccf206d332abc942d619dce847c))
* **frontend:** install and configure spartan-ng UI framework ([5b05866](https://github.com/apauldev/Yotara/commit/5b05866c773592ad21171425fa68e95181e02a11))
* **frontend:** standardize and reskin page headers across the sanctuary ([4415366](https://github.com/apauldev/Yotara/commit/4415366cfd83b9ccfe78a6c27c8553d837005265))
* implement global status, error, and persistent logging system ([6dc2363](https://github.com/apauldev/Yotara/commit/6dc236324db1d7bb2a310cfcd31243e4dc941752))
* integrate Better Auth with Fastify/Angular and Drizzle SQLite ([4a94bc6](https://github.com/apauldev/Yotara/commit/4a94bc68eeba6d5e37b06f24d43f56c8a088c347))
* **personal:** add personal mode shell and task metadata flow ([b93e659](https://github.com/apauldev/Yotara/commit/b93e65908bb4865d4465d34505fe39b14d42aa0c))

### Bug Fixes

* dropdown menu issue in personal shell ([de412ef](https://github.com/apauldev/Yotara/commit/de412ef80b6043311c54dc78298f99b9d8e5ca81))
* **frontend:** improve mobile nav and task auth handling ([3ff78c0](https://github.com/apauldev/Yotara/commit/3ff78c049fb46cfbc2bf0f99814ee6230f50c327))
* **projects:** surface edit errors and stabilize project task order ([b307c50](https://github.com/apauldev/Yotara/commit/b307c50ce20e18216422c782130d7cd0a7d72774))

### Documentation

* add API documentation examples for task endpoints ([cd63a7e](https://github.com/apauldev/Yotara/commit/cd63a7e5d63b55b124104ff19b0f17059c24745a))
* add Phase 6 deployment & distribution roadmap ([21d2d96](https://github.com/apauldev/Yotara/commit/21d2d964ff25a05c76c072640631b5a874f53fd1))
* enhance README with comprehensive setup and development guides ([8411f3e](https://github.com/apauldev/Yotara/commit/8411f3e04e167dd82bf919de2a73797178991c22))
* move task API examples to project guide ([74f37e2](https://github.com/apauldev/Yotara/commit/74f37e2d768d9d4ad7c298b91dc11b28753dacd9))
* refresh repository readme ([252cb37](https://github.com/apauldev/Yotara/commit/252cb37a1d8aab302e0ceca0055bf89d0b82066c))
* remove duplicate task api examples ([4963eb2](https://github.com/apauldev/Yotara/commit/4963eb2cfbfd391f6b3984f4caedc163a8da48bd))

### Chores

* add all-contributors setup ([cf79532](https://github.com/apauldev/Yotara/commit/cf79532c60087ecea45f354492c7892f8ba7b7e5))
* add automated versioning tool ([07c6893](https://github.com/apauldev/Yotara/commit/07c68932fe4f741c64635c029076673e129c3bdb))
* add code quality tooling and verify coverage ([9464de9](https://github.com/apauldev/Yotara/commit/9464de98ababda1cc8992fd98872deb18611f5ad))
* add stylelint setup ([08195c0](https://github.com/apauldev/Yotara/commit/08195c0fdfd1524fcce17d24e78421d8d5b16e6b))
* add vscode workspace setup ([3e7de4c](https://github.com/apauldev/Yotara/commit/3e7de4cb566fcc5fc7b7ba94d0cf18794805a83e))
* **release:** 0.43.0 ([037fd12](https://github.com/apauldev/Yotara/commit/037fd123a5c8f2af3a59ae39a9bb14b6b4f89419))
* **release:** 0.43.1 ([c115688](https://github.com/apauldev/Yotara/commit/c115688185a0410fc9aca956e3bbe9f91e39aca8))

## 0.43.1 (2026-05-17)

## 0.43.0 (2026-05-16)
