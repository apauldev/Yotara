# Manual CD Plan

This document describes the manual continuous deployment workflow for Yotara's beta
EC2 instance. It is the source of truth for how releases move from GitHub to the
live environment.

## Principles

- No push, merge, release, or image publication automatically deploys to EC2.
- Deployment is a deliberate, user-blessed action.
- Every deployment is recorded with version, image digests, backup artifact, and
  smoke results.

The first deployment target is the existing beta EC2 instance. The workflow should
be general enough to extend to staging and production environments later.

## 1. Release: `.github/workflows/release.yml`

A dispatch-only workflow that:

1. Validates the version input (`vX.Y.Z`).
2. Builds and pushes multi-arch Docker images (`linux/amd64`, `linux/arm64`) for
   both `api` and `frontend` services.
3. Tags the images on Docker Hub with the release version.
4. Creates a GitHub Release with release notes.

Deployment is performed by copying a release-specific Compose file to EC2 and running
`docker-compose up -d`. The release workflow does not deploy; it only publishes
artifacts.

## 2. Deploy workflow: `.github/workflows/deploy.yml`

Add a separate dispatch-only workflow with inputs:

- `environment`: initially `beta`; later `staging` or `production`.
- `version`: required `vX.Y.Z` release tag.
- `confirmation`: required exact value such as `deploy-beta`.

Configure a protected GitHub `beta` environment with:

- Required reviewer approval.
- Environment URL `https://beta.yotara.website`.
- SSH connection secrets: host, user, private key, and pinned `known_hosts` entry.
- The remote Compose path and project name as environment configuration, not application
  secrets.

Use least-privilege workflow permissions (`contents: read` for deployment). Serialize
deployments per environment with `cancel-in-progress: false`; two deployments must not
run concurrently against the same SQLite volume.

### Deployment preflight on GitHub

Before opening the SSH deployment step:

1. Validate `version` against `^v[0-9]+\\.[0-9]+\\.[0-9]+$`.
2. Reject `latest`, bare floating tags, branch names, and arbitrary image references.
3. Confirm the GitHub Release and tag exist.
4. Confirm both Docker Hub image manifests exist for the selected tag and support
   `linux/amd64` and `linux/arm64`.
5. Resolve and record the API and frontend manifest digests.
6. Confirm the selected release's CI checks passed.
7. Show the target environment, tag, release SHA, and image digests in the approval step.

The deployment job should consume a published release; it must not build images.

### Deployment sequence on EC2

Implement the remote sequence in a reviewed script such as
`scripts/deploy-ec2.sh`, invoked over SSH with a validated version argument. The script
must quote arguments and reject malformed tags so the version cannot become shell syntax.

The script should:

1. Confirm Docker Compose v2 is available. Standardize on `docker compose` rather than
   relying on the old `docker-compose 1.29.2` behavior that previously produced a
   `ContainerConfig` failure.
2. Confirm the canonical Compose file exists and validates with `docker compose config`.
3. Confirm the host `.env` exists with restrictive permissions. Never print its contents.
4. Confirm production invariants:
   - `NODE_ENV=production`;
   - `DEV_MODE` is empty/false;
   - `ALLOW_DEV_MODE_IN_PRODUCTION` is empty/false;
   - `BETTER_AUTH_SECRET` is present;
   - `RESEND_API_KEY` is present;
   - `TRUSTED_ORIGINS` and `APP_BASE_URL` match the public HTTPS origin;
   - the API has no host port binding;
   - the nginx TLS template and certificate mounts exist.
5. Identify the existing Compose project name and persistent volume before changing
   anything. The current beta history uses a volume named like
   `ubuntu_yotara_api_data`; never allow a project-name change to silently create an
   empty replacement database. Make the selected project name explicit in the host
   deployment configuration.
6. Capture the currently running API/frontend tags, image digests, Compose file hash,
   and persistent volume name as rollback metadata.
7. Run the application-aware SQLite backup and require:
   - online/WAL-safe backup success;
   - `PRAGMA integrity_check` success;
   - checksum creation;
   - encrypted off-instance upload success;
   - a recorded backup path and checksum.
8. Render the selected `IMAGE_TAG` into the Compose deployment without changing the host
   `.env` secrets.
9. Pull the selected images and recreate the stack with the existing TLS mounts and
   persistent volume. Prefer `up -d --force-recreate` after a successful pull; use an
   explicit `down` only as a controlled fallback after Compose v2 compatibility is
   established.
10. Wait for the API to become ready and fail if the container restarts, exits, or logs
    a schema/SQLite startup error.
