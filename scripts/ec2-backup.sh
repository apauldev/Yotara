#!/bin/bash
set -euo pipefail

# WAL-safe SQLite backup for Yotara EC2 (single volume ubuntu_yotara_api_data)
# Uses sqlite3 online .backup (not cp) so -wal/-shm are handled.
# For beta: daily host cron, local /opt/backups + manual scp off-instance.
# For prod: add age encryption + S3/R2 upload.

VOLUME="${VOLUME:-ubuntu_yotara_api_data}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/yotara-$TIMESTAMP.db"
LATEST_LINK="$BACKUP_DIR/yotara-latest.db"

mkdir -p "$BACKUP_DIR"

echo "[backup] $TIMESTAMP volume=$VOLUME -> $BACKUP_FILE"

# Online backup via sqlite3 in ephemeral alpine container (WAL-safe)
docker run --rm \
  -v "${VOLUME}:/data:ro" \
  -v "${BACKUP_DIR}:/backups" \
  alpine sh -c "apk add --no-cache sqlite >/dev/null && sqlite3 /data/yotara.db \".backup /backups/$(basename "$BACKUP_FILE")\" && echo \"[backup] sqlite3 .backup ok\""

# Verify integrity and checksum
echo "[verify] PRAGMA integrity_check"
docker run --rm -v "${BACKUP_DIR}:/backups" alpine sh -c "apk add --no-cache sqlite >/dev/null && sqlite3 /backups/$(basename "$BACKUP_FILE") 'PRAGMA integrity_check;' | grep -q '^ok$' && echo '[verify] integrity_check ok' || (echo '[verify] integrity_check FAILED' && exit 1)"

sha256sum "$BACKUP_FILE" | tee "$BACKUP_FILE.sha256"
ln -sf "$(basename "$BACKUP_FILE")" "$LATEST_LINK"
ln -sf "$(basename "$BACKUP_FILE").sha256" "$LATEST_LINK.sha256"

# Optional: age encryption if AGE_RECIPIENT is set (pubkey age1...)
UPLOAD_FILE="$BACKUP_FILE"
if [ -n "${AGE_RECIPIENT:-}" ]; then
  if ! command -v age >/dev/null 2>&1; then
    echo "[encrypt] AGE_RECIPIENT set but 'age' not installed — refusing to upload plaintext" >&2
    exit 1
  fi
  age -r "$AGE_RECIPIENT" -o "$BACKUP_FILE.age" "$BACKUP_FILE"
  echo "[encrypt] $BACKUP_FILE.age"
  sha256sum "$BACKUP_FILE.age" | tee "$BACKUP_FILE.age.sha256" >/dev/null
  ln -sf "$(basename "$BACKUP_FILE.age")" "$BACKUP_DIR/yotara-latest.db.age" 2>/dev/null || true
  UPLOAD_FILE="$BACKUP_FILE.age"
fi

# Optional: S3/R2 upload if configured (requires aws cli + env)
if [ -n "${S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  aws s3 cp "$UPLOAD_FILE" "s3://${S3_BUCKET}/daily/$(basename "$UPLOAD_FILE")" ${AWS_S3_EXTRA_ARGS:-} && echo "[upload] s3://${S3_BUCKET}/daily/$(basename "$UPLOAD_FILE")"
fi

echo "[backup] done $BACKUP_FILE"
ls -lh "$BACKUP_FILE" "$BACKUP_FILE.sha256"

# Retention: keep 7 daily local (simple) — delete without head to avoid SIGPIPE
RETENTION_DAYS="${RETENTION_DAYS:-7}"
if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  find "$BACKUP_DIR" -name 'yotara-*.db' -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null || true
  find "$BACKUP_DIR" -name 'yotara-*.db.sha256' -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null || true
  find "$BACKUP_DIR" -name 'yotara-*.db.age' -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null || true
  find "$BACKUP_DIR" -name 'yotara-*.db.age.sha256' -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null || true
fi
