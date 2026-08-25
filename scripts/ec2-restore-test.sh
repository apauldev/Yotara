#!/bin/bash
set -euo pipefail

# Disposable restore test for Yotara backup
# Usage: ./ec2-restore-test.sh [/opt/backups/yotara-YYYY-MM-DD*.db]
# Creates a throwaway volume/stack, verifies DB opens and has expected tables.

BACKUP_FILE="${1:-$(readlink -f /opt/backups/yotara-latest.db 2>/dev/null || echo /opt/backups/yotara-latest.db)}"
RESTORE_VOLUME="${RESTORE_VOLUME:-yotara_api_data_restore}"
RESTORE_PROJECT="${RESTORE_PROJECT:-yotara-restore}"
COMPOSE_FILE="${COMPOSE_FILE:-}"
if [ -z "$COMPOSE_FILE" ]; then
  for _f in "$HOME/docker-compose.hub.yml" ./docker-compose.hub.yml ./docker-compose.yml "$HOME/docker-compose.yml"; do
    if [ -f "$_f" ]; then COMPOSE_FILE="$_f"; break; fi
  done
  COMPOSE_FILE="${COMPOSE_FILE:-$HOME/docker-compose.hub.yml}"
fi

compose() { docker compose "$@" 2>/dev/null || docker-compose "$@"; }

if [ ! -f "$BACKUP_FILE" ]; then
  echo "[restore-test] backup not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "[restore-test] backup=$BACKUP_FILE volume=$RESTORE_VOLUME project=$RESTORE_PROJECT"

# Create disposable volume and copy backup in
docker volume create "$RESTORE_VOLUME" >/dev/null
cleanup() {
  echo "[restore-test] cleaning up volume $RESTORE_VOLUME"
  docker volume rm -f "$RESTORE_VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run --rm -v "$RESTORE_VOLUME:/data" -v "$(dirname "$BACKUP_FILE"):/backups:ro" alpine:3.21 sh -c "cp /backups/$(basename "$BACKUP_FILE") /data/yotara.db && chown 1000:1000 /data /data/yotara.db && rm -f /data/yotara.db-shm /data/yotara.db-wal && ls -lh /data/yotara.db && echo '[restore-test] copied to volume (chown 1000)'"

# Verify sqlite integrity and that key tables exist
docker run --rm -v "$RESTORE_VOLUME:/data" alpine:3.21 sh -c "apk add --no-cache sqlite >/dev/null && sqlite3 /data/yotara.db 'PRAGMA integrity_check;' | grep -q '^ok$' && echo '[restore-test] integrity ok' && sqlite3 /data/yotara.db 'SELECT count(*) FROM \"user\"; SELECT count(*) FROM tasks;' | head -5"

# Optionally start API against restored DB to verify startup (needs secret)
if [ -n "${BETTER_AUTH_SECRET:-}" ]; then
  echo "[restore-test] starting disposable stack $RESTORE_PROJECT against restored volume"
  # Create override that uses restore volume (declare external volume)
  cat > /tmp/restore-override.yml <<EOF
volumes:
  ${RESTORE_VOLUME}:
    external: true
services:
  api:
    volumes:
      - ${RESTORE_VOLUME}:/app/apps/api/data
EOF
  BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" RESEND_API_KEY="${RESEND_API_KEY:-dummy}" DEV_MODE="${DEV_MODE:-true}" ALLOW_DEV_MODE_IN_PRODUCTION="${ALLOW_DEV_MODE_IN_PRODUCTION:-true}" \
    compose -p "$RESTORE_PROJECT" -f "$COMPOSE_FILE" -f /tmp/restore-override.yml up -d api 2>&1 | tail -10
  sleep 5
  docker logs "${RESTORE_PROJECT}_api_1" 2>&1 | tail -20 || docker logs "${RESTORE_PROJECT}-api-1" 2>&1 | tail -20 || true
  if docker ps --format '{{.Names}}' | grep -q "$RESTORE_PROJECT"; then
    echo "[restore-test] checking health via exec"
    HEALTH_OUTPUT=$(docker exec "${RESTORE_PROJECT}_api_1" wget -qO- http://localhost:3000/health 2>&1 || docker exec "${RESTORE_PROJECT}-api-1" wget -qO- http://localhost:3000/health 2>&1 || true)
    echo "$HEALTH_OUTPUT" | head -5
    if echo "$HEALTH_OUTPUT" | grep -q '"status":"ok"'; then
      echo "[restore-test] health ok"
    else
      echo "[restore-test] health check FAILED" >&2
      echo "[restore-test] stopping disposable stack (after failure)"
      compose -p "$RESTORE_PROJECT" -f "$COMPOSE_FILE" -f /tmp/restore-override.yml down -v 2>&1 | tail -5 || true
      rm -f /tmp/restore-override.yml
      exit 1
    fi
    echo "[restore-test] stopping disposable stack"
    compose -p "$RESTORE_PROJECT" -f "$COMPOSE_FILE" -f /tmp/restore-override.yml down -v 2>&1 | tail -5 || true
  else
    echo "[restore-test] API container not running — health check FAILED" >&2
    compose -p "$RESTORE_PROJECT" -f "$COMPOSE_FILE" -f /tmp/restore-override.yml down -v 2>&1 | tail -5 || true
    rm -f /tmp/restore-override.yml
    exit 1
  fi
  rm -f /tmp/restore-override.yml
else
  echo "[restore-test] BETTER_AUTH_SECRET not set — skipping live API start (volume integrity already verified)"
fi

echo "[restore-test] OK $BACKUP_FILE -> $RESTORE_VOLUME (disposable, now removed)"
