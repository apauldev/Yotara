import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client.js';
import { accounts, sessions, users, verifications } from '../db/schema.js';
import { getAppBaseUrl, getTrustedOrigins } from './auth-origins.js';

const appBaseUrl = getAppBaseUrl();
const trustedOrigins = getTrustedOrigins();
const useSecureCookies =
  process.env['NODE_ENV'] === 'production' || appBaseUrl.startsWith('https://');

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
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      const { sendPasswordResetEmail } = await import('./email.js');
      await sendPasswordResetEmail(user, url);
    },
  },
  // Wired up but dormant: requireEmailVerification is false above, so this
  // callback will only fire when that flag is flipped to true.
  emailVerification: {
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
});
