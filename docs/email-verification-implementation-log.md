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
| `7d6edbd` | docs: note E2E coverage and unit coverage in implementation log |
| `d89b9bf` | test(e2e): cover email-first signup and make setup mode-aware |
| `638242a` | test(api): cover cleanup job lifecycle (start/stop/idempotent) |
| `4052666` | fix(api): remove orphaned rows when cleaning up unverified accounts |
| `935832b` | fix(frontend): show signup error instead of check-email on failure |
| `9f12faf` | fix(auth): throttle verification email resends |
| `087adb4` | fix(auth): route verification links to frontend |
| `caa2fee` | fix(auth): restrict initial password setup |
| `ccef0cf` | fix(auth): honor passwordSetupRequired in verify flow |
| `53aedb0` | fix(auth): route password-reset links to the frontend |
| pending | fix(auth): harden production secret validation and complete dev-mode/deployment batching |

## Test results

- API: `pnpm --filter @yotara/api test` → **245/245 pass** (including dev-mode, secret validation, email safety, runtime config, verification, cleanup, and anti-abuse coverage).
- Frontend: `pnpm --filter @yotara/frontend test` → **653/653 pass**.
- Repository: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` — all pass; lint emits existing warnings only.
- Docker: isolated image build plus `pnpm smoke:docker` through the published nginx port — pass.
- E2E: CI now passes explicit runtime-config and API-log environment variables and always cleans services; local email-first execution requires running the Angular dev server against the same API port because the default environment points at port 3000.

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

