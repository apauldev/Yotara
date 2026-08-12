import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client.js';
import { accounts, sessions, users, verifications } from '../db/schema.js';
import { getAppBaseUrl, getTrustedOrigins } from './auth-origins.js';

const appBaseUrl = getAppBaseUrl();
const trustedOrigins = getTrustedOrigins();
const useSecureCookies =
  process.env['NODE_ENV'] === 'production' || appBaseUrl.startsWith('https://');

const DEFAULT_AUTH_SECRET = 'local-dev-secret-change-me';

/**
 * Whether email verification is required for sign-in.
 *
 * True in production, or in any env when REQUIRE_EMAIL_VERIFICATION=true (the
 * dev/test override so the email-first flow is testable locally). False
 * otherwise — dev/test default keeps registration frictionless.
 *
 * This is the single source of truth for gating: auth config, the runtime flag
 * exposed to the frontend, and the unverified-account cleanup all read it.
 */
export function emailVerificationRequired(): boolean {
  return (
    process.env['NODE_ENV'] === 'production' || process.env['REQUIRE_EMAIL_VERIFICATION'] === 'true'
  );
}

function assertAuthSecretConfigured(): void {
  const secret = process.env['BETTER_AUTH_SECRET'];
  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  if (
    nodeEnv !== 'development' &&
    nodeEnv !== 'test' &&
    (!secret || secret === DEFAULT_AUTH_SECRET)
  ) {
    throw new Error(
      'Refusing to start: BETTER_AUTH_SECRET is missing or still set to the default ' +
        'placeholder. Generate a strong, unique secret (e.g. `openssl rand -base64 32`) ' +
        'and set it in production, otherwise session tokens are forgeable.',
    );
  }
}

// Evaluated at module load so the guard runs before the server serves traffic.
assertAuthSecretConfigured();

export const auth = betterAuth({
  baseURL: appBaseUrl,
  basePath: '/auth',
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: emailVerificationRequired(),
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 3600, // 1 hour (matches email copy)
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import('./email.js');
      await sendPasswordResetEmail(user, url);
    },
  },
  emailVerification: {
    // 15-minute verification link (matches the email copy).
    expiresIn: 900,
    // Auto-create a session once the email link is clicked, so the user can
    // set a real password immediately (the account starts with a throwaway
    // placeholder password).
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const { sendVerificationEmail } = await import('./email.js');
      await sendVerificationEmail(user, url);
    },
  },
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      secure: useSecureCookies,
    },
    useSecureCookies,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh after 24 hours
  },
});
