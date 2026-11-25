/**
 * The canonical Content-Security-Policy for Yotara.
 *
 * The API sets this header at runtime, and nginx receives the same value
 * through the CONTENT_SECURITY_POLICY environment variable in each compose
 * file (and in the website's install snippet). Keep this as the only literal
 * copy: deployment files are checked against it by
 * `apps/api/src/lib/content-security-policy.test.ts`.
 *
 * HSTS is intentionally omitted — it belongs only behind TLS termination.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; " +
  "connect-src 'self' https://cloudflareinsights.com; " +
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
