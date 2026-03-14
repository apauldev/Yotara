# Yotra

**Yotara** — Delightful open-source task manager. Simple for you, seamless for small teams. Self-hosted with Angular + Fastify.

A lightweight, self-hosted task management application featuring a modern Angular frontend and a performant Fastify API backend, organized as a TypeScript monorepo with pnpm workspaces.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Development](#development)
- [Running in Production](#running-in-production)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **pnpm** 9.x or higher (run `npm install -g pnpm` to install globally)

## Project Structure

This is a monorepo organized with pnpm workspaces:

```
.
├── apps/
│   ├── api/                    # Fastify API backend
│   │   ├── src/
│   │   │   ├── server.ts       # Main server entry point
│   │   │   ├── plugins/        # Fastify plugins (CORS, etc.)
│   │   │   └── routes/         # API route handlers
│   │   └── package.json
│   └── frontend/               # Angular frontend application
│       ├── src/
│       │   ├── main.ts
│       │   ├── app/            # Angular components & services
│       │   └── environments/   # Environment-specific configs
│       └── package.json
├── packages/
│   └── shared/                 # Shared TypeScript types & utilities
└── package.json                # Workspace root package.json
```

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Yotra
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

   This installs dependencies for all workspaces (API, frontend, and shared packages).

## Development

### Run All Services (API + Frontend)

Start both the API server and frontend development server in parallel:

```bash
pnpm dev
```

This command runs:
- **Fastify API**: Available at `http://localhost:3000`
- **Angular Frontend**: Available at `http://localhost:4200`

### Run Individual Services

**Frontend Only:**
```bash
pnpm dev:frontend
```
- Serves Angular app at `http://localhost:4200`
- Configured to accept connections from all interfaces (`0.0.0.0`)

**API Only:**
```bash
pnpm dev:api
```
- Starts Fastify server at `http://localhost:3000`
- Uses tsx for hot-reloading TypeScript files

### Type Checking

Check for TypeScript errors across all packages:
```bash
pnpm typecheck
```

### Linting

Lint all packages:
```bash
pnpm lint
```

## Running in Production

### Build All Packages

```bash
pnpm build
```

This compiles TypeScript in all workspaces to JavaScript output:
- Frontend: Compiled to `dist/` folder
- API: Compiled to `dist/` folder in the API directory

### Start Production Servers

```bash
pnpm start
```

This starts all services in production mode. For individual services:

**Backend only:**
```bash
pnpm --filter @yotara/api start
```

**Frontend only:**
```bash
pnpm --filter @yotara/frontend start
```

## Available Scripts

### Root Scripts (Workspace)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm dev:frontend` | Start only the Angular frontend dev server |
| `pnpm dev:api` | Start only the Fastify API dev server |
| `pnpm build` | Build all packages for production |
| `pnpm start` | Start services in production mode |
| `pnpm lint` | Typecheck all packages |
| `pnpm typecheck` | Run TypeScript compiler in check-only mode |

### Backend Scripts (API)

Location: `apps/api/`

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API with hot-reloading (tsx watch) |
| `pnpm build` | Compile TypeScript to JavaScript |
| `pnpm start` | Run compiled API server |
| `pnpm lint` | Check for TypeScript errors |
| `pnpm typecheck` | Verify types without emitting |
| `pnpm test` | Run API integration tests |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:push` | Push schema to SQLite database |
| `pnpm db:studio` | Open Drizzle Studio |

### Frontend Scripts (Angular)

Location: `apps/frontend/`

| Command | Description |
|---------|-------------|
| `pnpm dev` | Serve Angular app with live reload |
| `pnpm start` | Serve Angular app on default port (4200) |
| `pnpm build` | Build optimized production bundle |
| `pnpm watch` | Build in watch mode during development |
| `pnpm test` | Run Karma test runner |
| `pnpm lint` | Check TypeScript types |
| `pnpm typecheck` | Verify all types |

## Environment Variables

### Fastify API (`apps/api/`)

Configure the API server using these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `./data/yotara.db` | SQLite database file location |
| `BETTER_AUTH_SECRET` | (Generated) | Encryption secret for Better Auth sessions |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Base URL for the API server |
| `PORT` | `3000` | Port for the API server |
| `HOST` | `0.0.0.0` | Host/IP address to bind to |

**Example:**
```bash
DATABASE_URL=./data/yotara.db PORT=3001 HOST=localhost pnpm dev:api
```

On first startup, the API will create the SQLite file and initialize the required auth and task tables automatically.

### Angular Frontend (`apps/frontend/`)

Configuration is handled in `src/environments/`:

- `environment.ts` — Development configuration
- `environment.prod.ts` — Production configuration

Environment configuration is referenced in `app.config.ts`.

## API Documentation

### Base URL

- **Development**: `http://localhost:3000`
- **Production**: Configure based on deployment

### Authentication

**Endpoints Mounted at:** `/auth/*`

Handled by Better Auth. Common routes include:
- `POST /auth/sign-in/email`: Sign in with email/password
- `POST /auth/sign-up/email`: Register a new user
- `GET /auth/get-session`: Retrieve the current session
- `POST /auth/sign-out`: Terminate the session

**Protected User Info:** `GET /me` (Returns current user session if authenticated)

### Health Check

**Endpoint:** `GET /health`

Returns basic health status. Used to verify API is running.

### Tasks (Protected)

**Endpoints:** `GET /tasks`, `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`

Routes are defined in `apps/api/src/routes/tasks.ts` and use Drizzle ORM with SQLite.

**Type Definition:** See `packages/shared/src/index.ts` for the `Task` type definition.

### CORS Configuration

CORS is enabled in development to allow requests from `http://localhost:4200` (Angular dev server). Configuration is in `apps/api/src/plugins/cors.ts`.

## Troubleshooting

### "pnpm: command not found"

Install pnpm globally:
```bash
npm install -g pnpm
```

### Port already in use

If port 3000 or 4200 is already occupied:

**For API (change port 3000):**
```bash
PORT=3001 pnpm dev:api
```

**For Frontend (change port 4200):**
```bash
ng serve --port 4300
```

Or kill the process using the port:
```bash
# Find process on port
lsof -i :3000

# Kill process by PID
kill -9 <PID>
```

### CORS errors

If the frontend can't communicate with the API:
1. Ensure both servers are running
2. Check the API is accessible at `http://localhost:3000`
3. Verify CORS plugin is loaded in `apps/api/src/server.ts`
4. Update CORS configuration in `apps/api/src/plugins/cors.ts` if needed

### Dependencies not installing

Clear the pnpm cache and reinstall:
```bash
pnpm store prune
pnpm install
```

### TypeScript errors

Ensure all dependencies are installed:
```bash
pnpm install
pnpm typecheck
```

## License

See [LICENSE](./LICENSE) for details.
