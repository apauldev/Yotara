import { Resend } from 'resend';
import { checkEmailRateLimit, type EmailType } from './email-rate-limit.js';

const RESEND_API_KEY = process.env['RESEND_API_KEY'] ?? '';
const EMAIL_FROM = process.env['EMAIL_FROM'] ?? 'noreply@yotara.app';
const APP_NAME = 'Yotara';

if (!RESEND_API_KEY) {
  console.log('[email] No RESEND_API_KEY set — emails will be logged to console');
}

function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  return new Resend(RESEND_API_KEY);
}

async function sendEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const resend = getResend();

  if (!resend) {
    // Dev mode fallback — log instead of sending
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
export function checkRateLimitOrThrow(email: string, type: EmailType): void {
  const result = checkEmailRateLimit(email, type);
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
  await sendEmail({
    to: user.email,
    subject: `Verify your ${APP_NAME} account`,
    text: `Hi ${user.name || 'there'},

Thanks for signing up for ${APP_NAME}!

Click the link below to verify your email address:
${url}

This link will expire in 1 hour.

If you didn't create an account, you can safely ignore this email.

— The ${APP_NAME} Team`,
    html: `<p>Hi ${user.name || 'there'},</p>
<p>Thanks for signing up for <strong>${APP_NAME}</strong>!</p>
<p><a href="${url}">Click here to verify your email address</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't create an account, you can safely ignore this email.</p>
<p>— The ${APP_NAME} Team</p>`,
  });
}

export async function sendPasswordResetEmail(user: { email: string; name: string }, url: string) {
  await sendEmail({
    to: user.email,
    subject: `Reset your ${APP_NAME} password`,
    text: `Hi ${user.name || 'there'},

You requested a password reset for your ${APP_NAME} account.

Click the link below to reset your password:
${url}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

— The ${APP_NAME} Team`,
    html: `<p>Hi ${user.name || 'there'},</p>
<p>You requested a password reset for your <strong>${APP_NAME}</strong> account.</p>
<p><a href="${url}">Click here to reset your password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you didn't request this, you can safely ignore this email.</p>
<p>— The ${APP_NAME} Team</p>`,
  });
}
