#!/usr/bin/env bash
set -euo pipefail

# Smoke test that runs against the published host port (via nginx), so the
# real routing path — host -> nginx -> containers — is exercised. Previously
# the checks fetched from INSIDE the containers with `docker compose exec`,
# which never tested port publishing or the nginx proxy config.
base_url="${DOCKER_SMOKE_BASE_URL:-http://localhost:8080}"
attempts="${DOCKER_SMOKE_ATTEMPTS:-60}"
delay_ms="${DOCKER_SMOKE_DELAY_MS:-1000}"
sleep_seconds="$(awk "BEGIN { printf \"%.3f\", ${delay_ms} / 1000 }")"

# Fetch a URL from the host. Prints "STATUS" on the first line and the body
# after it. Retries while the stack is still starting (curl errors / 502).
host_request() {
  local url="$1"
  local attempt status output_file
  output_file="$(mktemp)"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if status="$(curl -sS -o "$output_file" -w '%{http_code}' "$url" 2>/dev/null)"; then
      if [[ "$status" == "502" && "$attempt" -lt "$attempts" ]]; then
        sleep "$sleep_seconds"
        continue
      fi

      printf '%s\n' "$status"
      cat "$output_file"
      rm -f "$output_file"
      return 0
    fi

    if [[ "$attempt" -lt "$attempts" ]]; then
      sleep "$sleep_seconds"
    fi
  done

  rm -f "$output_file"
  printf 'Failed to fetch %s\n' "$url" >&2
  return 1
}

check() {
  local path="$1"
  local expected_status="$2"
  local url="${base_url}${path}"
  local result status body

  result="$(host_request "$url")"
  status="$(head -n 1 <<<"$result")"
  body="$(tail -n +2 <<<"$result")"

  [[ "$status" == "$expected_status" ]] || {
    printf 'Expected %s to return %s, got %s\n' "$url" "$expected_status" "$status" >&2
    exit 1
  }

  printf '%s\n' "$body"
}

body="$(check '/' 200)"
grep -q '<app-root>' <<<"$body" || {
  printf 'Frontend root page did not include the app root placeholder\n' >&2
  exit 1
}

body="$(check '/api/health' 200)"
grep -q '"status":"ok"' <<<"$body" || {
  printf 'API health did not report ok\n' >&2
  exit 1
}

body="$(check '/docs' 200)"
grep -q 'Swagger UI' <<<"$body" || {
  printf 'Docs page did not look like Swagger UI\n' >&2
  exit 1
}

body="$(check '/docs/openapi.json' 200)"
grep -q '"openapi":"3.1.0"' <<<"$body" || {
  printf 'OpenAPI document did not report version 3.1.0\n' >&2
  exit 1
}
grep -q '"/tasks"' <<<"$body" || {
  printf 'OpenAPI document did not include /tasks\n' >&2
  exit 1
}

body="$(check '/api/tasks' 401)"
grep -q '"Unauthorized"' <<<"$body" || {
  printf 'Unauthorized task response did not match expected shape\n' >&2
  exit 1
}

printf 'Docker smoke checks passed against %s\n' "$base_url"
