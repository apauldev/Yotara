# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.75.1](https://github.com/apauldev/Yotara/compare/v0.75.0...v0.75.1) (2026-08-27)


### Bug Fixes

* address post-merge review findings ([e01f50c](https://github.com/apauldev/Yotara/commit/e01f50caf82e7609848a3af22cc6a6318d20ee31))

## [0.75.0](https://github.com/apauldev/Yotara/compare/v0.74.11...v0.75.0) (2026-08-27)


### Features

* **ui:** add boot skeleton and origin gzip/cache headers ([54a0f0a](https://github.com/apauldev/Yotara/commit/54a0f0a19c6e04481f57306ab4b81b08c5f1b062))


### Bug Fixes

* **security:** add missing security headers to nginx asset locations ([8cc1f9b](https://github.com/apauldev/Yotara/commit/8cc1f9b3212b255af7e339f9f19554efca5d5d14))
* **ui:** harden boot skeleton vars and test isolation ([6659be7](https://github.com/apauldev/Yotara/commit/6659be7245ac1cc4b026d8572d3dfda2ed27fe56))
* **ui:** place boot skeleton outside app-root and fix duplicate lifecycle call ([cdc9b42](https://github.com/apauldev/Yotara/commit/cdc9b4268d109a59760acff5d9a8f743ee480db5))


### Tests

* **frontend:** cover boot skeleton removal paths ([d61d99e](https://github.com/apauldev/Yotara/commit/d61d99e38ae9e4f795f53199381a09041de5725e))
* **frontend:** use proper Router event Subject for skeleton test ([45634bc](https://github.com/apauldev/Yotara/commit/45634bc26da3fc24457d6bfab529a4ee4271159e))

## [0.74.11](https://github.com/apauldev/Yotara/compare/v0.74.10...v0.74.11) (2026-08-27)


### Chores

* **security:** make pre-commit gitleaks guard explicit ([c8f6184](https://github.com/apauldev/Yotara/commit/c8f6184e0041f4a660e6c16173ea651443451923))

## [0.74.10](https://github.com/apauldev/Yotara/compare/v0.74.9...v0.74.10) (2026-08-27)


### Bug Fixes

* **ci:** address review - use startsWith and fix regex escaping ([583ab41](https://github.com/apauldev/Yotara/commit/583ab418f7685caa29f67c87d189753950b8ea68))
* **ci:** make workflow skip precise with colon to avoid over-matching ([47336d3](https://github.com/apauldev/Yotara/commit/47336d3cec7b8b156fe083cc740edea0c0a7b43d))
* **ci:** prevent chore(deploy) pins from triggering releases ([e7180ec](https://github.com/apauldev/Yotara/commit/e7180ec7e85b74cc0c1d87f38d0d97b06c4d346e))

## [0.74.9](https://github.com/apauldev/Yotara/compare/v0.74.8...v0.74.9) (2026-08-26)


### Chores

* **deploy:** persist TLS mounts in Hub Compose ([88889aa](https://github.com/apauldev/Yotara/commit/88889aa883e6b304eca8a5c1758132a18479fba9))

## [0.74.8](https://github.com/apauldev/Yotara/compare/v0.74.7...v0.74.8) (2026-08-26)


### Chores

* **deploy:** pin Hub Compose to v0.74.7 ([ba3a95e](https://github.com/apauldev/Yotara/commit/ba3a95e5dbf0c62e91704fc12c5aa6e81a619735)), closes [#356](https://github.com/apauldev/Yotara/issues/356)

## [0.74.7](https://github.com/apauldev/Yotara/compare/v0.74.6...v0.74.7) (2026-08-26)


### Bug Fixes

* **frontend:** disable inline critical CSS inlining ([0d39597](https://github.com/apauldev/Yotara/commit/0d3959796a530dc5b9d23a0fe9fb258a68188a36))
* **frontend:** disable styles optimization to remove inline critical CSS ([f53e95e](https://github.com/apauldev/Yotara/commit/f53e95e78e07b48594ad45a034389207720d055b))

## [0.74.6](https://github.com/apauldev/Yotara/compare/v0.74.5...v0.74.6) (2026-08-26)


### Bug Fixes

* **frontend:** disable inlineCritical to fix CSP violations ([39fa494](https://github.com/apauldev/Yotara/commit/39fa4941575d68b85d94a523aa14d0f6f45da116))

## [0.74.5](https://github.com/apauldev/Yotara/compare/v0.74.4...v0.74.5) (2026-08-26)


### Chores

* **deploy:** pin Hub Compose to v0.74.4 ([4b9b5db](https://github.com/apauldev/Yotara/commit/4b9b5dbfb784182f8b42fa6a3c7a2bf73fac5247))

## [0.74.4](https://github.com/apauldev/Yotara/compare/v0.74.3...v0.74.4) (2026-08-26)


### Bug Fixes

* **security:** add cloudflareinsights.com to connect-src ([f02e1b4](https://github.com/apauldev/Yotara/commit/f02e1b4424ccfe927bc0b7fc5051b3a2e412f3bf))
* **security:** allow fonts and CF beacon in CSP ([1f148c5](https://github.com/apauldev/Yotara/commit/1f148c508c0043de0472ce239b2147bbecffee88))

## [0.74.3](https://github.com/apauldev/Yotara/compare/v0.74.2...v0.74.3) (2026-08-25)


### Chores

* **deploy:** pin Hub Compose to v0.74.2 ([0692420](https://github.com/apauldev/Yotara/commit/06924203494b5bedc4941904ff4201d7907aa63f))

## [0.74.2](https://github.com/apauldev/Yotara/compare/v0.74.1...v0.74.2) (2026-08-25)


### Bug Fixes

* **auth:** resolve Invalid base URL /api/auth for prod ([d855871](https://github.com/apauldev/Yotara/commit/d855871af33a3fcde8d8b857f3a0b92fcb6e9ccd))

## [0.74.1](https://github.com/apauldev/Yotara/compare/v0.74.0...v0.74.1) (2026-08-25)


### Chores

* **deploy:** pin Hub Compose to v0.74.0 ([c0ee5d2](https://github.com/apauldev/Yotara/commit/c0ee5d2c81344ecb1cfd64f60b763b303d43aae5))

## [0.74.0](https://github.com/apauldev/Yotara/compare/v0.73.0...v0.74.0) (2026-08-25)


### Features

* **backup:** add WAL-safe EC2 backup and restore test ([6d2b7aa](https://github.com/apauldev/Yotara/commit/6d2b7aaf14647ebf9cab9fe85698b4453a276ffa))


### Bug Fixes

* **api:** reject self-parenting on task update ([76dd9ea](https://github.com/apauldev/Yotara/commit/76dd9ea33d4f5b8ae92d3fbd353464c129ea2b7b))
* **backup:** fail restore-test when health check fails ([c1b6d13](https://github.com/apauldev/Yotara/commit/c1b6d13fcdff82558f20e260ac9401dfdd0f55c5))
* **backup:** pin alpine, fallback compose file, support v2 ([1fd7bcb](https://github.com/apauldev/Yotara/commit/1fd7bcbb3e270982d0fdbf2869b6056ecbacd6bc))
* **backup:** upload encrypted artifact and fix retention SIGPIPE ([f98322f](https://github.com/apauldev/Yotara/commit/f98322fc4ca073dfce1232d315a8ce2802f15722))


### Chores

* **deploy:** pin Hub Compose to immutable tag v0.73.0 ([bb48f28](https://github.com/apauldev/Yotara/commit/bb48f2883bd63612768929b6d7e5a052b5bed073))

## [0.73.0](https://github.com/apauldev/Yotara/compare/v0.72.3...v0.73.0) (2026-08-19)


### Features

* **api:** expose requireEmailVerification runtime flag ([b036849](https://github.com/apauldev/Yotara/commit/b036849a56a2451cccfdcfb10c3eb90f38ed8935))
* **api:** gate email verification by env and harden email sending ([8604d7e](https://github.com/apauldev/Yotara/commit/8604d7ee350c724a7f04b258063704b18113b6d9))
* **api:** honeypot IP ban and unverified-sign-in handling ([ce0eb89](https://github.com/apauldev/Yotara/commit/ce0eb89e93530a4089fb8f4e36b58f95e83832cc))
* **api:** verify-resend rate limit and unverified-account cleanup ([740bf73](https://github.com/apauldev/Yotara/commit/740bf736709e2bc3752dfbc994d9954411426f2c))
* **auth:** beta-release hardening — dev mode, email verification, auth secrets ([e0696a2](https://github.com/apauldev/Yotara/commit/e0696a25cf9ceeaeea36c6af27ee0a8900a565b8))
* **auth:** email-first signup, verify landing, and set-password endpoint ([055be45](https://github.com/apauldev/Yotara/commit/055be45f5a76450f81e04f0b2f0f6338819b32e6))
* **frontend:** show email with a Verified badge in settings ([cebe7ec](https://github.com/apauldev/Yotara/commit/cebe7ec87abe2501b951f793d1e55b7bf8875733))


### Bug Fixes

* add missing BETTER_AUTH_SECRET env to docker logs and teardown steps ([8d97ffd](https://github.com/apauldev/Yotara/commit/8d97ffd7c30d9c39c0e350d3c2881ae58ce6e18e))
* allowlist CI smoke-test BETTER_AUTH_SECRET in gitleaks config ([f3abd89](https://github.com/apauldev/Yotara/commit/f3abd89e297c136ac0bd4951a6deba63715a6532))
* **api:** remove orphaned rows when cleaning up unverified accounts ([4052666](https://github.com/apauldev/Yotara/commit/40526663d0394f9ce066d6171a008d1467fa9772))
* **auth:** enforce password complexity during setup ([51f6584](https://github.com/apauldev/Yotara/commit/51f6584639d8e6883f1b0854dd8d071255123a29))
* **auth:** expose password setup state to clients ([9138d33](https://github.com/apauldev/Yotara/commit/9138d336a67fd74977bb079f65cde06758abd83c))
* **auth:** harden email signup placeholder passwords ([6eb9142](https://github.com/apauldev/Yotara/commit/6eb914270eeacdc29284e7326d08f004e8bd0bec))
* **auth:** honor passwordSetupRequired in verify flow ([ccef0cf](https://github.com/apauldev/Yotara/commit/ccef0cfbb6aaeae454fc17e7f2ba7d0884f5a070))
* **auth:** prevent sign-in account enumeration ([952770c](https://github.com/apauldev/Yotara/commit/952770cdf19c2783e48a51e226ed9e0c4e72c65b))
* **auth:** restrict initial password setup ([caa2fee](https://github.com/apauldev/Yotara/commit/caa2fee6649e99fad88dc12e7b313b381f95b98f))
* **auth:** route password-reset links to the frontend ([53aedb0](https://github.com/apauldev/Yotara/commit/53aedb0286c619eaa9f2c4d150cf921a61751db3))
* **auth:** route verification links to frontend ([087adb4](https://github.com/apauldev/Yotara/commit/087adb46137136e4ac0e5c386202b25c16b54680))
* **auth:** scope cleanup to email-first pending accounts only ([cd46a40](https://github.com/apauldev/Yotara/commit/cd46a403e9c47991a19a9f72cf927f1ada96a91b))
* **auth:** throttle verification email resends ([9f12faf](https://github.com/apauldev/Yotara/commit/9f12faf889552d7b2a54f5e630e630fcb0909e7c))
* **ci:** add openrouter/ prefix to PR Agent model names ([ad72456](https://github.com/apauldev/Yotara/commit/ad724563208537ecef43d2449d45330c69f77c17))
* **ci:** configure custom PR Agent model token limit ([a239fc4](https://github.com/apauldev/Yotara/commit/a239fc463cde25f52f9e7202a26072c14c5b7457))
* **ci:** correct OpenRouter env var to lowercase openrouter__key ([a231e76](https://github.com/apauldev/Yotara/commit/a231e76b807bab4438465b3b333ed6bee9a589a1))
* **ci:** update pr-agent model configuration ([145522a](https://github.com/apauldev/Yotara/commit/145522ac580320fef33177050af46693ff6c63ae))
* **ci:** use openrouter__key for OpenRouter authentication ([5ff7503](https://github.com/apauldev/Yotara/commit/5ff750349b2cd30206fa9e0e8823c30e93876537))
* **ci:** use uppercase OPENROUTER__KEY for GitHub Actions ([ff5f19c](https://github.com/apauldev/Yotara/commit/ff5f19cb6d5bb2e36be4020cf0a191bf6847429a))
* correct gitleaks allowlist regex to match secret value directly ([94518ea](https://github.com/apauldev/Yotara/commit/94518eae002e1f243a556196991f0edb09125604))
* **frontend:** show signup error instead of check-email on failure ([935832b](https://github.com/apauldev/Yotara/commit/935832b81c386f25e8ac676fbd49aa9f1c1d77bc))
* normalize all 403 sign-in responses to generic 401 ([54923f1](https://github.com/apauldev/Yotara/commit/54923f1b53973f1ff5d22ec9acec8c11dd65189d))
* resolve CodeQL alerts — unused imports/vars and shell command injection ([194d0a1](https://github.com/apauldev/Yotara/commit/194d0a1495d9720831c1bba4805085f35c4dda30))
* **security:** restrict trusted proxy IP handling ([27a881a](https://github.com/apauldev/Yotara/commit/27a881aeb0ad569acf307b48cd09aaeae971f893))
* **test:** update lockout-scope test to use trusted-proxy-aware IP simulation ([c1641ae](https://github.com/apauldev/Yotara/commit/c1641aea456fe8678c68f45324c8581b0204f1b6))
* **ui:** show resend verification errors on check-email screen ([a1814db](https://github.com/apauldev/Yotara/commit/a1814dba6605ac4f03230b84dd079eab0a34e705))


### Documentation

* add email verification implementation log ([43f9487](https://github.com/apauldev/Yotara/commit/43f94874979fb6dc2e939bc09aae354b362a3d2a))
* note E2E coverage and unit coverage in implementation log ([7d6edbd](https://github.com/apauldev/Yotara/commit/7d6edbd09f24697af0d65396c83b3d3ec7ced981))


### Chores

* add DCO sign-off for Developer Certificate of Origin ([8b8459e](https://github.com/apauldev/Yotara/commit/8b8459ef8b4138490012fdd0e72118706bde7976))
* increase PR agent model max tokens to 512k ([38c714d](https://github.com/apauldev/Yotara/commit/38c714d1a29eb104a9a6fc5d1dc026e071c16e8e))


### Tests

* add coverage for email-first auth branches ([7acf4e5](https://github.com/apauldev/Yotara/commit/7acf4e5500ad835a9c4610ecefeaf0a78928ba9b))
* **api:** cover cleanup job lifecycle (start/stop/idempotent) ([638242a](https://github.com/apauldev/Yotara/commit/638242abdae7a4f64dd8ac6efae984ae0f7c5a6b))
* **api:** fix typed count access in unverified cleanup test ([b86971d](https://github.com/apauldev/Yotara/commit/b86971de6cf2e51a2263c62a7edb9496c919dff2))
* **e2e:** cover email-first signup and make setup mode-aware ([d89b9bf](https://github.com/apauldev/Yotara/commit/d89b9bf9f970d365fbc9427bc5e12f5aea972aeb))
* **frontend:** cover email-first signup and verify-email flow ([d444231](https://github.com/apauldev/Yotara/commit/d44423184dfe9e371cd7245e0afd3ddb63c773c6))

## [0.72.3](https://github.com/apauldev/Yotara/compare/v0.72.2...v0.72.3) (2026-08-10)


### Bug Fixes

* **frontend:** make notifications dropdown scrollable, aligned, and mobile-safe ([f329c16](https://github.com/apauldev/Yotara/commit/f329c16ff55e3004eb11efaafebf30495147d316))


### Chores

* add DCO sign-off for Developer Certificate of Origin ([8eaac1a](https://github.com/apauldev/Yotara/commit/8eaac1a9981d64bf94113f3e9ff76679dada73cf))

## [0.72.2](https://github.com/apauldev/Yotara/compare/v0.72.1...v0.72.2) (2026-08-06)


### Chores

* **docker:** point Docker Hub images to apauldev2 account ([0e3b844](https://github.com/apauldev/Yotara/commit/0e3b8446147d7761922a3b8ea52328f934391c66))

## [0.72.1](https://github.com/apauldev/Yotara/compare/v0.72.0...v0.72.1) (2026-08-06)


### Bug Fixes

* **frontend:** add global focus ring ([253ae05](https://github.com/apauldev/Yotara/commit/253ae05c3c42da18f52f1944c07756aa80346a36))

## [0.72.0](https://github.com/apauldev/Yotara/compare/v0.71.1...v0.72.0) (2026-08-05)


### Features

* **frontend:** upgrade Angular 21 to 22 ([c04c0c6](https://github.com/apauldev/Yotara/commit/c04c0c6366fa2b3d6d6b69b0b66d72b7343852a8))
* **frontend:** upgrade Tailwind CSS 3 to 4 ([0eb1f8c](https://github.com/apauldev/Yotara/commit/0eb1f8c2542639bb9045b7b3dd6decb9913bcca6))


### Bug Fixes

* added dummy better auth secret ([69a63de](https://github.com/apauldev/Yotara/commit/69a63debcd46959c2185df54923e4a48706ca363))
* fixed the CI build failure by updating Node from 22.22.1 to 22.22.3 in package.json, CI ([20ba827](https://github.com/apauldev/Yotara/commit/20ba8271472722bd4a9bbc8ca31942fc247182bb))
* harden Docker release and native SQLite validation ([7354a5d](https://github.com/apauldev/Yotara/commit/7354a5d395287818e15789bccb9dc29473bf517a))
* restore @yotara/shared source alias for dev/typecheck/tests ([57ae2ca](https://github.com/apauldev/Yotara/commit/57ae2ca81b5dbb305a1a7e24e57c11269e95139d))
* restore test env and verify Docker SQLite ([e976f6e](https://github.com/apauldev/Yotara/commit/e976f6e9d7bfb4f0e42f0bce68ee70b796c96db8))


### Documentation

* add DCO signed-off-by trailer for dependency upgrade commits ([e726280](https://github.com/apauldev/Yotara/commit/e726280ff7bd1107ea0983c3648d7b2abe7730d2))
* update Angular 22 and v0.71.1 references across docs and marketing site ([e657163](https://github.com/apauldev/Yotara/commit/e6571630aa11e7c0f118c3528ca4aa01cc4515ab))


### Chores

* **deps:** apply clean Dependabot patch bumps (@fastify/cors, tsx, playwright, @types/luxon) ([6981e28](https://github.com/apauldev/Yotara/commit/6981e28c9046619b10017946dc858ab5302323cd))
* **deps:** upgrade better-sqlite3 to 13.0.1 ([37f1dc2](https://github.com/apauldev/Yotara/commit/37f1dc224c237eebcab8818f5f8e20d89dcb197a))
* **deps:** upgrade TypeScript to 6.0.3 ([4243037](https://github.com/apauldev/Yotara/commit/424303742cd6bfcdea04272234ec615ccede03c5))
* harden build/test config for TypeScript 6 and Angular 22 upgrades ([a48b3bc](https://github.com/apauldev/Yotara/commit/a48b3bcbc09ae6c797bce2c8ea2094540cb1e40a))

## [0.71.1](https://github.com/apauldev/Yotara/compare/v0.71.0...v0.71.1) (2026-08-01)


### Bug Fixes

* **ci:** add synchronize to pr_actions so auto-tools run on new commits ([0ae019c](https://github.com/apauldev/Yotara/commit/0ae019cbe22e4f79f69587526ee32b00bb18e8a6))
* **ci:** pin PR Agent to v0.41.0, add Dependabot for action updates ([79887c4](https://github.com/apauldev/Yotara/commit/79887c4068aed30832ada881196bcc7800e4edb5))
* flash is stronger for now ([3c4e534](https://github.com/apauldev/Yotara/commit/3c4e5340d384ff0241b8c8b11541bde720b3d7cd))


### Documentation

* add DCO signed-off-by trailer to docs revamp ([fce3082](https://github.com/apauldev/Yotara/commit/fce308229f7fda7e1ce59e06e5a0993b02fa98e6))
* clarify dormant email verification in current-state section ([2830a04](https://github.com/apauldev/Yotara/commit/2830a047cdad42da5c80b4af339d390f0543b56d))
* restore X-Forwarded-For forging rationale for trustProxy constraint ([71f20ee](https://github.com/apauldev/Yotara/commit/71f20ee1cbba120690a83cffe9ce01967cae8d29))
* revamp architecture guide, move planning to GitHub Project board ([a6f904e](https://github.com/apauldev/Yotara/commit/a6f904ec1bf07c416236e16220359b1f7d7a9c46))

## [0.71.0](https://github.com/apauldev/Yotara/compare/v0.70.2...v0.71.0) (2026-07-29)


### Features

* **docker:** publish pre-built images to Docker Hub ([b5e34e5](https://github.com/apauldev/Yotara/commit/b5e34e549753543189eb8b007d0dc0d18977e05e))
* **marketing:** add FAQ, self-host blog images, interest capture ([f2c7cc0](https://github.com/apauldev/Yotara/commit/f2c7cc0ca0805de4cb0f3c924ee2530b901eb42b))
* **marketing:** consolidate homepage and fix correctness ([d81ef6b](https://github.com/apauldev/Yotara/commit/d81ef6b1f64cc70105f0f1c260051d3649ac0aad))


### Bug Fixes

* **ci:** guard docker-publish job on CI success ([9b49d12](https://github.com/apauldev/Yotara/commit/9b49d12ca469a5cc3e5a3b4cff5ef9ade1cfd0c2))
* **ci:** make docker-publish depend on release, use bumped version for tags ([86e754f](https://github.com/apauldev/Yotara/commit/86e754f5f1fcbc610ac1678fed798096cb12ad27))
* **ci:** support workflow_dispatch for manual releases ([e1d385c](https://github.com/apauldev/Yotara/commit/e1d385c373b5a34e28ad7f39e8d00f16872aa7ef))
* exclude marketing site from ESLint, fix e2e date-picker locator ([628e6b4](https://github.com/apauldev/Yotara/commit/628e6b4ed6eaab62a4e8f594fe409d41eb1f78f3))
* **marketing:** add CSP to install docs, standardize og:image, proxy star count ([a1907b8](https://github.com/apauldev/Yotara/commit/a1907b8d0b5ff82793b82838d9c1fb355b478b3d))
* **marketing:** revise FAQ with beta mention, fix Hub compose data path ([84c4b60](https://github.com/apauldev/Yotara/commit/84c4b60447f706f328b09545fe4c48d24ff27c6d))


### Chores

* **release:** sync website version automatically ([4414b6b](https://github.com/apauldev/Yotara/commit/4414b6bb133e24674acd8986cf53fbd524bea73e))

## [0.70.2](https://github.com/apauldev/Yotara/compare/v0.70.1...v0.70.2) (2026-07-26)


### Bug Fixes

* remove E2E test for removed mode switcher toggle ([f99cca1](https://github.com/apauldev/Yotara/commit/f99cca132b768a2aa74c862c64acfda1e283dea2))
* update E2E global setup — personal mode is now the default ([54e8e2e](https://github.com/apauldev/Yotara/commit/54e8e2e5b10b41003de1379ffbfa5bcc42a0c496))


### Refactoring

* remove dead UI references to unreleased features ([15f3248](https://github.com/apauldev/Yotara/commit/15f32482747862fb2571863974acd27ceec20062))

## [0.70.1](https://github.com/apauldev/Yotara/compare/v0.70.0...v0.70.1) (2026-07-22)


### Bug Fixes

* auth secret guard in server.ts — handle unset NODE_ENV ([54824f1](https://github.com/apauldev/Yotara/commit/54824f15d3759af4645719a3cda8b41506b45e69))
* make email IP cap configurable, raise in CI for E2E tests ([f2d2c41](https://github.com/apauldev/Yotara/commit/f2d2c416bc08f63ae9fa90f73d7a0259276d491d))
* move PRAGMA foreign_keys before BEGIN IMMEDIATE in schema bootstrap ([16bce69](https://github.com/apauldev/Yotara/commit/16bce69ba5f98061cfc6e1f335726f145ad6c318))
* normalize sensitive log keys to lowercase before redaction ([caef3b6](https://github.com/apauldev/Yotara/commit/caef3b6c7bd86609b8486a790caef83c485a3d9b))
* pass clientIp into checkRateLimitOrThrow for IP-based rate limiting ([5f2d04d](https://github.com/apauldev/Yotara/commit/5f2d04db72781911cd818166c077d73ceeb91531))
* remove chmod of parent directory in DB permission lock ([5b69862](https://github.com/apauldev/Yotara/commit/5b6986211fbc604461cba240823feeabb8bdbf9c))
* replace fake JWT token in test to silence gitleaks ([08724e4](https://github.com/apauldev/Yotara/commit/08724e44233b2c74def70c0d1b3c691d06d9dca7))


### Chores

* add .gitleaks.toml to allowlist test file false positives ([05f0cd9](https://github.com/apauldev/Yotara/commit/05f0cd9d241b7e03abf839198457eff24de5794d))
* lower pnpm audit threshold from moderate to high ([d074fcc](https://github.com/apauldev/Yotara/commit/d074fcce1a748908580fcc8024a1efd642a6cc75))
* make pnpm audit non-blocking in CI ([4865ac5](https://github.com/apauldev/Yotara/commit/4865ac55c37c67f196217f6093933c7b1903b90f))
* phase 1 security hardening — secrets hygiene and git leakage ([822b84a](https://github.com/apauldev/Yotara/commit/822b84a557da4c29b7cce2f326f2f7f3126c6791))
* phase 2 security hardening — infrastructure hardening ([e37aaec](https://github.com/apauldev/Yotara/commit/e37aaec785345a97c2cd20810040cb0a4ded3ce7))
* phase 3 security hardening — auth & session hardening ([1d87629](https://github.com/apauldev/Yotara/commit/1d876298b50de736525219e587976ef447e0c864))
* phase 3.5 — IP rate-limit, record on all attempts, tighten global limit ([6652ed8](https://github.com/apauldev/Yotara/commit/6652ed87342691045e7c48f12534d3bdb84e418f))
* phase 4 security hardening — API defense-in-depth ([cd0b084](https://github.com/apauldev/Yotara/commit/cd0b08426e3dfe7b908e3ed3473e25eb74ba1b54))
* phase 5 security hardening — frontend hardening ([32e877e](https://github.com/apauldev/Yotara/commit/32e877eecc0b62e6ad36aa7f3477ba20021d415b))
* phase 6 security hardening — CI/CD gates ([1e1df09](https://github.com/apauldev/Yotara/commit/1e1df09c44a169b10a818106231e509427a51729))
* phase 7 security hardening — database hygiene ([787e4d1](https://github.com/apauldev/Yotara/commit/787e4d1ae99478052dcd8d4a14a4459a58a1d4c5))

## [0.70.0](https://github.com/apauldev/Yotara/compare/v0.69.0...v0.70.0) (2026-07-18)


### Features

* implement in-app notifications system ([b39ba03](https://github.com/apauldev/Yotara/commit/b39ba031dda3639d671896077f37c922532e1998))


### Bug Fixes

* e2e testing fixed selector changed ([362af99](https://github.com/apauldev/Yotara/commit/362af9945f8582e6ff318c53d35d10df73802556))
* **e2e:** use calendar popover instead of input[type=date] for notification test ([cda7772](https://github.com/apauldev/Yotara/commit/cda777211bd200412d0f04d1b35f21eb489b5b0f))
* enable Mark all read when notifications are unread ([9cd729d](https://github.com/apauldev/Yotara/commit/9cd729daf6318b310f1917df49498bda8d4b0c36))
* fix timezone flaky test ([16c922d](https://github.com/apauldev/Yotara/commit/16c922de84f88a80216189078574f6f59f8b0835))
* generate due/overdue notifications lazily on read path ([39f8589](https://github.com/apauldev/Yotara/commit/39f8589a2150a51cb54de2b20bc68be9a52907c0))
* pass actual completed state to notification check on task update ([3a231e4](https://github.com/apauldev/Yotara/commit/3a231e48f36d14a7e8d890c1b344c25bb15ea35a))
* refresh notification list when bell dropdown is opened ([efcf7dd](https://github.com/apauldev/Yotara/commit/efcf7dde2e5430b22ba2030e3b4d67db85c41532))
* rename Notification type import in spec to avoid shadowing global ([3b893dd](https://github.com/apauldev/Yotara/commit/3b893ddd8b20fb8c296071ffd3c02e438fd710d3))

## [0.69.0](https://github.com/apauldev/Yotara/compare/v0.68.0...v0.69.0) (2026-07-16)


### Features

* implement delete account functionality ([c4f0482](https://github.com/apauldev/Yotara/commit/c4f04829a4984af1dada031a753d966f91ffc394))


### Bug Fixes

* show accurate task counts in delete account modal ([728e3a2](https://github.com/apauldev/Yotara/commit/728e3a2fbc4b850e151777dcb6e6bb99bbfaa90f))
* use .first() for logout button selector in e2e tests ([6a1772a](https://github.com/apauldev/Yotara/commit/6a1772ad559369d7c900a6af3bdb6c51d8716a55))
* use session token for rate-limit key instead of undefined userId ([8586698](https://github.com/apauldev/Yotara/commit/85866988b56f71cb19b35d8c4b3449df93741796))


### Tests

* improve patch coverage for delete account feature ([d4e26ba](https://github.com/apauldev/Yotara/commit/d4e26baba6bfc4254b2b366656adff2c6199bd16))

## [0.68.0](https://github.com/apauldev/Yotara/compare/v0.67.0...v0.68.0) (2026-07-15)


### Features

* wrap multi-table writes in SQLite transactions ([9667443](https://github.com/apauldev/Yotara/commit/9667443bf92dd03e07961ff8e2cea251172da2bf))


### Tests

* increase transaction coverage to 97% on task-service, 100% on label-service ([51d2faf](https://github.com/apauldev/Yotara/commit/51d2faf19a836931a6ca05a3012dc3ab4c169c58))

## [0.67.0](https://github.com/apauldev/Yotara/compare/v0.66.1...v0.67.0) (2026-07-12)


### Features

* **website:** add SEO optimization across all pages ([c23fe10](https://github.com/apauldev/Yotara/commit/c23fe10d77bc4cf920ae2c3ad5db8e2ebb23b465))
* **website:** redesign marketing site and self-host all assets ([5798e37](https://github.com/apauldev/Yotara/commit/5798e37cbe247a7fc62c07b59b9aac23740637d9))


### Bug Fixes

* add CSS and history browser globals to eslint config ([c11ee63](https://github.com/apauldev/Yotara/commit/c11ee63af82c6245f6def58387c0dfc11bbbe484))
* correct TLS claim on install page ([106ed5d](https://github.com/apauldev/Yotara/commit/106ed5d243d7550a20ab31a26f724f94bd31d055))
* render correct page for shared blog post URLs ([b1f31d0](https://github.com/apauldev/Yotara/commit/b1f31d043b5e2a51359dba768892302378107b73))
* use root-relative asset URLs on 404 page ([ccf5843](https://github.com/apauldev/Yotara/commit/ccf5843f5c4479f4146852e628d86296dfce2ea3))


### Documentation

* added contributors back ([586594c](https://github.com/apauldev/Yotara/commit/586594c135d86005f6e47f487751e7dfdf6ea479))
* another small update ([825a5a7](https://github.com/apauldev/Yotara/commit/825a5a73a9b71072e9b6fa25b72b57f647c84449))
* fixed some factual errors ([a0d31aa](https://github.com/apauldev/Yotara/commit/a0d31aa4a8a1003ff69ca6051adf0924c7e1d10b))
* new svg ([2d71b1a](https://github.com/apauldev/Yotara/commit/2d71b1adbeff658e5a686621bbe40a288e2038f4))
* updated docs ([60e26fa](https://github.com/apauldev/Yotara/commit/60e26fa45419e6c723c6937e3567f76b90162bef))

## [0.66.1](https://github.com/apauldev/Yotara/compare/v0.66.0...v0.66.1) (2026-07-09)


### Chores

* ignore auto-generated Playwright files in Prettier check ([cb280e2](https://github.com/apauldev/Yotara/commit/cb280e20348774ba15475109e0859d5b4437a5ad))

## [0.66.0](https://github.com/apauldev/Yotara/compare/v0.65.0...v0.66.0) (2026-07-09)


### Features

* harden docker stack with security headers, CSP source of truth, and required auth secret ([e344205](https://github.com/apauldev/Yotara/commit/e34420511af043f80da5b5b16bd38d95b462e5f2))


### Bug Fixes

* enforce password policy server-side and align UI across all auth screens ([a9e84ff](https://github.com/apauldev/Yotara/commit/a9e84ff10c40308d7db57e738b5545f2f7b45dde))
* increase OoP boot timeout, use theme tokens in strength meter, fix e2e pwd policy ([12b7a00](https://github.com/apauldev/Yotara/commit/12b7a00821976779e55cf5a556c3d5cf73ae833c))
* make logo clearly show theme color in light themes ([ff3ddca](https://github.com/apauldev/Yotara/commit/ff3ddcaf011d44e0478861dfeb736fb4b8f48400))
* reject default auth secret and scope login lockout by client IP ([bf52cd7](https://github.com/apauldev/Yotara/commit/bf52cd71989a304bf29b0a5eca36c5feec3d4983))
* wire Angular environment file replacement per build configuration ([c1dd34d](https://github.com/apauldev/Yotara/commit/c1dd34ded404889d77ae34bbbe03a91c9ee3fe11))


### Refactoring

* extract strength meter into reusable component, fix colors and tiered bar ([55f9450](https://github.com/apauldev/Yotara/commit/55f945002c1fc210c4b9873476f7d80c97318363))


### Tests

* add coverage for login-lockout, security headers, login-attempts migration, and strength-meter ([a8b6f4c](https://github.com/apauldev/Yotara/commit/a8b6f4c6d42295649d8682f6da948cd318913bd1))

## [0.65.0](https://github.com/apauldev/Yotara/compare/v0.64.0...v0.65.0) (2026-07-09)


### Features

* harden docker stack with security headers, CSP source of truth, and required auth secret ([cbdc614](https://github.com/apauldev/Yotara/commit/cbdc614d7dbf8231f9d7bea1db1348c667c683aa))


### Bug Fixes

* enforce password policy server-side and align UI across all auth screens ([1841555](https://github.com/apauldev/Yotara/commit/18415550becc8ca94dbb6b30f02df2447e899aff))
* reject default auth secret and scope login lockout by client IP ([0211e6b](https://github.com/apauldev/Yotara/commit/0211e6b3dcf524a6f72b29498162dc938ba41a58))
* wire Angular environment file replacement per build configuration ([c73e74b](https://github.com/apauldev/Yotara/commit/c73e74b789c4a9522d20495be10b5ed3bfeb4336))


### Chores

* revert stash-contaminated files to main state ([0ac39b8](https://github.com/apauldev/Yotara/commit/0ac39b8529c6bf9642c450c234febd1b095d550a))


### Refactoring

* extract strength meter into reusable component, fix colors and tiered bar ([2945529](https://github.com/apauldev/Yotara/commit/29455291df8fc81afbde2ac9b58c6c1edb54f929))

## [0.64.0](https://github.com/apauldev/Yotara/compare/v0.63.1...v0.64.0) (2026-07-08)


### Features

* add completion notification with settings toggle ([e04098f](https://github.com/apauldev/Yotara/commit/e04098f2721684b6d054e9bbc763c42da3536d31))
* **blog:** add author field and avatar thumbnail per post ([8661f01](https://github.com/apauldev/Yotara/commit/8661f016d3f6b582bfaa394f37426d89286b437d))
* **blog:** add seven themes post, card polish, typography system, and reading time ([22d8db8](https://github.com/apauldev/Yotara/commit/22d8db89f22d74ee71b642080ef5d08525e662fa))
* highlight ! and # inline commands immediately in capture bar ([5654aef](https://github.com/apauldev/Yotara/commit/5654aef5307d522e148390626550f875d80f1ca2))


### Bug Fixes

* add visual hierarchy for subtasks with grouped card and left accent ([9e9295b](https://github.com/apauldev/Yotara/commit/9e9295b38381fd11d9e222c8fd9d14fb3412a10b))
* align capture-bar cursor with overlay text ([6d90873](https://github.com/apauldev/Yotara/commit/6d90873002a51e94fafbab946f47de42f09f288d))
* default theme to light-forest instead of following OS dark mode ([9490776](https://github.com/apauldev/Yotara/commit/9490776bf8e81eb7c4976ac27b0d02fc7587053f))
* improve pill accessibility with WCAG AA contrast in both modes ([2c1763d](https://github.com/apauldev/Yotara/commit/2c1763d1a468104ba93d8e9e140d307cf96a8e1d))
* only highlight first priority and known labels in capture bar ([d14dc22](https://github.com/apauldev/Yotara/commit/d14dc2225884f4326ac8aa9b89cee9609c627f29))
* preserve view query param in /inbox /today /upcoming redirects ([0781a51](https://github.com/apauldev/Yotara/commit/0781a51f30345ad504c36078aaaa48958191cd39))
* prevent double-wrapping in highlightInlineCommands and add test coverage ([a7282f5](https://github.com/apauldev/Yotara/commit/a7282f53c7792bd67f4ff6395459c9e145ae43cd))
* remove card wrapper around Upcoming tasks and unify section styles ([7948dea](https://github.com/apauldev/Yotara/commit/7948deaed5ed01103a4550059ec800d387f3e68f))
* resolve PreferencesStore mock order in workspace test ([11a2ec8](https://github.com/apauldev/Yotara/commit/11a2ec82ee8605edeb462fa85d9feba735e8e5df))
* scan per declaration instead of bailing on whole block when var() present ([2bd41b2](https://github.com/apauldev/Yotara/commit/2bd41b2d18a4ef45df173b15fad93e15048830bd))
* use toHaveCount for robust pagination assertions in search e2e ([78502e8](https://github.com/apauldev/Yotara/commit/78502e8470c909c9dc5a0027d441142b3ab2cd9c))


### Refactoring

* replace hardcoded UI colors with theme-aware CSS variables ([ccfb6d3](https://github.com/apauldev/Yotara/commit/ccfb6d30b7a7df08faee71947e568d3481cc2a6c))

## [0.63.1](https://github.com/apauldev/Yotara/compare/v0.63.0...v0.63.1) (2026-07-07)


### Bug Fixes

* self-host Material Symbols class so icons don't break when Google Fonts is slow ([3bff681](https://github.com/apauldev/Yotara/commit/3bff681cfa151c75faba7a31a79d4c6efab0c461))

## [0.63.0](https://github.com/apauldev/Yotara/compare/v0.62.3...v0.63.0) (2026-07-07)


### Features

* add marketing website (yotara-website) ([d6ccfa5](https://github.com/apauldev/Yotara/commit/d6ccfa552c8e9135f8c5002aaf31949056387dce))
* rebuild homepage with comparison, 6 feature cards, three steps, CTA ([9ca0212](https://github.com/apauldev/Yotara/commit/9ca02124a1cd5cf5d2291d5926f7577de8bde026))


### Bug Fixes

* add browser globals to eslint config for website JS files ([cd02eaf](https://github.com/apauldev/Yotara/commit/cd02eaf40a8dad62cad756fedf4b5fa4e1ed5616))
* clear body scroll lock on desktop resize ([04104d8](https://github.com/apauldev/Yotara/commit/04104d83cde95604593a5961bc68585ec91d2296))
* correct third-party services claim in privacy policy ([ba8f54b](https://github.com/apauldev/Yotara/commit/ba8f54ba7b764afe291f266c6ecb3936d6e72575))
* improve site copy, fix comparison card layout, update GDPR banner ([6449253](https://github.com/apauldev/Yotara/commit/64492537ee777ae185cbf0881665d7553d178dde))
* use /privacy/ as canonical URL (served URL) ([8dc6b1c](https://github.com/apauldev/Yotara/commit/8dc6b1c5dcff8aed4659f4ad6b1c00b812f37509))
* use clean URLs, remove _redirects, restructure privacy page ([0e6d796](https://github.com/apauldev/Yotara/commit/0e6d796cd7fed5df01c602b6b577d0a48e96eeb7))


### Documentation

* add website link to README ([d281496](https://github.com/apauldev/Yotara/commit/d281496b8c4f0d0995fe6862ccd90ee30b2da070))

## [0.62.3](https://github.com/apauldev/Yotara/compare/v0.62.2...v0.62.3) (2026-07-06)


### Documentation

* add CONTRIBUTING.md, standardize refresh() naming, mark Sprint 4 complete ([9d5a91a](https://github.com/apauldev/Yotara/commit/9d5a91a865e2d0f0ba01493d146cb613fae540d9))


### Tests

* add missing coverage for version() and saveProject() ([ed59c83](https://github.com/apauldev/Yotara/commit/ed59c83b251dcba2edc836307708788e48e21360))

## [0.62.2](https://github.com/apauldev/Yotara/compare/v0.62.1...v0.62.2) (2026-07-06)


### Chores

* **deps:** bump fastify from 5.8.1 to 5.9.0 ([fbe7dbd](https://github.com/apauldev/Yotara/commit/fbe7dbdd61836640501dd99f2a336bf25cfd8e7d))
* **deps:** update non-Angular packages from dependabot ([fbb1f5e](https://github.com/apauldev/Yotara/commit/fbb1f5e311ab1d8507d0df705343707c0efbf1f8))
* set minimum Node engine to >=22.22.1 for lint-staged v17 compatibility ([b3e6eb5](https://github.com/apauldev/Yotara/commit/b3e6eb5ff712f147b2e7a0c881d076498bc9044b))

## [0.62.1](https://github.com/apauldev/Yotara/compare/v0.62.0...v0.62.1) (2026-07-04)


### Bug Fixes

* **test:** verify seeding via direct DB query to avoid false positive ([2758272](https://github.com/apauldev/Yotara/commit/275827283b840a2a28cb390252d66c3b8ce0d9d0))


### Documentation

* add Phase 1 backend route coverage plan ([3ebfb5b](https://github.com/apauldev/Yotara/commit/3ebfb5b387679b126f511d391c2121f6e2bdf66d))


### Chores

* remove backendrouteplan.md ([54aa0f9](https://github.com/apauldev/Yotara/commit/54aa0f94513ebb92ab7f150e6c8ca7aa9b9f7b5f))


### Tests

* **api:** add route-level coverage for /me, /health, and / ([0d38595](https://github.com/apauldev/Yotara/commit/0d38595f93c906b23675592c6caacb492befdf94))

## [0.62.0](https://github.com/apauldev/Yotara/compare/v0.61.1...v0.62.0) (2026-07-03)


### Features

* server-side search with SQL relevance scoring ([fc87667](https://github.com/apauldev/Yotara/commit/fc87667d3c1a8390595ac5f9ef22800d7fec81a0))


### Bug Fixes

* **api:** include status in search WHERE pre-filter ([4d00cf6](https://github.com/apauldev/Yotara/commit/4d00cf61cc83ab8eb0744f6702824b0f7a954d2b))
* **api:** increase lockout window to 10s in recovery test to survive CI latency ([738979d](https://github.com/apauldev/Yotara/commit/738979d3bf3146081e603b2b71db3fa779ca6db9))
* **api:** use setLockoutConfig to prevent CI flakiness from concurrent env-var clobbering ([4d33bda](https://github.com/apauldev/Yotara/commit/4d33bdab5b5c4a468ff66c8ac7d44169210743f9))
* **e2e:** create enough tasks to trigger pagination visibility ([126623c](https://github.com/apauldev/Yotara/commit/126623cfb305fc69f2343b1f405d655171dd19a0))
* **e2e:** use correct page-1 expectation for pagination test ([b938438](https://github.com/apauldev/Yotara/commit/b938438b9d8f0b258dc8b8e8c8380950fc24b726))
* **e2e:** use count-based assertion for Tasks tab pagination ([78971d8](https://github.com/apauldev/Yotara/commit/78971d89b3af802c5425229e4ba066999095eec4))
* **e2e:** wait for URL to confirm Tasks tab navigation ([cb5c805](https://github.com/apauldev/Yotara/commit/cb5c805377dfc8235df6e417b7fc8983b052fe47))
* **frontend:** always fetch allTaskResults when query changes ([8127bda](https://github.com/apauldev/Yotara/commit/8127bda0fb0dfa76d27e9548d475baa2319b1c1d))
* prevent pagination reset on tab switch and fix test assertions ([fdfa076](https://github.com/apauldev/Yotara/commit/fdfa076201a849d9a71378c810b204e1ff52cbd1))
* **test:** use 1s lockout window + 60s timeout for CI reliability ([73abe5e](https://github.com/apauldev/Yotara/commit/73abe5ed3d2d82b95076d0c8e2a5f2689bf92fea))


### Tests

* **api:** add coverage for task-without-project search path ([94bbf94](https://github.com/apauldev/Yotara/commit/94bbf942399712854b22119b3dab52cdc06babf3))
* **api:** fix coverage test — tasks auto-assign to Inbox project ([81f5133](https://github.com/apauldev/Yotara/commit/81f5133cdc0e39e3dea50894df5a9436dc8b890c))
* **api:** poll for lockout expiry instead of fixed timeout ([f28ffdf](https://github.com/apauldev/Yotara/commit/f28ffdfbf46a965d5c5d0396e1175abb3cd3b96d))

## [0.61.1](https://github.com/apauldev/Yotara/compare/v0.61.0...v0.61.1) (2026-07-02)


### Bug Fixes

* replace N+1 label queries with batch fetch in task listing ([f823041](https://github.com/apauldev/Yotara/commit/f8230418934efb36812a39d257252362f9876a38))


### Documentation

* added new issues + project instead of docs ([cf0bed2](https://github.com/apauldev/Yotara/commit/cf0bed28cfa5112d4dc79b6f0ad27d9372c32828))

## [0.61.0](https://github.com/apauldev/Yotara/compare/v0.60.2...v0.61.0) (2026-06-27)


### Features

* forgot/reset password flow with email rate limiting ([d62d34c](https://github.com/apauldev/Yotara/commit/d62d34c253831d1bdc833e2acd8b9badb01ead58))


### Documentation

* update ARCHITECTURE.md with password-reset hardening and e2e fix ([82e1550](https://github.com/apauldev/Yotara/commit/82e15504b5bf0df4d95c8dc346fca97a60c64889))
* update PLAN.md with CI fixes and root causes ([d3ba4cd](https://github.com/apauldev/Yotara/commit/d3ba4cdaed524a7f9f27ee63bea416601ebf7f81)), closes [#9](https://github.com/apauldev/Yotara/issues/9) [#10](https://github.com/apauldev/Yotara/issues/10)


### Tests

* cover auth.ts sendResetPassword and sendVerificationEmail callbacks ([a6b685b](https://github.com/apauldev/Yotara/commit/a6b685b12d3fa0f99bb98a69b4bb1aab92702a88))
* improve patch coverage for password-reset feature ([8b1e0d5](https://github.com/apauldev/Yotara/commit/8b1e0d5a90feb79043f44cd10c112c387cda29df))

## [0.60.2](https://github.com/apauldev/Yotara/compare/v0.60.1...v0.60.2) (2026-06-23)


### Bug Fixes

* add @types/node, add e2e:wait script, fix CI wait-on invocation ([5ec1f6e](https://github.com/apauldev/Yotara/commit/5ec1f6e2c3481245fa874f68ec19f0efcebd330b))
* use pnpm --filter exec wait-on instead of pnpm exec in CI ([6866868](https://github.com/apauldev/Yotara/commit/68668682072bf4f37fafcdad33297202af72b154))
* use pnpm exec wait-on instead of pnpm --filter wait-on in CI ([9a2cfe7](https://github.com/apauldev/Yotara/commit/9a2cfe7e1c0824fce91c68ea18e32d59514c664e))


### Tests

* add comprehensive e2e test suite (55 tests across 13 spec files) ([c369cb3](https://github.com/apauldev/Yotara/commit/c369cb3e62193a02d8701192f5fd6b8702daa389))

## [0.60.1](https://github.com/apauldev/Yotara/compare/v0.60.0...v0.60.1) (2026-06-22)


### Bug Fixes

* escape html in highlight pipe to prevent xss ([8c983e7](https://github.com/apauldev/Yotara/commit/8c983e75c5fc38011acc601db1392c47939eeb48))


### Documentation

* add admin and notifications implementation plan ([2a43eea](https://github.com/apauldev/Yotara/commit/2a43eea8f0d5e2d929b9e4ee80a031871a3f930f))
* fix SW location — must be in public/ not src/ for Angular build ([4db49df](https://github.com/apauldev/Yotara/commit/4db49df518b6d4fe0b5dbf1c3f3c3808821f16b3))
* guard ALTER TABLE with PRAGMA table_info check ([2d9711f](https://github.com/apauldev/Yotara/commit/2d9711f71b4b0350c40e93e0a5b113197e14a972))
* update Phase 4 to use per-request grace check in requireAuthenticatedUser ([e5debcd](https://github.com/apauldev/Yotara/commit/e5debcd880094b8326dd163fe95d7f085903f4ae))

## [0.60.0](https://github.com/apauldev/Yotara/compare/v0.59.7...v0.60.0) (2026-06-19)


### Features

* **rate-limiting:** add global rate limiting and per-email password lockout ([e5c06eb](https://github.com/apauldev/Yotara/commit/e5c06ebb2c46628d7d301b64f75de910568fff18))


### Bug Fixes

* **login-lockout:** merge stale-row test into main test to avoid module-caching conflict ([c79e725](https://github.com/apauldev/Yotara/commit/c79e725e16e919e730fb32bf34621686007ffc6d))
* **login-lockout:** prune stale pre-lockout attempt rows ([f240b19](https://github.com/apauldev/Yotara/commit/f240b1913cf362755461e6ece16c490e059f3164))
* **rate-limiting:** use trustProxy for authoritative client IP ([bb1744f](https://github.com/apauldev/Yotara/commit/bb1744f63175ee7a868a12c74871602ddef8335d))
* **test:** increase recovery test lockout window to avoid CI timing flake ([ae22d2c](https://github.com/apauldev/Yotara/commit/ae22d2c46b499894d1b8b49cf85885f593f8276f))


### Documentation

* **arch:** mark rate limiting as completed ([530f526](https://github.com/apauldev/Yotara/commit/530f526fa2e015b2775c629fb56cefdc5d28421e))


### Tests

* add coverage for login component validation, errors, and lockout ([374d89a](https://github.com/apauldev/Yotara/commit/374d89ab259b6f9952e3b3407ac3e0fc4f9ca553))

## [0.59.7](https://github.com/apauldev/Yotara/compare/v0.59.6...v0.59.7) (2026-06-18)


### Bug Fixes

* **tasks:** align calendar date handling ([a4c8094](https://github.com/apauldev/Yotara/commit/a4c80943f1ed578bcf72f2a0a99e3f794eccef5f))
* update test to match PATCH URL with tz query param ([b6e233b](https://github.com/apauldev/Yotara/commit/b6e233b234497e97a7b407d3454e40eb72738ab7))
* use timezone-aware date when restoring tasks to correct bucket ([dfe4194](https://github.com/apauldev/Yotara/commit/dfe4194dfefe60f6df8edaa84b0ee9b5f32cef7d))


### Tests

* add coverage for tz-aware task restore path ([89f06f7](https://github.com/apauldev/Yotara/commit/89f06f7be163d54a8daeb237dd91df39f339f199))

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
