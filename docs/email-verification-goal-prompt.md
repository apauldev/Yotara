# Goal: implement email-first signup + verification

The **email-first signup + verification + anti-bot flow** specified in `docs/email-verification-design.md` is implemented on branch **`beta-release`**. Use this prompt only as the original implementation brief; consult the implementation log for current status.

## Ground rules

1. **Read the design doc first** — it is the spec. Treat the "Remaining decisions" section's recommendations as decided unless they contradict "Decisions locked". If the doc conflicts with reality, flag it — don't silently improvise.
2. **Work in the doc's implementation order** (API first, then frontend, then tests).
3. **Commit what is done** — atomic conventional commits (`feat(api):`, `fix(frontend):`, `test(api):`...) after each numbered checklist item. Never end the session with uncommitted work. Include the repo's required DCO sign-off line in every commit.
4. **Update and run tests** — every behavior change ships with updated/new tests; the full suite must be green before finishing: API `pnpm --filter @yotara/api test` (`NODE_ENV=test`), frontend `pnpm --filter @yotara/frontend test` (Karma + Jasmine), then the full gate `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
5. **Keep a log** — maintain `docs/email-verification-implementation-log.md`; append after every step (what changed, files, test results, commit SHA/message) and commit it with the step. Record blockers/deferrals with reasons.
6. **Don't touch login** — the login form is identical in every env; only signup differs. Existing login specs must pass unchanged.
7. **Don't fix unrelated things** — scope is the email doc only; log unrelated bugs, don't fix them.

## Non-negotiable behaviors (see doc for full detail)

- **Gating**: `requireEmailVerification` and the 24h unverified-cleanup are on when `NODE_ENV=production` **or** `REQUIRE_EMAIL_VERIFICATION=true` (dev/test override to exercise the full flow locally, console-printed links and all). Default dev/test: registration unchanged (email + password, no email).
- **Email-first (prod)**: signup = name + email only; throwaway placeholder password `email + 5 random letters` satisfies Better Auth's password requirement; user sets a real password after clicking the 15-min link, is auto-signed-in, sees "Your email is verified" + a Verified badge in the portal.
- **Anti-bot**: hidden `website` honeypot on signup → fake success, record IP, **24h IP ban** (`SIGNUP_IP_BAN_MS`), no user/email. Max **1 resend** (30-min cooldown via `email-rate-limit.ts` `'verify'` type). Unverified accounts deleted after **24h** (boot + hourly job). Unverified sign-ins return distinct 403 (`EMAIL_NOT_VERIFIED`) **without burning a lockout attempt**.
- **Email safety**: console fallback only in dev/test; prod fails loudly if `RESEND_API_KEY` unset; HTML-escape `user.name`, attribute-escape `url`; `EMAIL_FROM` on `email.yotara.website`.
- **Runtime flag**: API exposes `requireEmailVerification` (e.g. `/me` or config endpoint) so the frontend picks the right signup form with one build — respecting the override so dev-with-flag shows the email-first form too.

## Finish criteria

- All checklist items implemented and committed.
- New + existing tests pass; full gate green.
- `docs/email-verification-implementation-log.md` documents every step with test results and commit SHAs.
- Working tree clean.

## When you're done

Report: summary, test results, commit list, deviations/blockers with reasons, and anything the human should verify manually (e.g. registering on the beta).

Do not add co-authored by command code in any commit or work. Do not commit extra documents that already exist.