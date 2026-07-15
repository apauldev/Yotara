# Setup & Install Experience — Implementation Plan

> **Status:** Proposed draft. Not yet started.
> **Owner:** @apauldev
> **Estimated total effort:** 12–16 engineering days
> **Supersedes:** ROADMAP §P2a, ARCHITECTURE.md §Backlog (setup/admin items)

---

## Table of Contents

1. [Overview](#overview)
2. [Avatar Design: 32 Nature Icons × 8 Colors](#avatar-design-32-nature-icons--8-colors)
3. [Phase 1 — Admin Role Model](#phase-1--admin-role-model)
4. [Phase 2 — DB Tables](#phase-2--db-tables)
5. [Phase 3 — First-Run Detection & Setup Status](#phase-3--first-run-detection--setup-status)
6. [Phase 4 — Setup Wizard](#phase-4--setup-wizard)
7. [Phase 5 — Avatar System](#phase-5--avatar-system)
8. [Phase 6 — Recovery Hash Flow](#phase-6--recovery-hash-flow)
9. [Phase 7 — Security Questions](#phase-7--security-questions)
10. [Phase 8 — Admin-Gated User Password Reset](#phase-8--admin-gated-user-password-reset)
11. [Phase 9 — Admin Settings Panel](#phase-9--admin-settings-panel)
12. [Phase 10 — Notification Bell Wiring](#phase-10--notification-bell-wiring)
13. [Effort & Dependency Graph](#effort--dependency-graph)
14. [Security Summary](#security-summary)
15. [Rollback Plan](#rollback-plan)
16. [Env Vars Reference](#env-vars-reference)

---

## Overview

### What this covers

Yotara currently has no setup flow — the app boots straight to login, every user is equal, there is no admin concept, email is required for registration, and there is no password recovery mechanism for email-less environments.

This plan adds:

| Feature | Problem | Solution | Effort |
|---|---|---|---|
| **Admin role** | No privileged user | First user = admin, role in every profile | 1 day |
| **Setup wizard** | No first-run experience | 6-step wizard at `/setup`, revisit-able by admin | 3-4 days |
| **Avatars** | No user identity | 32 nature icons × 8 colors, deterministic per user, photo upload later | 2-3 days |
| **Recovery hash** | Admin password recovery without email | One-time 32-char recovery hash shown during setup | 1-2 days |
| **Security questions** | Admin password recovery fallback | 3 of 5 randomly selected questions, 3-strike lockout | 1-2 days |
| **Username mode** | Self-hosted email-less auth | Better-auth username plugin, synthetic emails | 2 days |
| **User password reset** | No password recovery in username mode | Admin-gated reset requests with approval flow | 2-3 days |
| **Admin panel** | No instance management | `/admin` route for users, requests, instance settings | 1-2 days |
| **Notification bell** | No indicator of pending admin actions | Badge on bell icon, polling for pending reset requests | 1 day |

---

## Avatar Design: 32 Nature Icons × 8 Colors

### Design principles

Each icon is a simple, single-color SVG (viewBox `0 0 128 128`, `fill="currentColor"`). The color is applied via CSS so the same SVG works in both light and dark themes. Icons are nature-themed to match Yotara's forest/earth aesthetic (Light Forest, Dark Forest, Coastal Calm, Minimal Slate, Midnight Amethyst, Golden Hour, Deep Trench).

### The 8 avatar colors

| # | Name | Hex (light) | Hex (dark bg variant) | Theme affinity |
|---|------|-------------|----------------------|----------------|
| 1 | Forest Sage | `#5aa37d` | `#6bc490` | Light/Dark Forest |
| 2 | Coastal Teal | `#4a9eb8` | `#5ab8d4` | Coastal Calm |
| 3 | Slate Gray | `#8b8c9a` | `#a0a1b0` | Minimal Slate |
| 4 | Amethyst | `#9b7bbd` | `#b494d6` | Midnight Amethyst |
| 5 | Golden Amber | `#d4a04a` | `#e0b060` | Golden Hour |
| 6 | Deep Ocean | `#4a7c9e` | `#5a94b8` | Deep Trench |
| 7 | Clay/Copper | `#c77d5e` | `#d89474` | Universal earthy |
| 8 | Moss Green | `#6b8c6b` | `#7ea07e` | Universal forest |

Each icon + color combination is assigned deterministically via `hashCode(name) % 32` for the icon index and `hashCode(name + '_color') % 8` for the color index. Every user gets a consistent, unique avatar immediately upon signup, with no upload needed.

### The 32 nature icons

Each is a clean 128×128 SVG path:

**Forest Mammals (1-10):**
1. **Fox** — Pointed ears, triangular face, curved tail
2. **Deer** — Antlers, rounded snout, four legs
3. **Owl** — Round body, ear tufts, big eyes
4. **Rabbit** — Long ears, round body, small tail
5. **Squirrel** — Bushy tail, small ears, acorn shape
6. **Bear** — Round ears, broad body, paw
7. **Hedgehog** — Spiky back, small snout
8. **Wolf** — Pointed ears, howling silhouette
9. **Moose** — Broad antlers, humped back
10. **Badger** — Striped face, low body, claw

**Birds (11-18):**
11. **Robin** — Round bird, red breast hint (via color)
12. **Blue Jay** — Crested head, perched
13. **Cardinal** — Crested, perched on branch
14. **Heron** — Long legs, long neck, standing in water
15. **Swan** — Curved neck, graceful wings
16. **Raven** — Sleek, sharp beak
17. **Hawk** — Wide wings, talons
18. **Hummingbird** — Small, hovering, long beak

**Insects & Small Creatures (19-24):**
19. **Otter** — Long body, whiskers, swimming
20. **Frog** — Round body, big eyes, sitting
21. **Turtle** — Shell, four legs, head poking out
22. **Butterfly** — Two wings, antennae
23. **Dragonfly** — Four narrow wings, long body
24. **Bee** — Round body, stripes, wings

**Garden & Forest Floor (25-28):**
25. **Ladybug** — Round, spots
26. **Firefly** — Oval body, glowing tail
27. **Oak Leaf** — Lobed leaf shape
28. **Maple Leaf** — Pointed leaf shape

**Landscape & Sky (29-32):**
29. **Mushroom** — Cap, stem, spots
30. **Fern** — Curled frond
31. **Mountain** — Three peaks, snow caps
32. **Moon** — Crescent with small stars

### Example SVG — Bear

```svg
<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <circle cx="64" cy="72" r="28" fill="currentColor"/>
  <circle cx="64" cy="38" r="20" fill="currentColor"/>
  <circle cx="48" cy="22" r="8" fill="currentColor"/>
  <circle cx="80" cy="22" r="8" fill="currentColor"/>
  <ellipse cx="42" cy="96" rx="8" ry="6" fill="currentColor"/>
  <ellipse cx="86" cy="96" rx="8" ry="6" fill="currentColor"/>
</svg>
```

---

## Phase 1 — Admin Role Model

**Goal:** First registered user is admin. Role exposed everywhere.
**Effort:** 1 day
**Dependencies:** None
**Risk:** Low — adds a field, doesn't change existing auth flow

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/db/client.ts` | Add `role TEXT NOT NULL DEFAULT 'member'` to `SQLITE_BOOTSTRAP_SQL` `user` table |
| `apps/api/src/db/client.ts` | Add column guard: `if (!columnNames.has('role')) { ... }` |
| `apps/api/src/db/schema.ts` | Add `role: text('role', { enum: ['admin', 'member'] }).notNull().default('member')` |
| `apps/api/src/lib/public-user.ts` | Add `role: 'admin' \| 'member'` to `PublicUser`, expose in `toPublicUser()` |
| `apps/api/src/plugins/auth-bridge.ts` | On signup: `SELECT COUNT(*) FROM user` → if 0, set `role = 'admin'` |
| `apps/api/src/docs/openapi.ts` | Update `MeResponse` + `UpdateProfile` schemas for `role` |
| `apps/api/src/routes/admin.ts` | New file: admin endpoints (see Phase 9) |
| `packages/shared/src/index.ts` | Add `role` to shared `User` type |
| `apps/frontend/src/app/core/services/auth-state.service.ts` | Add `isAdmin = computed(() => this.user()?.role === 'admin')` |
| `apps/frontend/src/app/core/guards/admin.guard.ts` | New file: check `authState.isAdmin()`, redirect if not |

### Implementation steps

1. **Update DB schema** — Add `role` column to `user` table in both `schema.ts` (Drizzle) and `client.ts` (raw SQL bootstrap)
2. **Update public user** — Add `role` to `PublicUser` type and `toPublicUser()` mapper
3. **Add admin promotion in auth-bridge** — After successful signup from better-auth:
   ```typescript
   const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number };
   if (userCount.count === 1) {
     sqlite.prepare('UPDATE user SET role = ? WHERE id = ?').run('admin', userId);
   }
   ```
4. **Update frontend types** — Add `role` to shared `User` type
5. **Expose `isAdmin`** — Add computed signal in `AuthStateService`
6. **Create `admin.guard.ts`**
   ```typescript
   export const adminGuard: CanActivateFn = async () => {
     const authState = inject(AuthStateService);
     const router = inject(Router);
     await authState.initialize();
     if (!authState.isAdmin()) return router.parseUrl('/inbox');
     return true;
   };
   ```

### Checkpoint CP-1

> **When this is done:**
> - First user to register gets `role = 'admin'`
> - All subsequent users get `role = 'member'`
> - `/me` returns `role: 'admin'` for the first user
> - Frontend `AuthStateService.isAdmin()` returns true for admin
> - `admin.guard` redirects non-admin users
> - All existing auth tests pass

---

## Phase 2 — DB Tables

**Goal:** Storage for instance settings, admin recovery, and password reset requests.
**Effort:** 0.5 day
**Dependencies:** Phase 1 (role concept)
**Risk:** Low — new tables only

### New tables in `SQLITE_BOOTSTRAP_SQL` (apps/api/src/db/client.ts)

#### instance_settings

Stores instance-wide configuration set during setup wizard.

```sql
CREATE TABLE IF NOT EXISTS instance_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

Keys:
- `auth_mode` — `'email'` or `'username'`
- `default_theme` — e.g. `'light-forest'`
- `default_capture_behavior` — `'quick'` or `'capture'`
- `setup_completed` — `'true'` or `'false'`
- `recovery_hash_created_at` — ISO timestamp when hash was generated

#### admin_recovery

Stores recovery hash and security questions for admin password recovery.

```sql
CREATE TABLE IF NOT EXISTS admin_recovery (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('security_question', 'recovery_hash')),
  question TEXT,
  answer_hash TEXT,
  hash_value TEXT,
  used INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL
);
```

- For `type = 'recovery_hash'`: `hash_value` stores SHA-256 of the recovery hash, `question` and `answer_hash` are NULL
- For `type = 'security_question'`: `question` stores the question text, `answer_hash` stores `salt:sha256`, `hash_value` is NULL
- `used = 1` after successful use (hash is single-use, questions are single-use-per-recovery-cycle)
- `failed_attempts` is incremented on each wrong answer across both types
- `locked_until` is set when `failed_attempts >= 3`

#### password_reset_requests

Queue of pending admin-gated password reset requests from non-admin users.

```sql
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  reset_token TEXT,
  token_expires_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
```

### Checkpoint CP-2

> **When this is done:**
> - Three new tables exist in the SQLite DB
> - `instance_settings` can be read/written
> - `admin_recovery` can store hash + questions
> - `password_reset_requests` can store pending requests
> - All existing tests pass

---

## Phase 3 — First-Run Detection & Setup Status

**Goal:** Detect when no users exist and expose setup state.
**Effort:** 1 day
**Dependencies:** Phase 2 (instance_settings table)
**Risk:** Low — new endpoints, doesn't change existing routes

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/lib/first-run.ts` | `isFirstRun()`, `getAuthMode()`, `getSetupStatus()` helpers |

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/routes/setup.ts` | New route file: `GET /setup/status`, `GET /setup`, `POST /setup/complete` |
| `apps/api/src/server.ts` | Register setup routes |

### Implementation

**`apps/api/src/lib/first-run.ts`:**
```typescript
import { sqlite } from '../db/client.js';

export function isFirstRun(): boolean {
  const row = sqlite.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number };
  return row.count === 0;
}

export function getAuthMode(): 'email' | 'username' {
  const row = sqlite.prepare("SELECT value FROM instance_settings WHERE key = 'auth_mode'").get() as { value: string } | undefined;
  return (row?.value as 'email' | 'username') ?? 'email';
}

export function getSetupStatus(): { needsSetup: boolean; authMode: 'email' | 'username'; hasAdmin: boolean } {
  return {
    needsSetup: isFirstRun(),
    authMode: getAuthMode(),
    hasAdmin: !isFirstRun(),
  };
}
```

**`apps/api/src/routes/setup.ts`:**
- `GET /setup/status` — public, no auth. Returns `{ needsSetup, authMode, hasAdmin }`.
  - Used by the frontend setup guard to decide whether to redirect to `/setup`
  - Used by the login component to determine email vs username mode
- `GET /setup` — admin-only. Returns full setup state: `{ defaultTheme, defaultCaptureBehavior, authMode, recoveryHashExists, securityQuestionsExist }`
- `POST /setup/complete` — admin-only or first-run (no auth). Body includes all wizard fields.

### Frontend: Setup Guard

**`apps/frontend/src/app/core/guards/setup.guard.ts`:**
```typescript
export const setupGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const authState = inject(AuthStateService);

  const status = await firstValueFrom(http.get<SetupStatus>('/setup/status'));

  if (status.needsSetup && !route.url.toString().startsWith('setup')) {
    return router.parseUrl('/setup');
  }

  if (!status.needsSetup && route.url.toString().startsWith('setup')) {
    if (!authState.isAdmin()) return router.parseUrl('/login');
  }

  return true;
};
```

### Checkpoint CP-3

> **When this is done:**
> - Fresh DB with no users → `GET /setup/status` returns `{ needsSetup: true }`
> - After setup → returns `{ needsSetup: false }`
> - Frontend guard redirects to `/setup` when no users exist
> - Login component can detect email vs username mode from `/setup/status`
> - Admin can access `/setup` after initial setup

---

## Phase 4 — Setup Wizard

**Goal:** 6-step wizard at `/setup` for first-run admin account creation and instance configuration.
**Effort:** 3-4 days
**Dependencies:** Phase 2 (tables), Phase 3 (status endpoint)
**Risk:** Low — new flow, doesn't change existing auth

### Files to create

| File | Purpose |
|---|---|
| `apps/frontend/src/app/features/setup/setup-wizard.component.ts` | Multi-step wizard component |
| `apps/frontend/src/app/features/setup/setup-wizard.component.html` | Step templates |
| `apps/frontend/src/app/features/setup/setup-wizard.component.css` | Styling |

### Files to modify

| File | Change |
|---|---|
| `apps/frontend/src/app/app.routes.ts` | Add `/setup` route with `setupGuard` |
| `apps/api/src/routes/setup.ts` | Complete `POST /setup/complete` handler |

### Route

```typescript
{
  path: 'setup',
  loadComponent: () => import('./features/setup/setup-wizard.component').then(m => m.SetupWizardComponent),
  canActivate: [setupGuard],
}
```

### Wizard steps (6 steps in `SetupWizardComponent`)

State tracked as a signal object:
```typescript
type SetupState = {
  step: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  email: string;       // or username
  password: string;
  authMode: 'email' | 'username';
  securityQuestions: Array<{ question: string; answer: string }>;
  recoveryHash: string | null;
  recoveryHashDisplay: string | null;
  recoveryHashSaved: boolean;
  defaultTheme: Theme;
  defaultCaptureBehavior: 'quick' | 'capture';
};
```

#### Step 1: Welcome + Admin Account

```
┌──────────────────────────────────────┐
│  Welcome to Yotara                   │
│                                      │
│  You're the first user — you'll be   │
│  the admin of this instance.         │
│                                      │
│  Name:    [________________________] │
│  Email:   [________________________] │
│  Password: [________________________] │
│  Confirm: [________________________] │
│                                      │
│  [Continue]                          │
└──────────────────────────────────────┘
```

- Name: required, min 2 chars
- Email: required, valid email format (or username hint: "email is used for password recovery — set up security questions if you prefer username mode")
- Password: required, min 8 chars
- Confirm: must match password
- Validation on blur, full validation on submit

#### Step 2: Authentication Mode

```
┌──────────────┐  ┌──────────────────┐
│ 📧           │  | 👤               │
│ Email Mode   │  │ Self-Hosted Mode │
│              │  │ (Usernames)      │
│ Users register│  │ Users register   │
│ with email.   │  │ with username.   │
│ Password      │  │ No email needed. │
│ reset via     │  │ Admin handles    │
│ email links.  │  │ password resets. │
│              │  │                  │
│ [Select]     │  │ [Select]         │
└──────────────┘  └──────────────────┘
```

- Two large cards with radio selection
- If email selected → skip to Step 5
- If username selected → continue to Step 3

#### Step 3: Security Questions (username mode only)

```
┌──────────────────────────────────────┐
│  Security Questions                  │
│                                      │
│  Pick 5 questions and provide        │
│  answers. These let you reset your   │
│  password if you forget it.          │
│                                      │
│  Question 1: [▼ What was the name...]│
│  Answer 1:   [______________________]│
│  Question 2: [▼ What was your chi...]│
│  Answer 2:   [______________________]│
│  Question 3: [▼ Select...          ] │
│  Answer 3:   [______________________]│
│  Question 4: [▼ Select...          ] │
│  Answer 4:   [______________________]│
│  Question 5: [▼ Select...          ] │
│  Answer 5:   [______________________]│
│                                      │
│  [Back]  [Continue]                  │
└──────────────────────────────────────┘
```

- Dropdown per question selects from 12-question bank (no duplicates)
- Answer: min 3 chars, max 100 chars
- On continue: randomly pick 2 of the 5, ask admin to re-enter answers for verification
- If verification fails: show which answers didn't match, let admin retry

The 12 questions:
1. What was the name of your first pet?
2. What was your childhood nickname?
3. What street did you grow up on?
4. What was the name of your elementary school?
5. What is your mother's maiden name?
6. What was the name of your first best friend?
7. What city were you born in?
8. What is your favorite book?
9. What was the model of your first car?
10. What is the name of your favorite teacher?
11. What is your grandfather's occupation?
12. What is the name of the hospital you were born in?

#### Step 4: Recovery Hash (username mode only)

```
┌──────────────────────────────────────┐
│  ⚠️ Recovery Hash — SAVE THIS       │
│                                      │
│  This is your emergency password     │
│  recovery code. It will NEVER be     │
│  shown again after this screen.      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ X7K9-M2P4-R6Q8-A1C3           │  │
│  │ E5G7-H9J2-L4N6-P8R1           │  │
│  └────────────────────────────────┘  │
│                                      │
│  [📋 Copy]  [🖨️ Print]              │
│                                      │
│  ☐ I have saved my recovery hash    │
│                                      │
│  [Back]  [Continue →]               │
└──────────────────────────────────────┘
```

- Hash is 32 hex chars, displayed as 8 groups of 4: `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`
- Copy button writes to clipboard
- Print button opens print dialog
- Checkbox "I have saved this" must be checked to proceed
- After this step, the hash page cannot be re-visited (backend stores `setup_completed` and recovery hash is never returned again)

#### Step 5: Default Theme & Settings

```
┌──────────────────────────────────────┐
│  Personalize Your Instance           │
│                                      │
│  Default Theme:                      │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│  │ 🌿 │ │ 🌲 │ │ 🌊 │ │ 🏔 │       │
│  │Light│ │Dark │ │Coast│ │Slate│       │
│  └────┘ └────┘ └────┘ └────┘       │
│  ┌────┐ ┌────┐ ┌────┐              │
│  │ 🔮 │ │ 🌅 │ │ 🌊 │              │
│  │Ameth│ │Gold │ │Deep │              │
│  └────┘ └────┘ └────┘              │
│                                      │
│  Capture Behavior:                   │
│  ○ Quick Capture (default)           │
│  ○ Full Capture (open modal)         │
│                                      │
│  [Back]  [Continue]                  │
└──────────────────────────────────────┘
```

- Same 7 themes as Settings page, shown as colored cards with preview
- Capture behavior: radio buttons with description

#### Step 6: Complete

```
┌──────────────────────────────────────┐
│  ✅ Your Instance is Ready!          │
│                                      │
│  Summary:                            │
│  • Admin account: Admin Name         │
│  • Auth mode: Email / Username       │
│  • Recovery: Hash + Questions set    │
│  • Default theme: Light Forest       │
│                                      │
│  Redirecting to login in 5 seconds…  │
│                                      │
│  [Go to Login Now]                   │
└──────────────────────────────────────┘
```

- Auto-redirect after 5 seconds, or click button
- Sets `setup_completed = 'true'` in `instance_settings`

### POST /setup/complete handler

```typescript
fastify.post('/setup/complete', async (request, reply) => {
  const { name, email, password, authMode, securityQuestions, recoveryHash, defaultTheme, defaultCaptureBehavior } = request.body;

  // 1. Create admin user via better-auth API
  const signupResult = await auth.api.signUpEmail({
    body: { name, email, password },
    headers: fromNodeHeaders(request.headers),
  });

  if (!signupResult.user) {
    return reply.code(400).send({ message: 'Failed to create admin account' });
  }

  const userId = signupResult.user.id;

  // 2. Promote to admin
  sqlite.prepare('UPDATE user SET role = ? WHERE id = ?').run('admin', userId);

  // 3. If username mode: set synthetic email, emailVerified
  if (authMode === 'username') {
    const syntheticEmail = `${email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}@local.yotara`;
    sqlite.prepare('UPDATE user SET email = ?, emailVerified = 1 WHERE id = ?').run(syntheticEmail, userId);
  }

  // 4. Store instance settings
  const settings = {
    auth_mode: authMode,
    default_theme: defaultTheme,
    default_capture_behavior: defaultCaptureBehavior,
    setup_completed: 'true',
  };
  for (const [key, value] of Object.entries(settings)) {
    sqlite.prepare('INSERT OR REPLACE INTO instance_settings (key, value) VALUES (?, ?)').run(key, value);
  }

  // 5. Store security questions
  if (securityQuestions?.length) {
    for (const q of securityQuestions) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHash('sha256').update(salt + q.answer.toLowerCase().trim()).digest('hex');
      sqlite.prepare(
        `INSERT INTO admin_recovery (id, type, question, answer_hash, created_at) VALUES (?, 'security_question', ?, ?, ?)`
      ).run(crypto.randomUUID(), q.question, `${salt}:${hash}`, Date.now());
    }
  }

  // 6. Store recovery hash
  if (recoveryHash) {
    const hash = crypto.createHash('sha256').update(recoveryHash).digest('hex');
    sqlite.prepare(
      `INSERT INTO admin_recovery (id, type, hash_value, created_at) VALUES (?, 'recovery_hash', ?, ?)`
    ).run(crypto.randomUUID(), hash, Date.now());
  }

  // 7. Generate avatar
  const avatarUri = generateAvatarDataUri(name);
  sqlite.prepare('UPDATE user SET image = ? WHERE id = ?').run(avatarUri, userId);

  return { success: true };
});
```

### Revisiting setup

Admin can navigate to `/setup` after initial setup. When `setup_completed = 'true'`:
- Step 1 is skipped (admin account already exists)
- Step 3-4 show current state (questions exist, hash was generated — show "already configured" instead of re-creating)
- Step 5 shows current theme/settings as pre-selected
- On submit: updates `instance_settings` in place (doesn't recreate admin account or recovery data)

### Checkpoint CP-4

> **When this is done:**
> - Fresh instance with no users → browser redirects to `/setup`
> - 6-step wizard creates admin account + configures instance
> - Security questions + recovery hash stored in DB
> - Settings stored in `instance_settings`
> - After setup → redirect to login
> - Admin can revisit `/setup` to change settings

---

## Phase 5 — Avatar System

**Goal:** Every user gets a generated nature-themed avatar on signup. Users can upload their own photo later.
**Effort:** 2-3 days
**Dependencies:** None (independent)
**Risk:** Low — adds columns, doesn't change existing behavior
**New dependency:** `sharp` (or `jimp`) for image resizing

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/lib/avatar.ts` | SVG generation, icon map, upload processing |
| `apps/api/src/routes/avatar.ts` | `GET /avatar/:userId`, `POST /avatar/upload`, `DELETE /avatar` |
| `apps/frontend/src/app/shared/components/avatar/avatar.component.ts` | Reusable avatar component |
| `apps/frontend/src/app/shared/components/avatar/avatar.component.html` | Template |
| `apps/frontend/src/app/shared/components/avatar/avatar.component.css` | Styles |
| `apps/frontend/src/app/features/settings/components/avatar-upload-modal.component.ts` | Upload + crop + preview |

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/plugins/auth-bridge.ts` | After signup: `UPDATE user SET image = ?` with generated avatar |
| `apps/frontend/src/app/features/personal/shell/personal-shell.component.html` | Replace `{{ userInitials() }}` with `<app-avatar>` |
| `apps/frontend/src/app/features/shell/auth-shell.component.html` | Replace `{{ userInitials() }}` with `<app-avatar>` |
| `apps/frontend/src/app/features/personal/pages/settings-page.component.ts` | Enable "Profile settings" button → avatar upload |

### Implementation

#### `apps/api/src/lib/avatar.ts`

```typescript
const AVATAR_ICONS = [
  'fox', 'deer', 'owl', 'rabbit', 'squirrel', 'bear', 'hedgehog', 'wolf',
  'moose', 'badger', 'robin', 'blue-jay', 'cardinal', 'heron', 'swan', 'raven',
  'hawk', 'hummingbird', 'otter', 'frog', 'turtle', 'butterfly', 'dragonfly', 'bee',
  'ladybug', 'firefly', 'oak-leaf', 'maple-leaf', 'mushroom', 'fern', 'mountain', 'moon',
];

const AVATAR_COLORS_LIGHT = [
  '#5aa37d', '#4a9eb8', '#8b8c9a', '#9b7bbd',
  '#d4a04a', '#4a7c9e', '#c77d5e', '#6b8c6b',
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

function getAvatarIndex(name: string): number {
  return Math.abs(hashCode(name)) % AVATAR_ICONS.length;
}

function getColorIndex(name: string): number {
  return Math.abs(hashCode(name + '_color')) % AVATAR_COLORS_LIGHT.length;
}

function generateAvatarDataUri(name: string): string {
  const idx = getAvatarIndex(name);
  const colorIdx = getColorIndex(name);
  const iconKey = AVATAR_ICONS[idx];
  const svg = ICON_SVG_MAP[iconKey];
  const colorSvg = svg.replace('currentColor', AVATAR_COLORS_LIGHT[colorIdx]);
  return `data:image/svg+xml;base64,${Buffer.from(colorSvg).toString('base64')}`;
}

async function processAvatarUpload(buffer: Buffer): Promise<string> {
  const sharp = await import('sharp');
  const resized = await sharp(buffer)
    .resize(256, 256, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();
  return `data:image/png;base64,${resized.toString('base64')}`;
}
```

#### `apps/api/src/routes/avatar.ts`

- `GET /avatar/:userId` — Returns the avatar. If `user.image` is set (data URI), serve it with appropriate content-type. If not, generate on-the-fly from name (always set on signup, so this is a fallback).
- `POST /avatar/upload` — Multipart upload:
  - Auth required
  - Accept `image/png`, `image/jpeg`, `image/webp`
  - Max 2MB
  - Validate content-type + file magic bytes
  - Resize to 256×256 with sharp
  - Store as base64 data URI in `user.image`
  - Return `{ image: "data:image/png;base64,..." }`
- `DELETE /avatar` — Removes `user.image` (set to NULL), falls back to generated SVG

#### Avatar sizes

| Size | CSS class | Dimensions |
|------|-----------|------------|
| `sm` | `avatar--sm` | 32×32px |
| `md` | `avatar--md` | 48×48px |
| `lg` | `avatar--lg` | 96×96px |

#### Avatar component

```typescript
@Component({
  selector: 'app-avatar',
  template: `
    @if (user()?.image) {
      <img [src]="user()?.image" [class]="'avatar avatar--' + size()"
           [attr.alt]="user()?.name + ' avatar'" />
    } @else {
      <div class="avatar avatar--{{ size() }}" [style.--avatar-color]="avatarColor()">
        <div [innerHTML]="avatarSvg()" aria-hidden="true"></div>
      </div>
    }
  `,
})
export class AvatarComponent {
  user = input<{ name: string; image: string | null } | null>();
  size = input<'sm' | 'md' | 'lg'>('md');

  avatarColor = computed(() => {
    const name = this.user()?.name ?? '';
    const colors = ['#5aa37d', '#4a9eb8', '#8b8c9a', '#9b7bbd', '#d4a04a', '#4a7c9e', '#c77d5e', '#6b8c6b'];
    return colors[Math.abs(this.hashCode(name + '_color')) % colors.length];
  });

  avatarSvg = computed(() => {
    const name = this.user()?.name ?? '';
    const icons = ['fox', 'deer', /* ...32 icons... */, 'moon'];
    const index = Math.abs(this.hashCode(name)) % icons.length;
    return ICON_SVG_MAP[icons[index]].replace('currentColor', 'var(--avatar-color)');
  });

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
```

#### Wire into shells

**personal-shell.component.html** (line 220):
```html
@if (profileMenuOpen()) { ... }

<button type="button" class="avatar avatar-button" ...>
  <!-- Before: {{ userInitials() }} -->
  <app-avatar [user]="authState.user()" size="sm" />
</button>
```

**auth-shell.component.html** (line 146):
Same pattern.

#### Profile settings with avatar upload

Enable the disabled "Profile settings" button in Settings (currently disabled). Wire to an avatar upload modal:
1. Click → modal opens with current avatar preview (at 256×256)
2. "Upload photo" → file picker (accept: image/png, image/jpeg, image/webp)
3. Preview of uploaded image (cropped to square, centered)
4. "Save" → `POST /avatar/upload` with FormData
5. On success → `AuthStateService` refreshes user profile → avatar updates everywhere
6. "Remove photo" → `DELETE /avatar` → falls back to generated SVG

### Checkpoint CP-5

> **When this is done:**
> - Every user gets a deterministic nature icon + color avatar on signup
> - Avatar renders in personal shell, auth shell, and profile menu
> - Avatar upload works: pick file → resize → store → display
> - Avatar delete works: falls back to generated SVG
> - Generated avatar SVG color adapts to light/dark themes
> - All existing tests pass

---

## Phase 6 — Recovery Hash Flow

**Goal:** Admin can reset their password using a one-time recovery hash generated during setup.
**Effort:** 1-2 days
**Dependencies:** Phase 2 (admin_recovery table), Phase 4 (hash generated during setup)
**Risk:** Low — new endpoints, doesn't change existing auth

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/lib/recovery-hash.ts` | Generate, verify, lockout logic |
| `apps/frontend/src/app/features/auth/admin-password-recovery.component.ts` | Recovery page |
| `apps/frontend/src/app/features/auth/admin-password-recovery.component.html` | Template |
| `apps/frontend/src/app/features/auth/admin-password-recovery.component.css` | Styles |

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/routes/admin-recovery.ts` | New route file: recovery endpoints |
| `apps/api/src/server.ts` | Register recovery routes |
| `apps/frontend/src/app/app.routes.ts` | Add `/admin-recovery` route |

### Implementation

#### Recovery hash generation

```typescript
import crypto from 'node:crypto';
import { sqlite } from '../db/client.js';

function generateRecoveryHash(): { raw: string; display: string; hash: string } {
  const raw = crypto.randomBytes(16).toString('hex').toUpperCase();
  const display = raw.match(/.{4}/g)!.join('-');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, display, hash };
}

function storeRecoveryHash(hash: string): void {
  sqlite.prepare(
    `INSERT INTO admin_recovery (id, type, hash_value, created_at)
     VALUES (?, 'recovery_hash', ?, ?)`
  ).run(crypto.randomUUID(), hash, Date.now());
}
```

#### Verification with lockout

```typescript
function verifyRecoveryHash(rawHash: string): {
  valid: boolean;
  userId?: string;
  locked?: boolean;
  remainingLockout?: number;
} {
  // First check if there's a global lockout
  const lockoutRow = sqlite.prepare(`
    SELECT MAX(locked_until) as locked_until
    FROM admin_recovery
    WHERE type IN ('recovery_hash', 'security_question')
  `).get() as { locked_until: number | null };

  if (lockoutRow?.locked_until && lockoutRow.locked_until > Date.now()) {
    const remaining = Math.ceil((lockoutRow.locked_until - Date.now()) / 60000);
    return { valid: false, locked: true, remainingLockout: remaining };
  }

  // Look up the hash
  const hash = crypto.createHash('sha256').update(rawHash).digest('hex');
  const row = sqlite.prepare(
    `SELECT * FROM admin_recovery WHERE type = 'recovery_hash' AND hash_value = ? AND used = 0`
  ).get(hash) as AdminRecoveryRow | undefined;

  if (!row) {
    recordFailedAttempt();
    return { valid: false };
  }

  // Mark used — single use
  sqlite.prepare('UPDATE admin_recovery SET used = 1 WHERE id = ?').run(row.id);
  return { valid: true, userId: lookupUserId() };
}

function recordFailedAttempt(): void {
  // Increment failed_attempts on the most recent admin_recovery row
  sqlite.prepare(`
    UPDATE admin_recovery SET failed_attempts = failed_attempts + 1
    WHERE type = 'recovery_hash' OR type = 'security_question'
  `).run();

  const row = sqlite.prepare(`
    SELECT MAX(failed_attempts) as attempts FROM admin_recovery
  `).get() as { attempts: number };

  if (row.attempts >= 3) {
    const lockedUntil = Date.now() + 3600000; // 1 hour
    sqlite.prepare(`
      UPDATE admin_recovery SET locked_until = ?
      WHERE type IN ('recovery_hash', 'security_question')
    `).run(lockedUntil);
  }
}
```

#### Endpoints

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/auth/admin-recovery/init` | POST | `{ email }` | `{ hasRecoveryHash: boolean, questions: [{id, question}] }` (random 3 of 5 if questions exist) |
| `/auth/admin-recovery/verify-hash` | POST | `{ hash }` | `{ token }` or `{ error, locked?, remainingLockout? }` |
| `/auth/admin-recovery/verify-questions` | POST | `{ answers: [{id, answer}] }` | `{ token }` or `{ error, locked?, remainingLockout? }` |
| `/auth/admin-recovery/reset` | POST | `{ token, newPassword }` | `{ success: true }` |

#### Token generation

When hash or questions are verified, generate a one-time reset token:
```typescript
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

// Store in a temporary table or verification table
sqlite.prepare(`
  INSERT INTO verification (id, identifier, value, expiresAt, createdAt)
  VALUES (?, 'admin_recovery', ?, ?, ?)
`).run(crypto.randomUUID(), tokenHash, Date.now() + 3600000, Date.now());
```

Token expires in 1 hour. Single-use (check `value` hasn't been used).

#### Frontend flow

**`AdminPasswordRecoveryComponent`** at route `/admin-recovery`:

1. Admin clicks "Forgot password?" on login
2. Enters email/username and submits
3. `POST /auth/admin-recovery/init` — if admin identified → redirect to `/admin-recovery`
4. Two tabs: "Use Recovery Hash" and "Answer Security Questions" (greyed out if not configured)

**Hash tab:**
```
┌──────────────────────────────────────┐
│  Enter your recovery hash:           │
│                                      │
│  [____-____-____-____                │
│   ____-____-____-____]               │
│                                      │
│  Auto-formats: uppercase + dashes    │
│                                      │
│  [Verify Hash]                       │
└──────────────────────────────────────┘
```
- Single text input, auto-uppercases, auto-adds dashes after every 4 chars
- Max 39 chars (8×4 + 7 dashes)

**Questions tab:**
```
┌──────────────────────────────────────┐
│  Answer 3 security questions:        │
│                                      │
│  Q: What was the name of your        │
│     first pet?                       │
│  A: [_____________________________]  │
│                                      │
│  Q: What street did you grow up on?  │
│  A: [_____________________________]  │
│                                      │
│  Q: What is your mother's maiden     │
│     name?                            │
│  A: [_____________________________]  │
│                                      │
│  [Verify Answers]                    │
└──────────────────────────────────────┘
```

**On success:** Show new password form:
```
┌──────────────────────────────────────┐
│  ✅ Verified!                        │
│                                      │
│  New password:  [__________________]  │
│  Confirm:       [__________________]  │
│                                      │
│  [Reset Password]                     │
└──────────────────────────────────────┘
```

**On failure (3rd strike):**
```
┌──────────────────────────────────────┐
│  🔒 Too many failed attempts         │
│                                      │
│  Try again in 58 minutes.            │
│                                      │
│  [████████░░░░░░░░░] 42/60 min       │
│                                      │
│  If you've lost your recovery hash,  │
│  contact your hosting provider or    │
│  check the server console for        │
│  manual reset instructions.          │
└──────────────────────────────────────┘
```
- Countdown timer updates every second
- After lockout expires, admin can try again

### Checkpoint CP-6

> **When this is done:**
> - Recovery hash entered correctly → password reset works
> - Recovery hash entered incorrectly 3 times → 1 hour lockout
> - After successful use, hash cannot be reused
> - All existing auth tests pass

---

## Phase 7 — Security Questions

**Goal:** Admin can answer 3 of 5 security questions as a secondary password recovery method.
**Effort:** 0.5 day (shared infrastructure with Phase 6)
**Dependencies:** Phase 2 (admin_recovery table), Phase 6 (recovery endpoints for token + reset)
**Risk:** Low

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/lib/security-questions.ts` | Question bank, hash, verify, random selection |

### Implementation

#### Question bank

```typescript
const QUESTION_BANK = [
  'What was the name of your first pet?',
  'What was your childhood nickname?',
  'What street did you grow up on?',
  'What was the name of your elementary school?',
  'What is your mother\u2019s maiden name?',
  'What was the name of your first best friend?',
  'What city were you born in?',
  'What is your favorite book?',
  'What was the model of your first car?',
  'What is the name of your favorite teacher?',
  'What is your grandfather\u2019s occupation?',
  'What is the name of the hospital you were born in?',
];
```

#### Answer hashing

```typescript
function hashAnswer(answer: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256')
    .update(salt + answer.toLowerCase().trim())
    .digest('hex');
  return `${salt}:${hash}`;
}

function verifyAnswer(answer: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const check = crypto.createHash('sha256')
    .update(salt + answer.toLowerCase().trim())
    .digest('hex');
  return check === hash;
}
```

#### Random selection

```typescript
function pickRandomQuestions(count: number, questions: Array<{ id: string; question: string }>): Array<{ id: string; question: string }> {
  return [...questions]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}
```

#### Verification logic (in `/auth/admin-recovery/verify-questions`)

1. Load 5 stored questions from `admin_recovery` for user
2. Check lockout (shared with hash)
3. Randomly pick 3
4. For each: `verifyAnswer(input, storedHash)`
5. All 3 must match
6. On any mismatch: `recordFailedAttempt()` (shared counter with hash)
7. On success: generate reset token (same as hash flow)

### Checkpoint CP-7

> **When this is done:**
> - 3 of 5 questions answered correctly → password reset works
> - Incorrect answers increment same lockout counter as hash
> - Lockout applies across both recovery methods (3 total failures, not 3 each)
> - Questions are randomly selected each recovery session
> - All existing tests pass

---

## Phase 8 — Admin-Gated User Password Reset

**Goal:** In username mode, non-admin users can request a password reset that an admin must approve.
**Effort:** 2-3 days
**Dependencies:** Phase 2 (password_reset_requests table), Phase 1 (admin role)
**Risk:** Low-Medium — involves polling UI

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/lib/password-reset-requests.ts` | DB helpers: create, approve, reject, list, poll status |
| `apps/api/src/routes/admin-password-resets.ts` | User-facing + admin-facing endpoints |
| `apps/frontend/src/app/features/auth/username-forgot-password.component.ts` | User-facing request form + status polling |
| `apps/frontend/src/app/features/auth/username-forgot-password.component.html` | Template |
| `apps/frontend/src/app/features/auth/username-forgot-password.component.css` | Styles |

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/server.ts` | Register admin-password-resets routes |
| `apps/frontend/src/app/app.routes.ts` | Add username forgot password route |
| `apps/frontend/src/app/features/auth/login.component.ts` | Show username forgot password link in username mode |

### Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/auth/reset-request` | POST | Public | Body: `{ username }`. Creates pending request. Returns `{ requestId }`. |
| `/auth/reset-request/:id/status` | GET | Public (with requestId) | Returns `{ status, approvedAt?, rejectedReason? }`. If approved: returns `{ resetToken }` (one-time). |
| `/auth/reset-with-token` | POST | Public | Body: `{ token, newPassword }`. Resets password using one-time token. |
| `/admin/password-reset-requests` | GET | Admin | Lists all requests. Query: `?status=pending` or `?status=all`. Returns `{ requests: [...], count: number }`. |
| `/admin/password-reset-requests/:id/approve` | POST | Admin | Generates one-time reset token (expires 1 hour). Returns `{ success: true }`. |
| `/admin/password-reset-requests/:id/reject` | POST | Admin | Body: optional `{ reason }`. Marks rejected. |

### User flow

1. User clicks "Forgot password?" on login → enters username
2. System confirms username exists: "Your admin has been notified. Your request ID is: YRQ-XXXX"
3. User can bookmark the status page: `/reset-request-status?id=YRQ-XXXX`
4. Status page shows: "⏳ Waiting for admin approval..."
5. When admin approves: "✅ Your password reset was approved!" + new password form
6. User enters new password + submits → password reset works

#### Polling

The status page polls `GET /auth/reset-request/:id/status` every 15 seconds. When status changes to `approved`, show the new password form immediately.

### Admin side

1. Bell icon shows badge with count of pending requests (see Phase 10)
2. Admin clicks bell → dropdown or navigate to `/admin` → "Password Reset Requests" section
3. Each request shows: username, timestamp, approve/reject buttons
4. Approve → `POST /admin/password-reset-requests/:id/approve`
5. Reject → optional reason text input → `POST /admin/password-reset-requests/:id/reject`

#### Token security

```typescript
// On approve:
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const expiresAt = Date.now() + 3600000; // 1 hour

sqlite.prepare(`
  UPDATE password_reset_requests
  SET status = 'approved', reset_token = ?, token_expires_at = ?, resolved_at = ?
  WHERE id = ?
`).run(tokenHash, expiresAt, Date.now(), requestId);

// On reset:
const request = sqlite.prepare(`
  SELECT * FROM password_reset_requests
  WHERE reset_token = ? AND status = 'approved' AND token_expires_at > ?
`).get(tokenHash, Date.now());

if (request) {
  // Reset password via better-auth
  // Mark token as used
  sqlite.prepare(`
    UPDATE password_reset_requests SET status = 'used' WHERE id = ?
  `).run(request.id);
}
```

### Checkpoint CP-8

> **When this is done:**
> - User in username mode can request password reset
> - Admin sees pending request in admin panel
> - Admin approves → user gets one-time token
> - User resets password with token
> - Token expires after 1 hour
> - Admin rejects → user sees rejection status
> - All existing tests pass

---

## Phase 9 — Admin Settings Panel

**Goal:** Admin panel at `/admin` for user management, password reset requests, and instance settings.
**Effort:** 1-2 days
**Dependencies:** Phase 1 (admin guard), Phase 2 (instance_settings table), Phase 8 (reset request endpoints)
**Risk:** Low — new routes, doesn't change existing features

### Files to create

| File | Purpose |
|---|---|
| `apps/frontend/src/app/features/admin/admin-settings.component.ts` | Admin panel component |
| `apps/frontend/src/app/features/admin/admin-settings.component.html` | Layout with sections |
| `apps/frontend/src/app/features/admin/admin-settings.component.css` | Styles |
| `apps/frontend/src/app/features/admin/components/users-list.component.ts` | Users table |
| `apps/frontend/src/app/features/admin/components/password-reset-requests.component.ts` | Reset request list + approve/reject |
| `apps/frontend/src/app/features/admin/components/instance-settings-form.component.ts` | Instance settings editor |

### Files to modify

| File | Change |
|---|---|
| `apps/frontend/src/app/app.routes.ts` | Add `/admin` route with `authGuard` + `adminGuard` |
| `apps/frontend/src/app/features/personal/shell/personal-shell.component.html` | Add "Admin" nav item when `isAdmin()` |
| `apps/api/src/routes/admin.ts` | Backend admin endpoints |

### Route

```typescript
{
  path: 'admin',
  canActivate: [authGuard, adminGuard],
  loadComponent: () => import('./features/admin/admin-settings.component').then(m => m.AdminSettingsComponent),
}
```

### Sidebar navigation

Add to `personal-shell.component.ts` navItems when `isAdmin()`:
```typescript
// Computed nav items:
readonly navItems = computed(() => {
  const items = [...this.baseNavItems];
  if (this.authState.isAdmin()) {
    items.splice(5, 0, { label: 'Admin', route: '/admin', icon: 'admin' });
  }
  return items;
});
```

### Admin panel sections

**Dashboard:**
- Total users count
- Pending password reset requests (with badge)
- Instance settings summary (auth mode, default theme)

**Users:**
```
┌──────┬──────────┬────────────┬──────────┬─────────────┐
│ User │ Email    │ Role       │ Created  │ Avatar      │
├──────┼──────────┼────────────┼──────────┼─────────────┤
│ ...  │ ...      │ admin      │ 2026-07  │ <app-avatar>│
│ ...  │ ...      │ member     │ 2026-07  │ <app-avatar>│
└──────┴──────────┴────────────┴──────────┴─────────────┘
```
- Read-only table for MVP. Admin cannot delete users.
- Shows avatar + name + email/username + role + created date.

**Password Reset Requests:**
```
┌──────────┬──────────┬─────────────────┬──────────────┐
│ Username │ Requested│ Status          │ Actions      │
├──────────┼──────────┼─────────────────┼──────────────┤
│ jdoe     │ 2 min ago│ ⏳ Pending      │ [Approve] [Reject] │
│ asmith   │ 1 hr ago │ ✅ Approved     │ —           │
└──────────┴──────────┴─────────────────┴──────────────┘
```
- Shows badge count of pending requests in the section header
- Approve/Reject buttons only for pending requests
- Reject shows optional reason text input

**Instance Settings:**
- Default theme (select from 7)
- Default capture behavior (quick/full)
- Auth mode (read-only: "To change auth mode, re-run the setup wizard")
- "Re-run Setup Wizard" button → opens `/setup`

### Checkpoint CP-9

> **When this is done:**
> - Admin sidebar nav item visible for admin users only
> - `/admin` page shows users, reset requests, and instance settings
> - Admin can approve/reject password reset requests
> - Admin can change instance settings (theme, capture behavior)
> - Non-admin users get 401/redirect on `/admin`
> - All existing tests pass

---

## Phase 10 — Notification Bell Wiring

**Goal:** Bell icon shows badge count of pending admin actions (password reset requests). Prepared for future push notification upgrade.
**Effort:** 1 day
**Dependencies:** Phase 8 (reset request endpoints with count), Phase 9 (admin panel for action)
**Risk:** Low

### Files to create

| File | Purpose |
|---|---|
| `apps/frontend/src/app/core/services/notification.service.ts` | Polling service for pending counts |

### Files to modify

| File | Change |
|---|---|
| `apps/frontend/src/app/features/personal/shell/personal-shell.component.ts` | Wire notification service, bell click action |
| `apps/frontend/src/app/features/personal/shell/personal-shell.component.html` | Badge on bell icon |

### NotificationService

```typescript
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private authState = inject(AuthStateService);
  private http = inject(HttpClient);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly pendingResetCount = signal(0);
  readonly isPolling = signal(false);

  startPolling(): void {
    if (this.isPolling()) return;
    if (!this.authState.isAuthenticated()) return;
    this.isPolling.set(true);
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), 60_000);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling.set(false);
  }

  private poll(): void {
    if (!this.authState.isAdmin()) {
      this.pendingResetCount.set(0);
      return;
    }

    this.http.get<{ count: number }>('/admin/password-reset-requests', {
      params: { status: 'pending', count: 'true' },
    }).subscribe({
      next: (res) => this.pendingResetCount.set(res.count),
      error: () => { /* silently retry next interval */ },
    });
  }
}
```

### Wire into shell

In `personal-shell.component.ts`:
```typescript
private notificationService = inject(NotificationService);

constructor() {
  // ... existing constructor logic
  this.notificationService.startPolling();
}

ngOnDestroy() {
  this.notificationService.stopPolling();
}
```

In `personal-shell.component.html` (line 143-145):
```html
<button type="button" class="icon-button" aria-label="Notifications"
        (click)="router.navigate(['/admin'])">
  <fa-icon [icon]="faBell" aria-hidden="true"></fa-icon>
  @if (notificationService.pendingResetCount() > 0) {
    <span class="notification-badge">{{ notificationService.pendingResetCount() }}</span>
  }
</button>
```

Backend: `GET /admin/password-reset-requests?status=pending&count=true` returns:
```json
{ "count": 3 }
```

### Badge styling

```css
.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--error-solid, #e74c3c);
  color: white;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  pointer-events: none;
}
```

### Future push notification upgrade

The `NotificationService` is designed to be extended with Web Push (Phase 5 of `admin-notifications.md`):
- Add `pushPermission` signal
- Add `subscribe()` / `unsubscribe()` methods
- Extend `notifications` signal with push-delivered events
- Wire to Settings "Desktop notifications" toggle

### Checkpoint CP-10

> **When this is done:**
> - Bell icon shows red badge with pending reset request count (admin only)
> - Bell click navigates to `/admin` (password reset requests section)
> - Non-admin users see no badge
> - Polling stops when user logs out
> - All existing tests pass

---

## Effort & Dependency Graph

```
Phase 1: Admin Role (1d)
  └── Phase 2: DB Tables (0.5d)
       ├── Phase 3: Setup Endpoint (1d)
       │    └── Phase 4: Setup Wizard (3-4d)
       │         ├── Phase 6: Recovery Hash (1-2d)
       │         └── Phase 7: Security Questions (0.5d)
       ├── Phase 5: Avatars (2-3d)
       ├── Phase 8: User Password Reset (2-3d)
       │    └── Phase 10: Notification Bell (1d)
       └── Phase 9: Admin Panel (1-2d)
            └── uses Phase 10

Total: ~12-16 days
```

Parallelizable:
- Phase 5 (Avatars) is fully independent — can start day 1
- Phase 8 (User Password Reset) needs only Phase 2 tables — can start early
- Phase 9 (Admin Panel) needs Phase 1 (role) + Phase 8 endpoints — mid-project
- Phase 10 (Bell) needs Phase 8 endpoint — late project

### Recommended sprint order

| Sprint | Focus | Phases | Duration |
|--------|-------|--------|----------|
| 1 | Foundation | Phase 1 (Admin) + Phase 2 (Tables) + Phase 5 (Avatars) | 3-4 days |
| 2 | Setup flow | Phase 3 (Status) + Phase 4 (Wizard) | 4-5 days |
| 3 | Recovery | Phase 6 (Hash) + Phase 7 (Questions) | 2-3 days |
| 4 | User reset + admin UI | Phase 8 (Reset) + Phase 9 (Admin Panel) + Phase 10 (Bell) | 4-5 days |

---

## Security Summary

| Concern | Mitigation |
|---|---|
| Recovery hash stolen | SHA-256 stored, single-use, never re-displayed after setup |
| Brute force recovery | 3 failed attempts (combined hash + questions) → 1 hour lockout |
| Password reset token stolen | 1 hour expiry, single-use, SHA-256 stored |
| Admin API abuse | Gated by cookie session auth (httpOnly, sameSite=lax) AND `role = 'admin'` check |
| Avatar upload | 2MB max, content-type validation, file magic byte check, Sharp resize to 256×256 |
| Username squatting | Better-auth enforces unique constraint, case-insensitive |
| First user escalation | Only first signup gets admin — `SELECT COUNT(*) = 1` check before promotion |
| Synthetic email bypass | `@local.yotara` emails cannot sign up again (unique constraint) |
| CSRF on admin actions | All API calls use better-auth cookies (httpOnly, sameSite=lax) |
| Security question answers | SHA-256 salted hashes, answers normalized (lowercase, trimmed) |
| XSS in avatar SVG | SVGs generated server-side with controlled paths (no user input in SVG content) |

---

## Rollback Plan

| Phase | Rollback action | Data loss? |
|---|---|---|
| 1 | Remove `role` column guards, revert `auth-bridge.ts`, remove admin routes | No |
| 2 | Leave tables — harmless if unused | No |
| 3 | Remove setup routes, remove setup guard | No |
| 4 | Remove frontend wizard component, remove `/setup` route | No |
| 5 | Remove avatar column guards, revert shell templates | Yes — uploaded avatar images in `user.image` |
| 6 | Remove recovery endpoints, remove admin recovery frontend | No |
| 7 | (Covered by Phase 6 rollback) | No |
| 8 | Remove `password_reset_requests` table, remove endpoints, remove frontend | Yes — pending reset requests lost |
| 9 | Remove admin frontend routes | No |
| 10 | Remove notification polling | No |

Each phase is independently reversible. Phases 5 and 8 are the only ones with potential data loss (user-uploaded images and pending requests respectively).

---

## Env Vars Reference

### Existing (from admin-notifications.md)

| Variable | Default | Description |
|---|---|---|
| `MAX_ACCOUNTS_PER_IP` | `5` | Max signups from a single IP. Self-hosted: `1000` |
| `ADMIN_SECRET` | (unset) | If set, enables `/admin/*` endpoints. Long random string (≥32 chars) |
| `BYPASS_EMAIL_REGISTRATION` | `false` | When `true`, registration uses username + password only |
| `EMAIL_PROVIDER` | (unset) | `resend`, `mailgun`, or unset for console logging |
| `GRACE_PERIOD_DAYS` | `7` | Days an unverified account can log in |
| `VAPID_PUBLIC_KEY` | (required) | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | (required) | Web Push VAPID private key |

### New (this plan)

| Variable | Default | Description |
|---|---|---|
| `AVATAR_MAX_SIZE_BYTES` | `2097152` | 2MB max upload size for avatar images |
| `AVATAR_RESIZE_DIMENSION` | `256` | Width/height in px for resized avatar images |
| `RECOVERY_LOCKOUT_ATTEMPTS` | `3` | Failed attempts before lockout |
| `RECOVERY_LOCKOUT_MINUTES` | `60` | Lockout duration in minutes |
| `RESET_TOKEN_EXPIRY_HOURS` | `1` | Hours until a password reset token expires |

### docker-compose.yml defaults (self-hosted)

```yaml
environment:
  MAX_ACCOUNTS_PER_IP: 1000
  BYPASS_EMAIL_REGISTRATION: "true"    # Self-hosted: username mode by default
  GRACE_PERIOD_DAYS: 7
  EMAIL_PROVIDER: ""
  RESEND_API_KEY: ""
  AVATAR_MAX_SIZE_BYTES: 2097152
  AVATAR_RESIZE_DIMENSION: 256
  RECOVERY_LOCKOUT_ATTEMPTS: 3
  RECOVERY_LOCKOUT_MINUTES: 60
  RESET_TOKEN_EXPIRY_HOURS: 1
```

---

## Testing strategy per phase

| Phase | New tests needed |
|---|---|
| 1 | Admin promotion in auth test, admin guard test, frontend `isAdmin` signal test |
| 2 | DB table existence test, instance_settings CRUD test, admin_recovery CRUD test |
| 3 | `isFirstRun()` test with empty/full DB, setup status endpoint test, setup guard test |
| 4 | Wizard component tests (each step renders, form validation, submission), `POST /setup/complete` route test |
| 5 | Avatar generation test (deterministic by name), upload endpoint test (valid + invalid files), avatar component render test |
| 6 | Recovery hash generate + verify test, lockout test (3 failures → locked, reset after lockout), token expiry test |
| 7 | Security question hash + verify test, random selection test, shared lockout counter test |
| 8 | Reset request CRUD test, approve/reject flow test, token expiry test, status polling test |
| 9 | Admin panel component tests, role-gated access test, instance settings update test |
| 10 | Notification service polling test, badge count display test, bell click navigation test |
