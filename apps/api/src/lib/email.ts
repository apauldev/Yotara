import { Resend } from 'resend';
import { checkEmailRateLimit, type EmailType } from './email-rate-limit.js';
import { emailToConsole } from './dev-mode.js';

const RESEND_API_KEY = process.env['RESEND_API_KEY'] ?? '';
const EMAIL_FROM = process.env['EMAIL_FROM'] ?? 'noreply@email.yotara.website';
const APP_NAME = 'Yotara';
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';

/**
 * Console fallback (logging the email body, which contains the verification or
 * reset link) is permitted in development/test, or whenever dev mode asks for
 * console emailing. In production, sending an email with no provider
 * configured must fail loudly — never silently leak a reset/verification link
 * into the container logs.
 */
const consoleFallbackAllowed =
  NODE_ENV === 'development' || NODE_ENV === 'test' || emailToConsole();

function assertEmailConfigured(): void {
  if (!RESEND_API_KEY && !consoleFallbackAllowed) {
    throw new Error(
      'RESEND_API_KEY must be set in production: email verification and password ' +
        'reset depend on it, and emails must never be logged to the console outside ' +
        'development/test.',
    );
  }
}

// Evaluated at module load so a misconfigured production deployment fails fast.
assertEmailConfigured();

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Attribute-escape a URL for use inside an href value. */
export function escapeAttribute(value: string): string {
  // HTML attribute context: escape quotes, angle brackets, and ampersands.
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll("'", '&#39;');
}

export function getResend(): Resend | null {
  // Dev mode with emailToConsole never sends real email — a configured
  // RESEND_API_KEY is deliberately ignored so local/test runs can't spam
  // real inboxes (the links are logged to the console instead).
  if (emailToConsole()) {
    return null;
  }
  const key = process.env['RESEND_API_KEY'] ?? '';
  if (!key) {
    return null;
  }
  return new Resend(key);
}

async function sendEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const resend = getResend();

  if (!resend) {
    // Dev/test only fallback — log instead of sending. Production is blocked
    // by assertEmailConfigured() above.
    console.log(`[email] To: ${payload.to}`);
    console.log(`[email] Subject: ${payload.subject}`);
    console.log(`[email] Body:\n${payload.text}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });

  if (error) {
    console.error(`[email] Failed to send to ${payload.to}:`, error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Check rate limit and throw if exceeded.
 * Call this BEFORE sending, then call recordEmailSend AFTER successful send.
 */
export function checkRateLimitOrThrow(email: string, type: EmailType, clientIp?: string): void {
  const result = checkEmailRateLimit(email, type, clientIp);
  if (!result.allowed) {
    const err = new Error(
      `Too many ${type} requests. Please try again in ${Math.ceil(result.retryAfterSeconds! / 60)} minutes.`,
    ) as Error & { statusCode: number; retryAfterSeconds: number };
    err.statusCode = 429;
    err.retryAfterSeconds = result.retryAfterSeconds!;
    throw err;
  }
}

export async function sendVerificationEmail(user: { email: string; name: string }, url: string) {
  const displayName = user.name || 'there';
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeAttribute(url);
  await sendEmail({
    to: user.email,
    subject: `Verify your ${APP_NAME} account`,
    text: `Hi ${displayName},

Thanks for signing up for ${APP_NAME}!

Click the link below to verify your email address:
${url}

This link will expire in 15 minutes.

If you didn't create an account, you can safely ignore this email.

— The ${APP_NAME} Team`,
    html: `<p>Hi ${safeName},</p>
<p>Thanks for signing up for <strong>${APP_NAME}</strong>!</p>
<p><a href="${safeUrl}">Click here to verify your email address</a></p>
<p>This link will expire in 15 minutes.</p>
<p>If you didn't create an account, you can safely ignore this email.</p>
<p>— The ${APP_NAME} Team</p>`,
  });
}

export async function sendPasswordResetEmail(user: { email: string; name: string }, url: string) {
  const displayName = user.name || 'there';
  const safeName = escapeHtml(displayName);
  const safeUrl = escapeAttribute(url);
  await sendEmail({
    to: user.email,
    subject: `Reset your ${APP_NAME} password`,
    text: `Hi ${displayName},

You requested a password reset for your ${APP_NAME} account.

Click the link below to reset your password:
${url}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

— The ${APP_NAME} Team`,
    html: `<p>Hi ${safeName},</p>
<p>You requested a password reset for your <strong>${APP_NAME}</strong> account.</p>
<p><a href="${safeUrl}">Click here to reset your password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
<p>— The ${APP_NAME} Team</p>`,
  });
}
