# Design: Email-first signup + verification (anti-bot)

Status: **Implemented on `beta-release`.** This document remains the design reference; see `docs/email-verification-implementation-log.md` for implementation and validation history.

## Decisions locked (your calls)

- **Email-first flow**: no password collected before email verification. Industry-standard pattern (Basecamp, Notion, Linear-style). Bots that can't receive email never reach a password step.
- **No "unverified" state in the app**: an account is either verified (fully usable) or deleted. No interstitial, no partial access.
- **IP ban**: 24h, after honeypot trigger, configurable via env.
- **Email provider**: Resend (`RESEND_API_KEY`). From domain **`email.yotara.website`**.
- **Beta link base**: **`https://beta.yotara.website/`** (the email's verification URL must point here).
- **Dev + test env**: verification disabled by default — register with email + password as today, no email required.
- **Dev email-flow override flag**: `REQUIRE_EMAIL_VERIFICATION=true` forces the full email-first flow **in dev/test too** (including the 15-min link + set-password + cleanup), so the flow is testable locally before it ever reaches prod. It's off by default — normal dev stays frictionless.
- **Login never changes**: the login form is identical in dev and prod — same fields, same behavior. Only the **signup** path differs: prod = email-only first step (then set password after verification); dev/test (flag off) = the current single-screen name + email + password form; dev/test (flag on) = the email-first flow, same as prod. No wizard, no auto-advance in dev.

## Goal

- A real user enters **name + email only** → gets a verification email (valid **15 min**) → clicks the link → lands on a **"set your password"** page → sets a password → is signed in → sees **"Your email is verified"**.
- Inside the portal, the email shows a **Verified** badge.
- **Bots / disposable signups are the enemy**: a honeypot catches naive bots; triggered honeypot → 24h IP ban. Any account that never completes verification is **deleted after 24h**.
- **At most 1 resend** of the verification email before a cooldown.

## The flow (end-to-end)

### Happy path

1. User submits signup form: **name + email** (no password field).
2. API checks honeypot: hidden `website` field empty → proceed. (Non-empty → fake "Check your email" success, IP recorded → 24h ban.)
3. API creates the account with a **throwaway placeholder password** — `email + 5 random letters` (required by Better Auth, see constraint below), `emailVerified = false`, generates a 15-min verification token, emails it.
4. User clicks the link → lands on **`https://beta.yotara.website/auth/verify-email?token=...`**.
5. Better Auth's `verifyEmail` marks `emailVerified = true`; with `autoSignInAfterVerification` (see note) the user is then taken to the **"set your password"** step.
6. User sets a real password → session created → portal. Toast: **"Your email is verified."** Settings/profile shows the email with a **Verified** badge.
7. If the user never clicks (or never sets a password): the 24h cleanup deletes the account.

### Dev / test flow (default, unchanged)

- `NODE_ENV=development|test` and `REQUIRE_EMAIL_VERIFICATION` **unset/not `true`** → `requireEmailVerification: false`, signup with email + password works as it does today. No email required. This is the gate that makes local/CI testing trivial.
- **Login is identical in every env** (dev, test, prod): same form, same fields, same behavior. Only the signup path changes shape between envs.

### Dev / test flow (email-flow override on)

- Setting `REQUIRE_EMAIL_VERIFICATION=true` in dev/test forces the **full email-first flow** — email-only signup, 15-min verification link (printed to console when no `RESEND_API_KEY`), set-password after verify, and the 24h cleanup job. Use this to test the flow locally end-to-end before it reaches prod.

## Better Auth capabilities + constraint (verified against installed v1.5.4)

- `emailVerification.expiresIn` — token lifetime (default 3600s; we set **900s = 15 min**).
- `emailVerification.autoSignInAfterVerification` — auto-creates a session after clicking the link (`email-verification.mjs:270`).
- Built-in endpoints: `signUpEmail`, `sendVerificationEmail` (resend), `verifyEmail` (token consumption), plus `EMAIL_NOT_VERIFIED` error code.
- **Constraint**: `signUpEmail` **requires a password** field and validates/hashes it (`sign-up.mjs:18,151-173`). There is no "email-only registration" flag. So the email-first flow must use a **throwaway placeholder password** at signup — `email + 5 random letters` (e.g. `jordan@example.comxq7zw`) — then let the user set a real password after verification (Better Auth exposes password reset for this).
  - **Why this placeholder is safe**: it's never shown to the user, it can't be used to sign in (unverified sign-ins are blocked by `EMAIL_NOT_VERIFIED`, and once verified the user sets a real password immediately), login lockout + rate limits make brute-forcing the 5-letter space (26⁵ ≈ 11.9M) impractical, and the account is deleted in 24h if verification never completes. The placeholder is also guaranteed to pass Better Auth's min-length (8) check — email alone is always ≥ 8 — and stays under max (128) by truncating.
  - (If you'd rather not think about it at all, `crypto.randomBytes(16).toString('base64url')` is the same amount of code — but email+5 letters is fine given the above.)

## What we need to change (implementation checklist)

### API

1. **`apps/api/src/lib/auth.ts`**
   - `emailAndPassword.requireEmailVerification` is **true** when `NODE_ENV=production` **or** `REQUIRE_EMAIL_VERIFICATION=true` (the dev/test override). Otherwise false.
   - Add `emailVerification.expiresIn: 900` (15 min) and `emailVerification.autoSignInAfterVerification: true`.
   - The verification `url` built by Better Auth must resolve to **`https://beta.yotara.website/...`** in production — configure the app base URL / callback base accordingly (see Dependencies).

2. **`apps/api/src/lib/email.ts` — production-safe email sending (from precheck 1.1/1.2)**
   - Only log emails to console when `NODE_ENV` is `development` or `test`.
   - In production, fail loudly (startup or send) when `RESEND_API_KEY` is unset — never silently fall back to logging.
   - HTML-escape `user.name` and attribute-escape `url` in templates. **Required** now that emails contain real verification links.
   - `EMAIL_FROM` set to something on **`email.yotara.website`** (e.g. `noreply@email.yotara.website` or `noreply@yotara.website` per Resend's sending domain).

3. **Signup accepts name + email only (frontend sends placeholder password)**
   - Frontend signup submits a throwaway placeholder password = **`email + 5 random letters`** (never shown, never usable) so Better Auth's `signUpEmail` works. After verification the user sets a real password (item 7). The placeholder is discarded/overwritten — the account is deleted in 24h if verification never completes anyway.

4. **Resend + cleanup** (new file, e.g. `apps/api/src/lib/email-cleanup.ts`)
   - Periodic job (interval + run on boot) deleting users where `emailVerified = false` and `createdAt < now - 24h`. FK cascade removes orphaned rows.
   - Deleted users can retry signup with the same email later (no permanent block).

5. **Honeypot + IP ban**
   - Honeypot: hidden `website` field on the signup form (CSS-hidden, `tabindex=-1`, `autocomplete=off`). Bot fills it → fake success message ("Check your email"), record IP, **no user created, no email sent**.
   - IP ban: after honeypot trigger, ban that IP for **24h** (configurable, e.g. `SIGNUP_IP_BAN_MS`). Enforced in the auth bridge — 403 for `/auth/sign-up/email` and related auth endpoints from a banned IP.
   - Ban keyed on `request.ip` — relies on trustProxy topology (nginx front). EC2 already does this (precheck 1.3).

6. **Sign-in UX for unverified users (belt-and-suspenders)**
   - With verification required, Better Auth blocks sign-in with `EMAIL_NOT_VERIFIED` (403). The auth bridge currently treats any non-200 as a bad password and burns a lockout attempt (`auth-bridge.ts:165-180`). **We must not count an unverified sign-in as a failed password attempt.**
   - Return a distinct 403 with a `{ code: 'EMAIL_NOT_VERIFIED' }`-style body + resend cooldown, so the frontend can say "Please verify your email" instead of "Invalid password". In practice this state should be rare (accounts are deleted in 24h), but it must not lock a real user out.

7. **Set-password-after-verification endpoint**
   - After `verifyEmail` succeeds, the user must set a real password. Simplest is Better Auth's existing password-reset flow (token-based) driven from the verified landing page; or a small custom endpoint gated on a verified session. Pick at implementation; the UX must be "you verified — now choose a password" with no extra email.

### Frontend

8. **Signup form** (`login.component.ts`)
   - **Login form is untouched** in every env — same fields, same behavior.
   - **Signup** renders based on a runtime flag (see below): in dev/test it stays the current single-screen name + email + password form; in prod it becomes the email-only first step.
   - Add hidden `website` honeypot input.
   - On submit (prod): show "Check your email — we sent a verification link (valid 15 minutes)" screen. **Do not** auto-login.
   - `auth-state.service.ts` `signUp()` must not call `refreshSession()` for unverified signups (gate it: only auto-login when verification is not required / session actually created).
   - **Runtime mode flag**: the API exposes whether verification is required (e.g. `/me` or a config endpoint returns `requireEmailVerification: true|false`, derived from `NODE_ENV` on the server). The frontend reads it once at startup to decide which signup form to render — same build works in dev, CI, and on EC2 without a rebuild.

9. **Verify landing + set password + auto-login**
   - Route for `/auth/verify-email?token=...`: call Better Auth's `verifyEmail` client endpoint; show **"Your email is verified — set your password"**; then the password step; then `refreshSession()`; toast "Your email is verified"; navigate to portal.

10. **Email + verified badge in portal**
    - Settings/profile: show the account email with a **Verified** badge (green check). Since there's no unverified state, the badge is informational (e.g. for future use or to reassure the user).

11. **Resend policy (1 resend)**
    - Signup auto-sends email #1. User can request exactly **1 resend**, then a cooldown (e.g. 30 min). Extend `EmailType` with `'verify'` in `email-rate-limit.ts`; tighten: 1 per 30 min for verify type.
    - Use Better Auth's `sendVerificationEmail` endpoint for the resend path.

## Anti-bot strategy (locked)

| Measure | Decision |
|:---|:---|
| Honeypot field | Hidden `website` input on signup; any value → fake success + IP recorded, no user/email |
| IP ban | **24h** after honeypot trigger; `SIGNUP_IP_BAN_MS` env; enforced in auth bridge (403) |
| Resend | **1 resend**, then 30-min cooldown |
| Link expiry | **15 min** (`expiresIn: 900`) |
| Unverified deletion | **24h** background cleanup + on boot; hard delete; same email can retry later |
| No unverified state | Verified accounts only in the app; unverified sign-ins return a distinct 403 (no lockout burn) |
| Existing rate limits | Keep: 1/type/5min, 3 total/hr, **5 unique emails/IP/hr** — consider lowering IP cap to 3 for beta |
| Fake success for existing emails | Keep generic "Check your email" so we don't leak which addresses exist |

## Files touched (summary)

| File | Change |
|:---|:---|
| `apps/api/src/lib/auth.ts` | Enable verification in prod only; 15-min expiry; auto-sign-in |
| `apps/api/src/lib/email.ts` | Escape values; production-only send; `EMAIL_FROM` on email.yotara.website |
| `apps/api/src/lib/email-rate-limit.ts` | Add `'verify'` type; 1 resend per 30 min |
| `apps/api/src/plugins/auth-bridge.ts` | Handle `EMAIL_NOT_VERIFIED` (no lockout burn); IP-ban check |
| `apps/api/src/lib/email-cleanup.ts` (new) | Delete unverified accounts >24h; boot + interval |
| `apps/api/src/lib/blocked-ips.ts` (new) | IP ban table + check |
| `apps/api/src/db/schema.ts` | (if needed) `blocked_ips` table |
| `apps/api/src/db/client.ts` | (if needed) create `blocked_ips` table |
| `apps/api/src/routes/...` | (if needed) set-password-after-verification endpoint |
| `apps/frontend/src/app/features/auth/login.component.ts` | Email-first signup (prod only, via runtime flag); login untouched; honeypot; "check your email" state; verify landing; set-password; resend |
| `apps/frontend/src/app/core/services/auth-state.service.ts` | Gate `refreshSession()`; add `verifyEmail()` / resend / set-password calls |
| `apps/api/src/routes/...` (or `/me`) | Expose `requireEmailVerification` runtime flag for the frontend |
| `apps/frontend/src/app/features/personal/settings` (or profile) | Show email + Verified badge |

## Suggested implementation order

1. **API**: prod-only `requireEmailVerification` + expiry + auto-sign-in; email escaping + production-only send + `EMAIL_FROM`.
2. **API**: signup with placeholder password; resend policy + `EMAIL_NOT_VERIFIED` handling.
3. **API**: set-password-after-verification.
4. **API**: cleanup job (delete unverified >24h).
5. **API**: honeypot + IP ban.
6. **Frontend**: email-first signup form + "check your email" state; verify landing + set password + auto-login + toast; verified badge; resend button; honeypot field.
7. **Tests**: API — prod requires verification, dev/test does not, verify-email success + auto-sign-in, unverified sign-in 403 without lockout burn, resend cooldown, cleanup job, honeypot/IP ban. Frontend — new states.

## Remaining decisions (with my recommendations)

These are the implementation-time calls left open after the locked decisions. Defaults below are what I'd go with unless you say otherwise.

1. **Gating of cleanup + verification (most important).**
   Better Auth sets `emailVerified: false` on **every** signup, even in dev (`sign-up.mjs:180,224` — the flag only gates *sending* the email, not the field). So the 24h cleanup job would delete dev users if it ran by default in dev/test.
   **Recommendation**: verification is on when `NODE_ENV=production` **or** `REQUIRE_EMAIL_VERIFICATION=true`; the cleanup job runs under the **same condition** (so dev-with-override gets the real flow, including deletion). Dev/test without the flag keeps register-without-email forever. The frontend learns this from a **runtime flag exposed by the API** (see item 8) so one build works everywhere.

2. **Verification link base in Better Auth.**
   The `url` in the verification email is built by Better Auth from `APP_BASE_URL` (currently defaults to `http://localhost:8080/api` in docker). The verify route lives under `/auth`.
   **Recommendation**: set `APP_BASE_URL=https://beta.yotara.website/api` on EC2, and have the frontend serve the verify route (`/auth/verify-email?...`) so the email link resolves to the Angular app. Confirm the exact callback shape at implementation.

3. **Where the user lands + who sets the password.**
   **Recommendation**: a **frontend route** that shows "Your email is verified — set your password", calling `verifyEmail` then a set-password action. **No second email** (don't use Better Auth's token-reset email for this). This is the smoothest UX.

4. **Cleanup timing + interval.**
   **Recommendation**: delete when `createdAt + 24h` has passed (token dies in 15 min anyway). Job runs on boot + **hourly** interval (24h deadline doesn't need minute precision).

5. **Where the resend button lives.**
   **Recommendation**: include the **resend button on the "Check your email" screen** — that's where the user is looking. (1 resend, 30-min cooldown, already locked.)

6. **Exact `EMAIL_FROM` sender.**
   **Recommendation**: `noreply@email.yotara.website` (the domain you specified; must be verified in Resend).

7. **Toast + badge both?**
   **Recommendation**: yes, ship both — toast "Your email is verified" on landing + Verified badge in settings/profile. Tiny extra.

8. **Migration for `blocked_ips`.**
   New table → needs a Drizzle migration (`db:generate`). In scope, not a decision — flagging it so it isn't missed.

## Dependencies / gotchas

- **Better Auth version**: v1.5.4 supports everything used here. The password-requirement constraint is the main seam (placeholder password + set-password-after-verification).
- **App base URL**: the verification link must point at `https://beta.yotara.website/` in prod — set `APP_BASE_URL`/Better Auth baseURL accordingly (currently defaults to `http://localhost:8080/api`; see `auth-origins.ts` / docker env). The callback/verify URL is built from this.
- **trustProxy / nginx**: IP ban + rate limiting key off `request.ip` behind the nginx front. On EC2, only 8080 exposed (precheck 1.3). Never expose the API directly.
- **Local dev**: with no `RESEND_API_KEY`, verification links print to the console (dev/test only, or dev with `REQUIRE_EMAIL_VERIFICATION=true`) — that's how you'll test the flow locally. In prod, missing `RESEND_API_KEY` must fail loudly.
- **Lockout interplay**: unverified sign-in must not increment the failed-attempt lockout; verify the auth bridge's non-200 handling.
- **EC2 deploy**: set `APP_BASE_URL=https://beta.yotara.website/api` (or the verify URL base) + `EMAIL_FROM` on the sending domain + `RESEND_API_KEY`, and confirm `TRUSTED_ORIGINS` includes `https://beta.yotara.website`.
