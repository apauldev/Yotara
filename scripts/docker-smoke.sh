#!/usr/bin/env bash
set -euo pipefail

base_url="${DOCKER_SMOKE_BASE_URL:-http://localhost:8080}"
attempts="${DOCKER_SMOKE_ATTEMPTS:-60}"
delay_ms="${DOCKER_SMOKE_DELAY_MS:-1000}"
sleep_seconds="$(awk "BEGIN { printf \"%.3f\", ${delay_ms} / 1000 }")"

docker_request() {
  local service="$1"
  local url="$2"
  local attempt output status body output_file
  output_file="$(mktemp)"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if docker-compose exec -T "$service" node -e "
        const url = process.argv[1];
        fetch(url)
          .then(async (response) => {
            console.log('STATUS:' + response.status);
            console.log('BODY:');
            process.stdout.write(await response.text());
          })
          .catch((error) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
          });
      " "$url" >"$output_file"; then
      output="$(cat "$output_file")"
      status="$(grep '^STATUS:' <<<"$output" | head -n1 | cut -d: -f2)"
      body="$(tail -n +3 <<<"$output")"

      if [[ "$status" == "502" && "$attempt" -lt "$attempts" ]]; then
        sleep "$sleep_seconds"
        continue
      fi

      rm -f "$output_file"
      printf '%s\n%s' "$status" "$body"
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

api_response() {
  local path="$1"
  docker_request api "http://localhost:3000${path}"
}

frontend_response() {
  docker_request api 'http://frontend/'
}

result="$(frontend_response)"
body="${result#*$'\n'}"
grep -q '<app-root>' <<<"$body" || {
  printf 'Frontend root page did not include the app root placeholder\n' >&2
  exit 1
}

result="$(api_response '/health')"
status="${result%%$'\n'*}"
body="${result#*$'\n'}"
[[ "$status" == "200" ]] || {
  printf 'Expected /api/health to return 200, got %s\n' "$status" >&2
  exit 1
}
grep -q '"status":"ok"' <<<"$body" || {
  printf 'API health did not report ok\n' >&2
  exit 1
}

result="$(api_response '/docs')"
status="${result%%$'\n'*}"
body="${result#*$'\n'}"
[[ "$status" == "200" ]] || {
  printf 'Expected /docs to return 200, got %s\n' "$status" >&2
  exit 1
}
grep -q 'Swagger UI' <<<"$body" || {
  printf 'Docs page did not look like Swagger UI\n' >&2
  exit 1
}

result="$(api_response '/docs/openapi.json')"
status="${result%%$'\n'*}"
body="${result#*$'\n'}"
[[ "$status" == "200" ]] || {
  printf 'Expected /docs/openapi.json to return 200, got %s\n' "$status" >&2
  exit 1
}
grep -q '"openapi":"3.1.0"' <<<"$body" || {
  printf 'OpenAPI document did not report version 3.1.0\n' >&2
  exit 1
}
grep -q '"/tasks"' <<<"$body" || {
  printf 'OpenAPI document did not include /tasks\n' >&2
  exit 1
}

result="$(api_response '/tasks')"
status="${result%%$'\n'*}"
body="${result#*$'\n'}"
[[ "$status" == "401" ]] || {
  printf 'Expected /api/tasks to return 401, got %s\n' "$status" >&2
  exit 1
}
grep -q '"Unauthorized"' <<<"$body" || {
  printf 'Unauthorized task response did not match expected shape\n' >&2
  exit 1
}

printf 'Docker smoke checks passed against %s\n' "$base_url"
