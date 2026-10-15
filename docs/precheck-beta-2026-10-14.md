# Beta deployment precheck — 2026-10-14

## Proposed deployment

- Release: `v0.80.0`
- Release commit: `cd39410031eb93ee95ccb4321a1ae730a7174cee`
- Release parent / CI commit: `e624a7479a706912a5148bddb958597e9c051e0d`
- Source branch for this session: `feat/deploy-automation-impl`
- Deploy target: EC2 SSH alias `yotara`, Compose project `ubuntu`
- Current EC2 API/frontend version reported by deploy preflight: `v0.79.3`
- Proposed transition: `v0.79.3` → `v0.80.0`

## Pre-deploy gates

- [x] `pnpm run deploy --check` completed without mutation.
- [x] GitHub Release `v0.80.0` exists.
- [x] CI succeeded on release parent commit `e624a7479a706912a5148bddb958597e9c051e0d` (workflow run `38591502148`).
- [x] Docker Hub tag `apauldev2/yotara-api:v0.80.0` is published.
- [x] Docker Hub tag `apauldev2/yotara-frontend:v0.80.0` is published.
- [x] SSH alias `yotara` is reachable; remote identity is `ubuntu@ip-172-31-11-8`.
- [x] Remote Compose preflight found both API and frontend tags pinned consistently at `v0.79.3`.
- [x] Deployment script will take a WAL-safe DB backup, retain existing backups, save the Compose file, update and verify both image tags, pull with a 10-minute bound, restart frontend before API, and poll API health within 60 seconds.

## Deployment result

- Deployment completed with `pnpm run deploy --yes` at 2026-10-14 16:39 UTC.
- Database backup: `/opt/backups/yotara-2026-10-14T163953Z.db`; read-only SQLite `integrity_check` returned `ok`.
- Rollback Compose snapshot: `/home/ubuntu/docker-compose.hub.yml.bak.2026-10-14T163955Z`; it retains both image pins at `v0.79.3`.
- Current Compose and running API/frontend containers are both pinned to `v0.80.0`; both services report `Up`.
- Deployment verification passed: `realip.conf` present, `nginx -t` passed, in-container API health passed on the first probe, and the public health endpoint returned `{"status":"ok"}`.
- Post-deploy API logs since startup contain 23 HTTP 200 responses, zero logged error-level/5xx events, and two server-listen messages (startup and address binds).
- Nginx logs contain 66 HTTP 200 responses and one HTTP 400 from an unsolicited Palo Alto scanner request (`/`, identified by its user agent); no 5xx responses were observed.
- The local feature branch remains separate from the deployed release. No application code was deployed from the unpushed local commit.

The deploy script selected and verified the released version from `origin/main`; the current feature-branch commit was not deployed.