11. Run the deployment smoke checks.
12. Write a deployment record containing environment, version, source/release SHA, image
    digests, host, project/volume name, backup artifact, Compose hash, timestamp, and
    smoke results.

The script must not receive or log `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, or any other
application secret. Those remain on EC2 in the existing restricted environment file.

## 3. Rollback workflow: `.github/workflows/rollback.yml`

Add a dispatch-only rollback operation using the same protected environment and SSH
controls. Inputs should include:

- target environment;
- known-good immutable `vX.Y.Z` version;
- required confirmation;
- optional incident/reference identifier.

Rollback should:

1. Validate that the target tag exists and both images support the host architecture.
2. Capture the currently running version and preserve the failed deployment record.
3. Run a fresh backup before changing containers.
4. Update the Compose file to the known-good version.
5. Pull and recreate.
6. Verify health.
7. Write a rollback record.

## 4. Environment configuration

The host-side `.env` file on EC2 contains application secrets and is never emitted
in workflow logs or committed to the repository.

### Required variables

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | Session signing key (`openssl rand -base64 32`) |
| `RESEND_API_KEY` | Transactional email API key |
| `APP_BASE_URL` | Public origin (e.g. `https://beta.yotara.website`) |
| `TRUSTED_ORIGINS` | Comma-separated trusted origins for CORS |
| `TRUST_PROXY` | CIDR of the reverse proxy (e.g. `172.16.0.0/12`) |

### Optional variables

| Variable | Description |
|----------|-------------|
| `DEV_MODE` | Enables dev mode (email logging, no verification) |
| `ALLOW_DEV_MODE_IN_PRODUCTION` | Double opt-in for dev mode in production |
| `EMAIL_FROM` | Sender address for transactional email |
| `CONTENT_SECURITY_POLICY` | Override default CSP |

## 5. EC2 host setup

### SSH access

Configure `~/.ssh/config` with a `yotara` host entry:

```
Host yotara
    HostName <EC2_PUBLIC_IP>
    User ubuntu
    IdentityFile ~/Downloads/yotara.pem
    IdentitiesOnly yes
```

### Compose file location

The deployment Compose file lives at `/home/ubuntu/docker-compose.hub.yml` on the
EC2 host. It is the single source of truth for the running stack.

### Persistent volume

The SQLite database lives in the `ubuntu_yotara_api_data` Docker volume. The
mount point is `/var/lib/docker/volumes/ubuntu_yotara_api_data/_data/yotara.db`.

### TLS certificates

TLS termination is handled by nginx inside the frontend container. Certificates
are mounted from `/opt/yotara/ssl/` on the host.

### Legal content

Beta Terms of Service are mounted from `/opt/yotara/legal/` on the host. Copy
the canonical document before recreating the frontend container:

```bash
scp legal/beta/terms.json yotara:/tmp/yotara-terms.json
ssh yotara 'sudo install -d -o root -g root -m 755 /opt/yotara/legal && sudo install -o root -g root -m 644 /tmp/yotara-terms.json /opt/yotara/legal/terms.json && rm -f /tmp/yotara-terms.json'
```

## 6. Post-upload verification on the EC2 instance

After deployment, verify:

- [ ] Both containers are running with the correct image tags.
- [ ] `/api/health` returns `{"status":"ok"}`.
- [ ] The public origin (`https://beta.yotara.website`) returns 200.
- [ ] No container restarts in the first 60 seconds.
- [ ] The SQLite database is intact (`PRAGMA integrity_check` passes).
- [ ] A deployment record is written with all required fields.

## 7. Backup and restore

### Backup procedure

1. Identify the volume mount point:
   ```bash
   docker volume inspect ubuntu_yotara_api_data --format "{{.Mountpoint}}"
   ```
2. Create a WAL-safe backup:
   ```bash
   sudo sqlite3 <mountpoint>/yotara.db ".backup /home/ubuntu/backup-<version>-<timestamp>.db"
   ```
3. Verify integrity:
   ```bash
   sudo sqlite3 <backup> "PRAGMA integrity_check;"
   ```

### Restore procedure

1. Stop the API container.
2. Replace the database file in the volume mount point.
3. Restart the API container.
4. Verify health and data integrity.

## 8. Deployment record format

Each deployment and rollback should produce a record containing:

- Environment (`beta`, `staging`, `production`)
- Version (`vX.Y.Z`)
- Source/release SHA
- API image digest
- Frontend image digest
- Host
- Compose project name and volume name
- Backup artifact path and checksum
- Compose file hash
- Timestamp
- Smoke check results

Records are stored on the EC2 host and optionally pushed to a central log.
