# Admin & Notifications — Implementation Plan

> **Status:** Proposed draft. Not yet started.
> **Owner:** @apauldev
> **Estimated total effort:** 18–23 engineering days (3–4 weeks at 0.7 focus factor)
> **Supersedes:** ROADMAP §Notifications, ARCHITECTURE.md §Notifications backlog, ROADMAP P4 #34 (PWA), ROADMAP P1 #11 (browser notifications)
>
> **Doc map:** This doc covers **account limits, admin API, email verification + grace period, self-hosted bypass mode, and Web Push notifications** as a single coordinated feature set. Each phase is independently ship-able — you can stop after any phase and have a working product.
>
> **Change history:**
> - v2 — Reordered: Bypass Mode moved to Phase 2 (self-hosted users can use the product immediately). Added rate-limit notes, SW cache headers, reminder cancellation, bypass→email transition, session invalidation on grace expiry.

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1 — Per-IP Account Limits + Admin API](#phase-1--per-ip-account-limits--admin-api)
3. [Phase 2 — Self-Hosted Bypass Mode (Username + Password)](#phase-2--self-hosted-bypass-mode-username--password)
4. [Phase 3 — Email Provider Abstraction + Verification](#phase-3--email-provider-abstraction--verification)
5. [Phase 4 — Seven-Day Grace Period](#phase-4--seven-day-grace-period)
6. [Phase 5 — Web Push Notifications](#phase-5--web-push-notifications)
7. [Phase 6 — Frontend UX Complete](#phase-6--frontend-ux-complete)
8. [Checkpoint Summary](#checkpoint-summary)
9. [Env Vars Reference](#env-vars-reference)
10. [Rollback Plan](#rollback-plan)

---

## Overview

### The four pillars

| Pillar | Problem | Solution | Effort |
|---|---|---|---|
| **Admin & limits** | Unlimited accounts, no operator control | Per-IP signup cap + lightweight admin API (no UI) | 2–3 days |
| **Bypass mode** | Self-hosted admins don't want email infrastructure | Username + password only, no email required | 2–3 days |
| **Email verification** | No way to confirm user identity | Resend / Mailgun integration + 7-day grace period | 4–5 days |
| **Notifications** | No due-date reminders, no offline alerts | Web Push (Push API + Service Worker) | 6–8 days |
| **Frontend UX** | No verification flow, no notification UI | Post-signup page, grace-period banner, notification bell, permission flow | 4–5 days |

### Effort breakdown

```
Phase 1 (Admin + limits)     ████░░░░░░  2–3d    Independent, start here
Phase 2 (Bypass mode)         ████░░░░░░  2–3d    Independent of Phase 1
Phase 3 (Email provider)      ██████░░░░  3–4d    Depends on Phase 2 (username plugin)
Phase 4 (Grace period)        ████░░░░░░  2–3d    Depends on Phase 3
Phase 5 (Web Push)            ██████████  6–8d    Needs SW infra, otherwise independent
Phase 6 (Frontend UX)         ██████░░░░  3–4d    Depends on Phases 3–5
```

Phases 1, 2, and 5 can start immediately. Self-hosted users get a working product after Phase 2 without any email infrastructure.

---

## Phase 1 — Per-IP Account Limits + Admin API

**Goal:** Prevent mass account creation. Give operators basic account management via API.
**Effort:** 2–3 days
**Dependencies:** None
**Risk:** Low — adds new code, doesn't change existing auth flow

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/lib/ip-limits.ts` | SQLite-backed per-IP counter + check logic |
| `apps/api/src/plugins/admin-auth.ts` | Fastify plugin that checks `Admin-Secret` header |
| `apps/api/src/routes/admin.ts` | Admin endpoints (list users, verify user, delete user) |

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/lib/auth.ts` | No change yet |
| `apps/api/src/plugins/auth-bridge.ts` | Add IP check before `/auth/sign-up/email` |
| `apps/api/src/server.ts` | Register admin routes |
| `apps/api/src/db/schema.ts` | No change (IP table is raw SQLite, not Drizzle) |
| `apps/api/src/db/client.ts` | Add `signup_ips` table to `SQLITE_BOOTSTRAP_SQL` |
| `apps/api/.env.example` | Add `MAX_ACCOUNTS_PER_IP`, `ADMIN_SECRET` |
| `docker-compose.yml` | Add default env vars (high limit for self-hosted) |

### Implementation steps

1. **Create `apps/api/src/lib/ip-limits.ts`**
   - Table `signup_ips` (`ip TEXT PK`, `count INTEGER`, `last_signup_at INTEGER`)
   - `getSignupCount(ip): number` — returns current count for an IP
   - `incrementSignupCount(ip): number` — increments and returns new count
   - `resetSignupCount(ip): void` — resets a single IP (admin use)
   - `cleanStaleEntries(hours: number): void` — removes entries older than N hours (keeps table small)
   - Read `MAX_ACCOUNTS_PER_IP` from env (default `5`)
   - Uses raw `better-sqlite3` (same pattern as `login-lockout.ts`)

2. **Create `apps/api/src/plugins/admin-auth.ts`**
   - Fastify preHandler that reads `Admin-Secret` header
   - Compares to `ADMIN_SECRET` env var
   - Returns 401 if missing or wrong
   - If `ADMIN_SECRET` is unset, the plugin registers no routes (admin is disabled)
   - Security note: `ADMIN_SECRET` is a static bearer token, not a password hash. For v1 this is acceptable. Treat it like a root password — long (≥32 chars), random, stored in a secret manager. Future versions should migrate to a proper admin user role with session-based auth and audit logging.

3. **Create `apps/api/src/routes/admin.ts`**
   - All routes behind `adminAuth` preHandler
   - `GET /admin/users` — list all users with: id, name, email, emailVerified, createdAt, signup IP, grace days remaining, and whether the email is synthetic (`email.endsWith('@local.yotara')`)
   - `POST /admin/verify-user` — body `{ userId }`, sets `emailVerified = true`
   - `POST /admin/delete-user` — body `{ userId }`, deletes user + sessions + accounts + labels + tasks + projects

4. **Update `apps/api/src/plugins/auth-bridge.ts`**
   - Import `getSignupCount`, `incrementSignupCount`
   - Before proxying `POST /auth/sign-up/email`:
     - Get `request.ip`
     - If `getSignupCount(ip) >= MAX_ACCOUNTS_PER_IP` → return 429 `{ message: "Too many accounts from this IP" }`
   - After receiving a 200 response from better-auth → `incrementSignupCount(ip)`

5. **Update `apps/api/src/db/client.ts`**
   - Add to `SQLITE_BOOTSTRAP_SQL`:
     ```sql
     CREATE TABLE IF NOT EXISTS signup_ips (
       ip TEXT PRIMARY KEY NOT NULL,
       count INTEGER NOT NULL DEFAULT 0,
       last_signup_at INTEGER NOT NULL
     );
     ```

6. **Update `apps/api/src/server.ts`**
   - Import and register admin routes

7. **Update env files** (see [Env Vars Reference](#env-vars-reference) below)

### Checkpoint CP-1

> **When this is done:**
> - `curl -X POST` to `/auth/sign-up/email` from the same IP `MAX_ACCOUNTS_PER_IP + 1` times → 429
> - `GET /admin/users?secret=<ADMIN_SECRET>` returns a list of users
> - `POST /admin/verify-user` sets `emailVerified` to true
> - `POST /admin/delete-user` removes the user and all their data
> - All existing auth tests pass
> - Without `ADMIN_SECRET` set, admin routes return 404 (not registered)

---

## Phase 2 — Self-Hosted Bypass Mode (Username + Password)

**Goal:** Self-hosted admins can bypass email entirely. Register and log in with username + password only.
**Effort:** 2–3 days
**Dependencies:** Phase 1 (env var pattern established), username plugin
**Risk:** Low — gated behind `BYPASS_EMAIL_REGISTRATION` env var, default off

### Files to create

| File | Purpose |
|---|---|
| *(none — all changes are modifications)* | |

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/lib/auth.ts` | Add `username()` plugin to better-auth config |
| `apps/api/src/plugins/auth-bridge.ts` | Handle bypass mode: auto-set emailVerified=true, generate synthetic email |
| `apps/api/src/db/schema.ts` | Add `username` + `displayUsername` fields to user table |
| `apps/api/src/db/client.ts` | Add username columns to `SQLITE_BOOTSTRAP_SQL` |
| `packages/shared/src/auth.ts` | Add `usernameClient()` plugin to auth client |
| `packages/shared/src/index.ts` | Export any new types if needed |
| `apps/api/.env.example` | Add `BYPASS_EMAIL_REGISTRATION` |
| `docker-compose.yml` | Add bypass mode (default `true` for self-hosted) |

### Implementation steps

1. **Add username plugin to better-auth**
   - In `apps/api/src/lib/auth.ts`, add:
     ```typescript
     import { username } from 'better-auth/plugins';
     
     export const auth = betterAuth({
       // ... existing config
       plugins: [username()],
     });
     ```
   - The plugin adds `username` + `displayUsername` fields to the user table automatically via the Drizzle adapter (on first run, better-auth calls CREATE TABLE IF NOT EXISTS internally). We also declare them in `schema.ts` for Drizzle's type safety.

2. **Update DB schema**
   - `apps/api/src/db/schema.ts`:
     ```typescript
     username: text('username'),
     displayUsername: text('displayUsername'),
     ```
   - `apps/api/src/db/client.ts` — add guard after the existing column checks (same pattern as `workspaceMode`, `onboardingCompleted`, etc.):
     ```typescript
     if (!columnNames.has('username')) {
       sqlite.exec(`ALTER TABLE user ADD COLUMN username TEXT`);
     }
     if (!columnNames.has('displayUsername')) {
       sqlite.exec(`ALTER TABLE user ADD COLUMN displayUsername TEXT`);
     }
     ```
     And add the unique index after the column guards:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username ON user(username);
     ```

3. **Update `packages/shared/src/auth.ts`**
   ```typescript
   import { usernameClient } from 'better-auth/client/plugins';
   
   function getAuthClient() {
     return createAuthClient({
       baseURL: `${apiBaseUrl}/auth`,
       plugins: [usernameClient()],
     });
   }
   ```

4. **Update `auth-bridge.ts` for bypass registration**
   - When `BYPASS_EMAIL_REGISTRATION=true` AND body has `username` but no `email`:
     - Auto-generate a synthetic email: `{username}@local.yotara`
     - Inject it into the request body before proxying to better-auth
   - After a successful signup response from better-auth:
     - Immediately set `emailVerified = true` on the new user record:
       ```sql
       UPDATE user SET emailVerified = 1 WHERE email = ? AND emailVerified = 0;
       ```

5. **Bypass→email transition path for future use**
   - In Settings, add a "Set email address" option (Phase 6) for bypass-mode users who later want email notifications
   - When an email is set, `emailVerified` resets to `false` and the normal verification flow kicks in
   - This prevents lock-in: bypass mode is never permanent unless the user chooses

### Checkpoint CP-2

> **When this is done:**
> - With `BYPASS_EMAIL_REGISTRATION=true`: register with username + password (no email) → immediately logged in, `emailVerified=true`
> - Login with username + password works
> - `/me` returns `username` and `displayUsername`
> - Username uniqueness is enforced (case-insensitive)
> - With `BYPASS_EMAIL_REGISTRATION=false` (default): existing email flow works unchanged
> - All existing auth tests pass

---

## Phase 3 — Email Provider Abstraction + Verification

**Goal:** Send verification and password-reset emails via Resend or Mailgun. Fallback to console.log for local dev.
**Effort:** 3–4 days
**Dependencies:** Phase 2 (username plugin must be in the auth config)
**Risk:** Low-Medium — external API dependency, but the console fallback means dev never breaks

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/lib/email.ts` | Email provider abstraction (Resend + Mailgun + console fallback) |
| `apps/api/src/lib/email.test.ts` | Unit tests for email helper |
| `apps/api/src/lib/email-rate-limit.ts` | Cooldown tracking for resend and password-reset (shared with Phase 4) |

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/lib/auth.ts` | Add `emailVerification.sendVerificationEmail`, `sendResetPassword`, `onExistingUserSignUp` |
| `apps/api/src/plugins/auth-bridge.ts` | Add verification-aware error handling (403 from better-auth), rate-limit check on resend |
| `packages/shared/src/auth.ts` | No change (username client already added in Phase 2) |
| `apps/api/.env.example` | Add email provider env vars |
| `docker-compose.yml` | Add (optional) email env vars |

### Implementation steps

1. **Create `apps/api/src/lib/email.ts`**
   ```typescript
   interface EmailOptions {
     to: string;
     subject: string;
     text: string;
     html?: string;
   }

   type EmailProvider = 'resend' | 'mailgun' | 'console';

   async function sendEmail(options: EmailOptions): Promise<void>;
   ```
   - Reads `EMAIL_PROVIDER` from env (`resend` | `mailgun` | unset → `console`)
   - **Resend provider**: `POST https://api.resend.com/emails` with `Authorization: Bearer <RESEND_API_KEY>`
     - Body: `{ from, to, subject, text, html }`
     - `from` = `RESEND_FROM` env var (default `noreply@yotara.app`)
   - **Mailgun provider**: `POST https://api.mailgun.net/v3/<MAILGUN_DOMAIN>/messages`
     - Uses basic auth with `api:<MAILGUN_API_KEY>`
     - Body: form-encoded `{ from, to, subject, text, html }`
   - **Console fallback**: `console.log("📧 [EMAIL]", options)` — shows the full email content including URLs. If the email contains a URL, logs it as a clickable link for dev convenience.
   - Throws if the provider is configured but the API call fails (so better-auth knows the send failed)
   - Uses native `await fetch(...)` — no nodemailer dependency needed

2. **Create `apps/api/src/lib/email-rate-limit.ts`**
   ```typescript
   // Prevents abuse of resend endpoints
   const RESEND_COOLDOWN_MS = 60_000; // 60 seconds
   const EXISTING_USER_COOLDOWN_MS = 86_400_000; // 24 hours
   
   function canSendVerificationEmail(email: string): boolean;
   function markVerificationEmailSent(email: string): void;
   
   function canNotifyExistingUser(email: string): boolean;
   function markExistingUserNotified(email: string): void;
   ```
   - Uses raw SQLite (same pattern as `login-lockout.ts`)
   - Table `email_send_log` (`email TEXT`, `type TEXT` ('verification_resend'|'existing_user_attempt'), `sent_at INTEGER`)
   - Composite primary key on `(email, type)`
   - On resend request: check if last sent was < 60s ago → return 429
   - On existing-user notification: check if last sent was < 24h ago → skip silently (don't spam the existing user)
   - Cleanup: delete entries older than 7 days

3. **Update `apps/api/src/lib/auth.ts`**
   - Add `emailVerification: { sendVerificationEmail }`:
     ```typescript
     emailVerification: {
       sendVerificationEmail: async ({ user, url, token }, request) => {
         await sendEmail({
           to: user.email,
           subject: 'Verify your Yotara account',
           text: `Welcome to Yotara! Click this link to verify your email: ${url}\n\nThis link expires in 24 hours.`,
           html: `<p>Welcome to Yotara!</p><p><a href="${url}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
         });
       },
     },
     ```
   - Add `emailAndPassword.sendResetPassword`:
     ```typescript
     sendResetPassword: async ({ user, url, token }, request) => {
       await sendEmail({
         to: user.email,
         subject: 'Reset your Yotara password',
         text: `Click this link to reset your password: ${url}\n\nThis link expires in 1 hour.`,
         html: `<p><a href="${url}">Reset your password</a></p><p>This link expires in 1 hour.</p>`,
       });
     },
     ```
   - Add `emailAndPassword.onExistingUserSignUp`:
     ```typescript
     onExistingUserSignUp: async ({ user }, request) => {
       // Respect 24h cooldown to avoid spamming
       if (!canNotifyExistingUser(user.email)) return;
       markExistingUserNotified(user.email);
       
       await sendEmail({
         to: user.email,
         subject: 'Sign-up attempt on your Yotara account',
         text: `Someone tried to create an account using this email. If this was you, try signing in instead. If not, you can safely ignore this.`,
       });
     },
     ```
   - Note: The `onExistingUserSignUp` callback fires when someone tries to register with an already-used email. We rate-limit it to once per 24h per email address to prevent notification spam.

4. **Resend cooldown in `auth-bridge.ts`**
   - Before proxying a resend request (or before `sendVerificationEmail` fires), check `canSendVerificationEmail(email)`
   - If cooldown active → return 429 with `retryAfterSeconds`

### Checkpoint CP-3

> **When this is done:**
> - With `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` set: signup sends a real verification email (check inbox)
> - With no provider configured: signup logs the verification URL to console
> - Forgot-password flow sends a reset email (or logs it)
> - Existing user gets notified (once per 24h) when someone tries to register their email
> - Resend button is rate-limited: 60s cooldown, returns 429
> - All existing auth tests pass

---

## Phase 4 — Seven-Day Grace Period

**Goal:** Accounts work for 7 days without verification, then get locked until verified. When locked, active sessions are invalidated.
**Effort:** 2–3 days
**Dependencies:** Phase 3 (email verification must exist)
**Risk:** Low — adds a simple date check at login

### Files to modify

| File | Change |
|---|---|
| `apps/api/src/plugins/auth-required.ts` | Add grace-period check that runs on every authenticated request (catches sessions that outlive the grace window) |
| `apps/api/src/plugins/auth-bridge.ts` | Also check on sign-in (belt-and-suspenders — catches the case at login time with friendlier UX) |
| `apps/api/src/lib/auth.ts` | Set `requireEmailVerification: false`, `autoSignIn: true` |
| `apps/api/src/routes/me.ts` | Return `graceDaysRemaining` in profile |
| `apps/api/.env.example` | Add `GRACE_PERIOD_DAYS` |

### Implementation steps

1. **Update `apps/api/src/lib/auth.ts`**
   - Keep `emailAndPassword.requireEmailVerification: false` (we handle it ourselves in auth-bridge)
   - Set `emailAndPassword.autoSignIn: true` (sign in immediately after signup, even unverified)

2. **Update `apps/api/src/plugins/auth-required.ts`** (primary — runs on every request)
   - After `auth.api.getSession()` succeeds and `session.user.id` is confirmed:
   - If `!session.user.emailVerified`:
     - Parse `session.user.createdAt` as a Date and check if `now - createdAt > GRACE_PERIOD_DAYS * 86_400_000`
     - If expired: delete the current session row (`DELETE FROM session WHERE id = ?`) and return 403 with:
       ```json
       {
         "message": "Your trial period has expired. Please verify your email to continue using Yotara.",
         "code": "TRIAL_EXPIRED"
       }
       ```
   - This catches ANY authenticated request — a user whose session outlasts the grace period hits this on their next API call, not just on login.

3. **Update `apps/api/src/plugins/auth-bridge.ts`** (secondary — friendlier UX at login time)
   - After a successful sign-in (response status 200 from better-auth), check `emailVerified` and `createdAt`:
   - If expired: return 403 with `graceExpired: true` + `email` so the frontend can show the `/account-expired` page with resend option
   - If still within grace period: allow login — the frontend will read `graceDaysRemaining` from `/me`

4. **Update `apps/api/src/routes/me.ts`**
   - Add `graceDaysRemaining` to the `/me` response when `emailVerified === false`:
     ```typescript
     graceDaysRemaining: emailVerified
       ? undefined
       : Math.ceil((createdAt.getTime() + GRACE_PERIOD_DAYS * 86400000 - Date.now()) / 86400000),
     ```
   - Also expose `emailVerified` so the frontend can conditionally show the banner

### Checkpoint CP-4

> **When this is done:**
> - Newly registered account can sign in immediately (grace period active)
> - `/me` returns `graceDaysRemaining` for unverified accounts (e.g. `6`)
> - `/me` returns `emailVerified: false`
> - After `GRACE_PERIOD_DAYS` have passed (or set to `0` for testing), **any authenticated request** returns 403 with `code: "TRIAL_EXPIRED"` (not just login — existing sessions are caught mid-session)
> - After grace period expires, the current session is revoked on the first subsequent API call (user must re-authenticate after verifying)
> - Verify email → `emailVerified` flips to true → all requests work normally → `/me` no longer shows grace banner fields
> - All existing auth tests pass

---

## Phase 5 — Web Push Notifications

**Goal:** Browser notifications that work when the tab is closed. Push due-date reminders from the server.
**Effort:** 6–8 days
**Dependencies:** Independent of Phases 2–4 (only needs Phase 1's admin route pattern for reference)
**Risk:** Medium — involves Service Worker registration, VAPID key management, and a new push subscription lifecycle. Service workers can be tricky to debug.

### Files to create

| File | Purpose |
|---|---|
| `apps/api/src/lib/push.ts` | Push notification service using `web-push` |
| `apps/api/src/routes/push.ts` | Subscribe/unsubscribe push subscription endpoints |
| `apps/frontend/public/sw.js` | Service worker — listens for push events, shows notifications (plain JS, no compilation needed) |
| `apps/frontend/src/app/core/services/push-notification.service.ts` | Permission request, subscribe, subscription lifecycle |
| `scripts/generate-vapid-keys.mjs` | One-time script to generate VAPID keys |

### Files to modify

| File | Change |
|---|---|
| `apps/api/package.json` | Add `web-push` dependency |
| `apps/api/src/server.ts` | Register push routes |
| `apps/api/src/db/client.ts` | Add `push_subscriptions` + `due_reminders_sent` tables to `SQLITE_BOOTSTRAP_SQL` |
| `apps/api/.env.example` | Add VAPID env vars |
| `docker/nginx.conf` | Add `Cache-Control: no-cache, no-store` for `sw.js` |
| `docker-compose.yml` | Add VAPID env vars (optional) |
| `apps/frontend/src/main.ts` | Register service worker |
| `apps/frontend/src/app/features/personal/pages/settings-page.component.ts` | Enable "Desktop notifications" toggle with send-test button |
| `apps/frontend/src/app/core/services/auth-state.service.ts` | Trigger push subscription after login |

### Implementation steps

#### 5.1 VAPID key generation + config

1. **Create `scripts/generate-vapid-keys.mjs`**
   - Uses `web-push` to generate VAPID keys
   - Outputs `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
   - Prints instructions to add to `.env`
   - If VAPID keys are rotated later, existing push subscriptions become invalid. Users must re-subscribe. The service handles this gracefully: sending to an expired subscription returns a 410 from the push service, which triggers cleanup.

#### 5.2 Backend push infrastructure

2. **Add `web-push` to `apps/api/package.json`**
   ```json
   "dependencies": {
     "web-push": "^3.6.7"
   }
   ```

3. **Create `apps/api/src/lib/push.ts`**
   - Sets VAPID details on startup from env vars
   ```typescript
   import webPush from 'web-push';

   webPush.setVapidDetails(
     process.env['VAPID_SUBJECT'] ?? 'mailto:admin@yotara.app',
     process.env['VAPID_PUBLIC_KEY']!,
     process.env['VAPID_PRIVATE_KEY']!,
   );
   ```
   - Exports:
     - `sendPushNotification(subscription, payload)` — sends to one subscription. Catches 410 (expired) and deletes the subscription from DB.
     - `sendDueReminders()` — checks all tasks due within 24h, sends notifications, records sent status.
     - `cancelRemindersForTask(taskId)` — when a task is completed, removes its pending reminder so the user isn't spammed.

4. **Create `apps/api/src/routes/push.ts`**
   - All routes behind auth session (user must be logged in)
   - `POST /push/subscribe` — body `{ endpoint, keys: { p256dh, auth } }` → saves subscription
   - `DELETE /push/unsubscribe` — body `{ endpoint }` → deletes subscription
   - `GET /push/vapid-public-key` — returns public key (unauthenticated, needed by SW during registration)
   - `POST /push/test` — sends a test notification to the current user (settings page "Send test")
   - `GET /push/subscriptions` — list user's active subscriptions (settings UI)

5. **Update `apps/api/src/db/client.ts`**
   - Add to `SQLITE_BOOTSTRAP_SQL`:
     ```sql
     CREATE TABLE IF NOT EXISTS push_subscriptions (
       endpoint TEXT PRIMARY KEY NOT NULL,
       user_id TEXT NOT NULL,
       keys_json TEXT NOT NULL,
       created_at INTEGER NOT NULL,
       FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
     );
     CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

     CREATE TABLE IF NOT EXISTS due_reminders_sent (
       task_id TEXT NOT NULL,
       user_id TEXT NOT NULL,
       sent_at INTEGER NOT NULL,
       PRIMARY KEY (task_id, user_id),
       FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
     );
     ```

6. **Due-date reminder scheduler**
   - Implement `sendDueReminders()` in `push.ts`:
     ```typescript
     async function sendDueReminders(): Promise<void> {
       const now = Date.now();
       const in24h = now + 86400000;
       
       // Find tasks due within 24h that haven't had a reminder sent
       // and are not completed
       const tasks = sqlite.prepare(`
         SELECT t.id, t.title, t.due_date, t.user_id
         FROM tasks t
         LEFT JOIN due_reminders_sent drs ON drs.task_id = t.id AND drs.user_id = t.user_id
         WHERE t.due_date IS NOT NULL
           AND t.completed = 0
           AND t.deleted_at IS NULL
           AND drs.task_id IS NULL
           AND datetime(t.due_date) BETWEEN datetime('now') AND datetime('now', '+1 day')
       `).all() as TaskDue[];
       
       for (const task of tasks) {
         const subscriptions = sqlite.prepare(
           'SELECT endpoint, keys_json FROM push_subscriptions WHERE user_id = ?'
         ).all(task.user_id) as PushSubscriptionRow[];
         
         for (const sub of subscriptions) {
           await sendPushNotification({
             endpoint: sub.endpoint,
             keys: JSON.parse(sub.keys_json),
           }, {
             title: 'Task Due Soon',
             body: `"${task.title}" is due ${task.due_date}`,
             tag: `due-${task.id}`,  // Coalesces multiple reminders for same task
             url: `/tasks?view=upcoming`,
           });
         }
         
         // Mark reminder as sent
         sqlite.prepare(
           'INSERT OR IGNORE INTO due_reminders_sent (task_id, user_id, sent_at) VALUES (?, ?, ?)'
         ).run(task.id, task.user_id, now);
       }
     }
     ```
   - Reminders are sent once per task per due-date window. If a task is completed before the reminder fires, `cancelRemindersForTask(taskId)` is called from the task update handler, which deletes the `due_reminders_sent` row (so no notification is sent) or removes pending reminders. Wrap the task completion + reminder cancellation in a single `sqlite.transaction()` to prevent race conditions.
   - The scheduler runs on an interval in the server process (`setInterval(sendDueReminders, DUE_REMINDER_CHECK_INTERVAL * 1000)`). Add a flag to prevent overlapping runs.

7. **Wire scheduler in `apps/api/src/server.ts`**
   - After the server starts, start the reminder check interval
   - Caveat: This assumes a single API process. If the server scales horizontally later, the interval runs in every process, producing duplicate reminders. A future fix would use a dedicated scheduler worker or a distributed lock (e.g. via SQLite's WAL mode + `INSERT OR IGNORE` on `due_reminders_sent` acts as a poor man's lock, but it's not perfect with multiple processes). For v1 (single process), this is fine.

#### 5.3 Service Worker

8. **Create `apps/frontend/public/sw.js`** (plain JavaScript — no compilation needed)
   - Must live in `public/` because Angular's build only copies files from that directory to the output. If placed under `src/`, the SW would not be emitted and `navigator.serviceWorker.register('/sw.js')` would 404.
   ```javascript
   self.addEventListener('push', (event) => {
     const data = event.data?.json() ?? { title: 'Yotara', body: '' };
     const options = {
       body: data.body,
       icon: '/icons/icon-192x192.png',
       badge: '/icons/badge-72x72.png',
       tag: data.tag,
       data: { url: data.url },
     };
     event.waitUntil(self.registration.showNotification(data.title, options));
   });

   self.addEventListener('notificationclick', (event) => {
     event.notification.close();
     const url = event.notification.data?.url ?? '/';
     event.waitUntil(clients.openWindow(url));
   });
   ```
   - Placeholder icons: create minimal SVG icons at `/icons/icon-192x192.png` and `/icons/badge-72x72.png` (or skip badges for MVP if no icon path exists).

9. **Configure nginx to serve SW with correct headers**
   - In `docker/nginx.conf`, add:
     ```nginx
     location = /sw.js {
       root /usr/share/nginx/html;
       add_header Cache-Control "no-cache, no-store, must-revalidate";
       add_header Service-Worker-Allowed /;
     }
     ```
   - Without `Cache-Control: no-cache`, the browser may cache an old SW and fail to update it. Without `Service-Worker-Allowed /`, the SW scope is restricted to the directory it lives in.

10. **Register the service worker in `apps/frontend/src/main.ts`**
    ```typescript
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
    ```

#### 5.4 Frontend push subscription service

11. **Create `apps/frontend/src/app/core/services/push-notification.service.ts`**
    - `requestPermission(): Promise<NotificationPermission>` — wraps `Notification.requestPermission()`
    - `subscribe(): Promise<PushSubscription | null>`:
      - Gets existing registration via `navigator.serviceWorker.ready`
      - Calls `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
      - Gets the VAPID public key from `GET /push/vapid-public-key` first
    - `unsubscribe(): Promise<void>`:
      - Gets existing subscription, calls `subscription.unsubscribe()`
      - Deletes from backend: `DELETE /push/unsubscribe`
    - `refreshSubscription(): Promise<void>`:
      - Checks if subscription is still valid, re-subscribes if expired
    - State signals: `permission`, `isSubscribed`, `isSupported` (computed from `'Notification' in window && 'serviceWorker' in navigator`)
    - On init: check existing permission state, check if already subscribed

12. **Wire subscription lifecycle into `AuthStateService`**
    - After successful sign-in → `pushNotificationService.subscribe()` (only if permission already granted)
    - After sign-out → `pushNotificationService.unsubscribe()`

#### 5.5 Settings toggle

13. **Update `apps/frontend/src/app/features/personal/pages/settings-page.component.ts`**
    - Replace disabled "Desktop notifications" with a working toggle
    - Toggle on: calls `pushNotificationService.requestPermission()` then `subscribe()`
    - Toggle off: calls `pushNotificationService.unsubscribe()`
    - Show permission state: "Granted" / "Denied" / "Not asked"
    - Add a "Send test notification" button → `POST /push/test`
    - Add note: "Notifications work even when Yotara isn't open in a browser tab"

### Checkpoint CP-5

> **When this is done:**
> - Service worker is registered (check in DevTools → Application → Service Workers)
> - Notification permission is requested on login (or on settings toggle)
> - Subscribing to push creates a row in `push_subscriptions`
> - `POST /push/test` sends a notification that appears as a browser notification **even when the tab is closed**
> - Due-date reminders are pushed automatically within the check interval
> - Completing a task cancels its pending reminder
> - Settings toggle enables/disables notifications end-to-end
> - Unsubscribe removes the row from DB
> - After sign-out, subscriptions are cleaned up
> - `sw.js` is served with `Cache-Control: no-cache` (verify via DevTools → Network tab)

---

## Phase 6 — Frontend UX Complete

**Goal:** All user-facing flows are polished: verification, grace period, notifications, bypass mode.
**Effort:** 3–4 days
**Dependencies:** Phases 3, 4, 5 — but can start in parallel with Phase 5 (wire up final endpoints when ready)
**Risk:** Low-Medium — mostly UI changes

### Files to create

| File | Purpose |
|---|---|
| `apps/frontend/src/app/features/auth/verify-email.component.ts` | Post-signup verification page |
| `apps/frontend/src/app/features/auth/verify-email-callback.component.ts` | Handles email verification link redirect |
| `apps/frontend/src/app/features/auth/account-expired.component.ts` | Shown when grace period expired |
| `apps/frontend/src/app/shared/components/grace-banner.component.ts` | Dismissible banner showing days remaining |

### Files to modify

| File | Change |
|---|---|
| `apps/frontend/src/app/app.routes.ts` | Add routes for verify-email, verify-callback, account-expired |
| `apps/frontend/src/app/features/auth/login.component.ts` | Handle 403 (grace expired), resend verification, bypass mode UI |
| `apps/frontend/src/app/features/personal/shell/personal-shell.component.html` | Wire notification bell |
| `apps/frontend/src/app/features/personal/shell/personal-shell.component.ts` | Add notification panel, badge count |
| `apps/frontend/src/app/core/services/auth-state.service.ts` | Expose `graceDaysRemaining`, `isVerified`, `username` |
| `apps/frontend/src/app/features/personal/pages/settings-page.component.ts` | Add "Set email address" for bypass-mode users |

### Implementation steps

1. **Create `verify-email.component.ts`**
   - Shown after successful signup when email is not yet verified
   - Text: "Check your inbox! We sent a verification link to `{email}`"
   - Shows remaining grace period: "Your account will work for 7 days without verification."
   - "Resend email" button → calls `authClient.sendVerificationEmail({ email })` → shows "Sent!" with 60s cooldown
   - "Change email" button → opens email change form
   - "Skip, start using Yotara" → navigates to inbox/dashboard
   - Route: `/verify-email`

2. **Create `verify-email-callback.component.ts`**
   - Reads `token` and `error` from URL query params
   - If token: calls `authClient.verifyEmail({ token })` → shows success → redirects to login
   - If error: shows error message → redirects to login with error flag
   - Route: `/auth/verify` (or whatever better-auth redirects to)

3. **Create `account-expired.component.ts`**
   - Shown when login returns 403 with `graceExpired: true`
   - Text: "Your trial period has expired. Please verify your email to continue."
   - Shows the email address
   - "Resend verification email" button → with 60s cooldown
   - "Change email" button
   - Route: `/account-expired`

4. **Create `grace-banner.component.ts`**
   - Dismissible banner displayed at the top of the personal shell
   - Text: "Verify your email — {X} days remaining. [Resend] [Dismiss]"
   - Reads `graceDaysRemaining` from profile
   - Dismiss stores in localStorage so it doesn't show again this session
   - Show only when `emailVerified === false && graceDaysRemaining > 0`

5. **Update `login.component.ts`**
   - Handle 403 with `graceExpired: true` → redirect to `/account-expired`
   - Handle 403 with `graceExpired: false` → show "Please verify your email" + resend button
   - When `BYPASS_EMAIL_REGISTRATION=true` (detect via an initial config endpoint or env-derived constant):
     - Show username + password fields
     - Registration shows username + display name + password (no email field)
     - Login calls `signIn.username()` instead of `signIn.email()`
     - Signup calls `signUp.email()` with auto-generated email + `username` field set

6. **Update notification bell in shell**
   - Wire the existing bell icon button to open a simple dropdown/panel
   - MVP: show "No notifications yet" placeholder
   - Show a small badge (dot or count) when there are unread notifications
   - Wire to push notification service to show permission state

7. **Add "Set email address" in settings for bypass mode**
   - When `BYPASS_EMAIL_REGISTRATION=true` and the user has no real email (`@local.yotara` synthetic):
   - Show a "Set email address" option in Settings (replace the disabled "Profile settings" item)
   - When the user sets an email: update the user record, reset `emailVerified` to false, trigger verification email
   - This allows bypass-mode users to later enable email notifications or password recovery

8. **Expose `isVerified` and `graceDaysRemaining` from AuthStateService**
   ```typescript
   readonly isVerified = computed(() => this.user()?.emailVerified ?? false);
   readonly graceDaysRemaining = computed(() => this.user()?.graceDaysRemaining ?? 0);
   readonly username = computed(() => this.user()?.username ?? null);
   ```

### Checkpoint CP-6

> **When this is done:**
> - After signup with email: redirected to `/verify-email` with clear instructions
> - Clicking verify link in email → token verified → redirect to login with success message
> - Unverified account sees grace-period banner on dashboard with countdown
> - Expired account redirected to `/account-expired` with resend option
> - Login handles 403 with clear messaging
> - Bypass mode shows username flow instead of email flow
> - Bypass-mode user can add an email address in Settings later
> - Notification bell is wired up (even if just a placeholder panel for MVP)
> - Settings "Desktop notifications" toggle works end-to-end
> - All existing tests pass

---

## Checkpoint Summary

| CP | Deliverable | Phase | Verification method |
|---|---|---|---|
| CP-1 | Per-IP limit + admin API | 1 | curl > N signups → 429; admin endpoints work with secret |
| CP-2 | Bypass mode (username + password) | 2 | Register with username only, login with username, emailVerified=true |
| CP-3 | Email sending + verification | 3 | Real email sent (or logged to console), verify link works, 60s resend cooldown |
| CP-4 | Grace period | 4 | New account logs in, expired (7d+) account gets 403 with sessions revoked |
| CP-5 | Web Push notifications (offline delivery) | 5 | SW registered, push received while tab is closed, reminders cancelled on completion |
| CP-6 | Frontend UX: all flows polished | 6 | Post-signup page, grace banner, account-expired page, bell icon, settings toggle |

### Testing strategy per phase

| Phase | New tests needed |
|---|---|
| 1 | `ip-limits.test.ts`, `admin.test.ts`, auth-bridge IP check in `auth.test.ts` |
| 2 | Bypass mode registration + username login in `auth.test.ts` |
| 3 | `email.test.ts` (unit), `email-rate-limit.test.ts`, auth-bridge verification in `auth.test.ts` |
| 4 | Grace-period scenarios in `auth.test.ts` (unverified login, expired login, verify then login, session invalidation) |
| 5 | `push.test.ts` (backend: subscribe, unsubscribe, send, reminder cancellation), SW registration test |
| 6 | Component tests for verify-email, grace-banner, account-expired, login variations |

---

## Env Vars Reference

### Phase 1

| Variable | Default | Description |
|---|---|---|
| `MAX_ACCOUNTS_PER_IP` | `5` | Max signups from a single IP. Set to `0` to disable. Self-hosted: `1000` |
| `ADMIN_SECRET` | *(unset)* | If set, enables `/admin/*` endpoints. Must be a long random string (≥32 chars) |

### Phase 2

| Variable | Default | Description |
|---|---|---|
| `BYPASS_EMAIL_REGISTRATION` | `false` | When `true`, registration uses username + password only, no email needed |

### Phase 3

| Variable | Default | Description |
|---|---|---|
| `EMAIL_PROVIDER` | *(unset)* | `resend`, `mailgun`, or unset for console logging |
| `RESEND_API_KEY` | *(unset)* | Resend API key |
| `RESEND_FROM` | `noreply@yotara.app` | From address for Resend emails |
| `MAILGUN_API_KEY` | *(unset)* | Mailgun API key |
| `MAILGUN_DOMAIN` | *(unset)* | Mailgun sending domain |
| `MAILGUN_FROM` | `noreply@yotara.app` | From address for Mailgun emails |

### Phase 4

| Variable | Default | Description |
|---|---|---|
| `GRACE_PERIOD_DAYS` | `7` | Days an unverified account can log in. Set to `0` to require immediate verification |

### Phase 5

| Variable | Default | Description |
|---|---|---|
| `VAPID_PUBLIC_KEY` | *(required)* | Web Push VAPID public key (generate via `scripts/generate-vapid-keys.mjs`) |
| `VAPID_PRIVATE_KEY` | *(required)* | Web Push VAPID private key |
| `VAPID_SUBJECT` | `mailto:admin@yotara.app` | Contact email for push service |
| `DUE_REMINDER_CHECK_INTERVAL` | `300` | Seconds between due-date check cycles |

### docker-compose.yml defaults (self-hosted)

```yaml
environment:
  MAX_ACCOUNTS_PER_IP: 1000              # Self-hosted: high limit
  BYPASS_EMAIL_REGISTRATION: "true"       # Self-hosted: no email fuss
  GRACE_PERIOD_DAYS: 7
  EMAIL_PROVIDER: ""                      # Configure at will
  RESEND_API_KEY: ""
  # VAPID keys — optional, generate via script
  VAPID_PUBLIC_KEY: ""
  VAPID_PRIVATE_KEY: ""
```

---

## Rollback Plan

Each phase is independently reversible.

| Phase | Rollback action | Data loss? |
|---|---|---|
| 1 | Remove `ip-limits.ts`, revert `auth-bridge.ts`, remove admin routes | No (`signup_ips` table can stay) |
| 2 | Set `BYPASS_EMAIL_REGISTRATION=false`, revert frontend login form | No (username columns stay, unused) |
| 3 | Remove `email.ts`, revert `auth.ts` config | No |
| 4 | Remove grace-period check from `auth-bridge.ts`, remove from `/me` | No |
| 5 | Remove SW registration, remove push routes, revert settings | Yes — `push_subscriptions` data lost, but no user data |
| 6 | Revert frontend components and routes | No |

**Per-sprint rollback PR pattern:**
1. Features are behind env var gates (default-off where possible)
2. Each phase is a separate PR with its own set of migrations
3. If a phase needs reverting, revert the PR and the migration SQL is a no-op (SQLite ignores `CREATE TABLE IF NOT EXISTS`)
