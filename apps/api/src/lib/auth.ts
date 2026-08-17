import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client.js';
import { accounts, sessions, users, verifications } from '../db/schema.js';
import {
  getAppBaseUrl,
  getFrontendResetUrl,
  getFrontendVerificationUrl,
  getTrustedOrigins,
} from './auth-origins.js';
import { devMode } from './dev-mode.js';
import { assertAuthSecretConfigured } from './auth-secret.js';

const appBaseUrl = getAppBaseUrl();
const trustedOrigins = getTrustedOrigins();
const useSecureCookies =
  process.env['NODE_ENV'] === 'production' || appBaseUrl.startsWith('https://');

/**
 * Whether email verification is required for sign-in.
 *
 * Always false in dev mode (which flips the require-email flag and prevents
 * email validation from impeding local/test work). Otherwise true in
 * production, or in any env when REQUIRE_EMAIL_VERIFICATION=true (the
 * dev/test override so the email-first flow is testable locally). False
 * otherwise — dev/test default keeps registration frictionless.
 *
 * This is the single source of truth for gating: auth config, the runtime flag
 * exposed to the frontend, and the unverified-account cleanup all read it.
 */
export function emailVerificationRequired(): boolean {
  if (devMode()) {
    return false;
  }
  return (
    process.env['NODE_ENV'] === 'production' || process.env['REQUIRE_EMAIL_VERIFICATION'] === 'true'
  );
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
  user: {
    additionalFields: {
      passwordSetupRequired: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        returned: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          if (
            emailVerificationRequired() &&
            context?.request?.url.includes('/auth/sign-up/email')
          ) {
            return { data: { ...user, passwordSetupRequired: true } };
          }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: emailVerificationRequired(),
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 3600, // 1 hour (matches email copy)
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import('./email.js');
      // The email must link straight to the frontend, not the API's
      // redirect-based callback route (whose empty-callbackURL failure mode
      // dead-ends on /auth/error?error=INVALID_TOKEN).
      await sendPasswordResetEmail(user, getFrontendResetUrl(url));
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
      await sendVerificationEmail(user, getFrontendVerificationUrl(url));
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
