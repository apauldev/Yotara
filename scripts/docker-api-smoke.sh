#!/usr/bin/env bash
set -euo pipefail

compose_files=( -f docker-compose.yml )
if [[ -n "${DOCKER_SMOKE_COMPOSE_FILES:-}" ]]; then
  read -r -a compose_files <<<"${DOCKER_SMOKE_COMPOSE_FILES}"
fi

compose() {
  docker compose "${compose_files[@]}" "$@"
}

service="${DOCKER_SMOKE_SERVICE:-api}"
attempts="${DOCKER_SMOKE_ATTEMPTS:-60}"
delay_seconds="${DOCKER_SMOKE_DELAY_SECONDS:-1}"

for ((attempt = 1; attempt <= attempts; attempt++)); do
  state="$(compose ps "$service" --format '{{.State}}' 2>/dev/null || true)"
  if [[ "$state" == "running" ]]; then
    break
  fi

  if [[ "$attempt" -eq "$attempts" ]]; then
    printf 'Service "%s" did not become ready. Logs:\n' "$service" >&2
    compose logs "$service" >&2
    exit 1
  fi

  sleep "$delay_seconds"
done

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if compose exec -w /app/apps/api -T "$service" node --input-type=module -e "const response = await fetch('http://localhost:3000/health'); if (!response.ok) process.exit(1);" >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" -eq "$attempts" ]]; then
    printf 'API service did not become ready. Logs:\n' >&2
    compose logs "$service" >&2
    exit 1
  fi

  sleep "$delay_seconds"
done

compose exec -w /app/apps/api -T "$service" node --input-type=module <<'NODE'
import Database from 'better-sqlite3';

const database = new Database(':memory:');
database.exec('CREATE TABLE smoke_check (value TEXT NOT NULL)');
database.prepare('INSERT INTO smoke_check (value) VALUES (?)').run('loaded');
const row = database.prepare('SELECT value FROM smoke_check').get();
database.close();

if (row?.value !== 'loaded') {
  throw new Error(`better-sqlite3 query returned an unexpected value: ${JSON.stringify(row)}`);
}

console.log('better-sqlite3 loaded and executed a SQLite query');
NODE

compose exec -w /app/apps/api -T "$service" node --input-type=module <<'NODE'
const baseUrl = 'http://localhost:3000';

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { response, body };
}

const health = await request('/health');
if (!health.response.ok || health.body?.status !== 'ok') {
  throw new Error(`Health check failed: ${health.response.status} ${JSON.stringify(health.body)}`);
}

const email = `docker-smoke-${Date.now()}@example.test`;
const signup = await request('/auth/sign-up/email', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
  },
  body: JSON.stringify({
    email,
    password: 'SmokePassword123!',
    name: 'Docker Smoke Test',
  }),
});

if (!signup.response.ok) {
  throw new Error(`Sign-up failed: ${signup.response.status} ${JSON.stringify(signup.body)}`);
}

const cookies = signup.response.headers.getSetCookie?.() ?? [];
const cookie = cookies.map((value) => value.split(';', 1)[0]).join('; ');
if (!cookie) {
  throw new Error('Sign-up did not return a session cookie');
}

const create = await request('/tasks', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    cookie,
  },
  body: JSON.stringify({ title: 'Docker architecture smoke task' }),
});

if (create.response.status !== 201) {
  throw new Error(`Task creation failed: ${create.response.status} ${JSON.stringify(create.body)}`);
}

const list = await request('/tasks', { headers: { cookie } });
if (!list.response.ok || !Array.isArray(list.body?.data)) {
  throw new Error(`Task listing failed: ${list.response.status} ${JSON.stringify(list.body)}`);
}

if (!list.body.data.some((task) => task.title === 'Docker architecture smoke task')) {
  throw new Error(`Created task was not returned: ${JSON.stringify(list.body)}`);
}

console.log('Database-backed API request passed');
NODE

printf 'API Docker smoke checks passed for %s\n' "$service"
