/**
 * BETTER_AUTH_SECRET validation shared by auth configuration and server bootstrap.
 */

export const DEFAULT_AUTH_SECRET = 'local-dev-secret-change-me';
export const MIN_AUTH_SECRET_BYTES = 32;

const REPEATED_PATTERN = /^(.{1,16})\1+$/;

function decodeHex(secret: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(secret) || secret.length % 2 !== 0) {
    return null;
  }

  const bytes = new Uint8Array(secret.length / 2);
  for (let index = 0; index < secret.length; index += 2) {
    bytes[index / 2] = Number.parseInt(secret.slice(index, index + 2), 16);
  }
  return bytes;
}

function decodeBase64(secret: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(secret) || secret.length % 4 !== 0) {
    return null;
  }

  const padding = secret.endsWith('==') ? 2 : secret.endsWith('=') ? 1 : 0;
  const contentLength = secret.length - padding;
  const remainder = contentLength % 4;
  if ((padding === 1 && remainder !== 3) || (padding === 2 && remainder !== 2)) {
    return null;
  }

  const decoded = Buffer.from(secret, 'base64');
  if (decoded.toString('base64') !== secret) {
    return null;
  }
  return decoded;
}

function hasObviousByteStructure(bytes: Uint8Array): boolean {
  const first = bytes[0];
  if (bytes.every((byte) => byte === first)) {
    return true;
  }

  return bytes.every((byte, index) => index === 0 || byte === (bytes[index - 1] + 1) % 256);
}

function decodeSecretCandidates(secret: string): Uint8Array[] {
  return [decodeHex(secret), decodeBase64(secret)].filter(
    (bytes): bytes is Uint8Array => bytes !== null,
  );
}

/** Returns an error message when the secret is unacceptable, else null. */
export function validateAuthSecret(secret: string | undefined): string | null {
  if (!secret) {
    return 'BETTER_AUTH_SECRET is missing';
  }
  if (secret === DEFAULT_AUTH_SECRET) {
    return 'BETTER_AUTH_SECRET is still set to the default placeholder';
  }

  const candidates = decodeSecretCandidates(secret).filter(
    (candidate) => candidate.length >= MIN_AUTH_SECRET_BYTES,
  );
  if (candidates.length === 0) {
    return 'BETTER_AUTH_SECRET must be a canonical hex or Base64 value representing at least 32 random bytes — generate it with `openssl rand -base64 32` or `openssl rand -hex 32`';
  }
  if (REPEATED_PATTERN.test(secret) || candidates.some(hasObviousByteStructure)) {
    return 'BETTER_AUTH_SECRET looks like a repeated or sequential pattern — generate it with `openssl rand -base64 32`';
  }
  return null;
}

/** Throw unless the environment is exempt or the secret is strong. */
export function assertAuthSecretConfigured(
  nodeEnv: string = process.env['NODE_ENV'] ?? 'development',
): void {
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return;
  }
  const problem = validateAuthSecret(process.env['BETTER_AUTH_SECRET']);
  if (problem) {
    throw new Error(`Refusing to start: ${problem}.`);
  }
}
