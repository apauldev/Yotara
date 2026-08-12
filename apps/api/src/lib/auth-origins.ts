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

  const frontendUrl = new URL(`${getFrontendBaseUrl()}/verify-email`);
  frontendUrl.searchParams.set('token', token);
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
