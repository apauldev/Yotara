function parseOriginList(value: string | undefined) {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

export function getAppBaseUrl() {
  return process.env['APP_BASE_URL'] ?? 'http://localhost:3000';
}

export function getFrontendBaseUrl() {
  const configuredUrl = process.env['FRONTEND_BASE_URL']?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (process.env['NODE_ENV'] !== 'production') {
    return 'http://localhost:4200';
  }

  const appUrl = new URL(getAppBaseUrl());
  const frontendPath = appUrl.pathname.replace(/\/api\/?$/, '') || '/';
  return `${appUrl.origin}${frontendPath}`.replace(/\/+$/, '');
}

export function getFrontendVerificationUrl(apiVerificationUrl: string) {
  const token = new URL(apiVerificationUrl).searchParams.get('token');
  if (!token) {
    throw new Error('Better Auth verification URL is missing its token.');
  }

  return buildFrontendUrl('/verify-email', { token });
}

/**
 * Rewrite a Better Auth password-reset URL into a frontend URL the emailed
 * link can point at directly.
 *
 * Better Auth builds reset links as `${baseURL}/reset-password/<token>?callbackURL=...`
 * (token in the URL path, not the query) and only works when the browser
 * round-trips through the API's GET callback route — which falls back to the
 * bare `${baseURL}/error?error=INVALID_TOKEN` page whenever the callbackURL is
 * empty. The frontend consumes the token from the query string instead, so
 * rebuild the link as `${frontendBase}/reset-password?token=<token>`.
 */
export function getFrontendResetUrl(apiResetUrl: string) {
  const pathSegments = new URL(apiResetUrl).pathname.split('/').filter(Boolean);
  const resetIndex = pathSegments.lastIndexOf('reset-password');
  const token = resetIndex !== -1 ? pathSegments[resetIndex + 1] : undefined;
  if (!token) {
    throw new Error('Better Auth reset URL is missing its token.');
  }

  return buildFrontendUrl('/reset-password', { token });
}

function buildFrontendUrl(path: string, params: Record<string, string>) {
  const frontendUrl = new URL(`${getFrontendBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    frontendUrl.searchParams.set(key, value);
  }
  return frontendUrl.toString();
}

export function getTrustedOrigins() {
  const configuredOrigins = parseOriginList(process.env['TRUSTED_ORIGINS']);
  const isProd = process.env['NODE_ENV'] === 'production';
  const defaultOrigins = isProd ? [] : ['http://localhost:4200', 'http://127.0.0.1:4200'];

  return Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
}

export function getCorsOrigins() {
  const configuredOrigins = parseOriginList(process.env['CORS_ORIGIN']);

  return Array.from(new Set([...getTrustedOrigins(), ...configuredOrigins]));
}
