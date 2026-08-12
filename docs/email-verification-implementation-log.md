# Email verification implementation log

Status: **Complete** — all checklist items from `docs/email-verification-design.md` implemented on `beta-release`, tests green.

## Summary

Implemented the email-first signup + verification + anti-bot flow:

- Verification is required when `NODE_ENV=production` **or** `REQUIRE_EMAIL_VERIFICATION=true` (dev/test override). Default dev/test registration is unchanged.
- Signup (verification required) collects name + email only; a throwaway placeholder password (`email + 5 random letters`) satisfies Better Auth's password requirement. Login is untouched.
- Verification link expires in 15 min; clicking it auto-signs-in and lands on a set-password step (`/me/password/set`, no current password required), then onboarding with a "Your email is verified" toast.
- Anti-bot: hidden `website` honeypot → fake success + 24h IP ban (`SIGNUP_IP_BAN_MS`); 1 resend per 30 min (`email-rate-limit.ts` `'verify'` type); unverified accounts deleted after 24h by a boot + hourly cleanup job (gated on verification being required).
- Unverified sign-ins return `403 EMAIL_NOT_VERIFIED` without burning a lockout attempt.
- Email safety: console fallback only in dev/test; production fails loudly without `RESEND_API_KEY`; HTML/attribute escaping in templates; `EMAIL_FROM` defaults to `noreply@email.yotara.website`.
- Runtime flag: `GET /config` returns `requireEmailVerification`; the frontend renders the right signup form with one build.
- Settings shows the email with a Verified/Unverified badge.

## Commits

| SHA | Message |
|:---|:---|
| `8604d7e` | feat(api): gate email verification by env and harden email sending |
| `b036849` | feat(api): expose requireEmailVerification runtime flag |
| `740bf73` | feat(api): verify-resend rate limit and unverified-account cleanup |
| `ce0eb89` | feat(api): honeypot IP ban and unverified-sign-in handling |
| `055be45` | feat(auth): email-first signup, verify landing, and set-password endpoint |
| `d444231` | test(frontend): cover email-first signup and verify-email flow |
| `cebe7ec` | feat(frontend): show email with a Verified badge in settings |

## Test results

- API: `NODE_ENV=test pnpm exec tsx --test src/**/*.test.ts` → **220/220 pass** (incl. new: /config env gating, honeypot ban, unverified sign-in 403 without lockout burn, verify-resend 30-min cooldown, cleanup gating/age cutoff, email escaping, prod fail-loud without RESEND_API_KEY, set-password endpoint).
- Frontend: `ng test --no-watch --browsers ChromeHeadless` → **644/644 pass** (incl. new: email-first signup form + check-email screen, honeypot passthrough, verify-email component).
- `pnpm --filter @yotara/api typecheck`, `@yotara/shared typecheck`, `@yotara/frontend typecheck` — all clean.

## Notes / decisions applied

- No new endpoint for set-password-after-verification beyond `/me/password/set` (the placeholder is random and unrecoverable, so the endpoint must not require the current password; it is gated on an authenticated + email-verified session, or any authenticated session when verification is not required).
- The unverified-sign-in test runs in a subprocess because the gating is read at module load (env-at-boot contract).
- `email_sends` CHECK constraint migration recreates the table (transient rate-limit data), matching the existing `login_attempts` migration pattern.
- Docs (`email-verification-design.md` etc.) remain untracked per instruction.

## E2E + coverage follow-up (2026-08-12)

### E2E

- The suite had **no coverage of the email-first flow** and the global-setup broke when `REQUIRE_EMAIL_VERIFICATION=true`. Fixed:
  - `e2e/specs/login/email-first.spec.ts` (new): signs up with email only → check-email screen → reads the verification link from the API log → verify → set password → onboarding. **Skipped when the flag is off** (CI default).
  - `e2e/global-setup.ts`: mode-aware — legacy password signup (flag off) or email-first verify+set-password (flag on).
  - `e2e/specs/authenticated/onboarding.spec.ts`: shared mode-aware `signUp` helper.
- **Key finding**: Better Auth emails a **JWT** verification link and does **not** persist the token in the `verification` table, so the E2E reads the token from the API's console log (`E2E_API_LOG` env).
- Verified: **77/77 pass** with the flag on; **76 pass + 1 skip** in the default CI mode (the email-first spec correctly skips).

### Unit coverage

- Frontend (`ng test --code-coverage`): **84.16% stmts / 69.58% branch / 80.87% funcs / 85.12% lines**. New auth files: login.component 95.2%, verify-email 94.6%, auth-state.service 88.1%, settings-page 100%.
- API (`c8`): **94.43% stmts / 79.44% branch / 90.05% funcs / 94.43% lines**. New files: auth-bridge 93.97%, config 100%, blocked-ips 89.47%, email-rate-limit 98.36%, email-cleanup 65.3% → raised to ~90% with lifecycle tests (start/stop/idempotent + orphan-row cleanup).

