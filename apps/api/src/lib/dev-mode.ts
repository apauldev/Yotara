import { readFileSync } from 'node:fs';

/**
 * Dev mode — the single switch for frictionless local/test development.
 *
 * When enabled (via the `dev-mode.json` file and/or the `DEV_MODE` env var),
 * email verification is forced off, emails go to the console instead of
 * Resend, and the anti-abuse guards (email rate limits, login lockout, IP
 * ban) are bypassed — so signup/login never impede local work.
 *
 * Precedence: the `DEV_MODE` env var (true/false) overrides the file's
 * `enabled` field; the per-feature options always come from the file. The
 * file is resolved relative to this module so it works in dev (`apps/api/`)
 * and in the docker image (`/app/apps/api/`).
 *
 * Production safety: enabling dev mode under NODE_ENV=production requires the
 * explicit `ALLOW_DEV_MODE_IN_PRODUCTION=true` opt-in; otherwise the server
 * refuses to start (dev mode disables auth protections).
 */

export interface DevModeConfig {
  /** Master switch: dev mode on/off. */
  enabled: boolean;
  /** Never send real email — log messages (with links) to the console. */
  emailToConsole: boolean;
  /** Skip the email send rate limits (per-type, hourly, per-IP caps). */
  bypassEmailRateLimits: boolean;
  /** Never lock an account after repeated failed sign-in attempts. */
  bypassLoginLockout: boolean;
  /** Do not enforce honeypot-triggered IP bans. */
  bypassIpBan: boolean;
}

export const DEFAULT_DEV_MODE_CONFIG: DevModeConfig = {
  enabled: false,
  emailToConsole: true,
  bypassEmailRateLimits: true,
  bypassLoginLockout: true,
  bypassIpBan: true,
};

/** Parse and validate the dev-mode config file. Throws on malformed input. */
export function parseDevModeConfig(raw: string): DevModeConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid dev-mode.json: not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid dev-mode.json: expected a JSON object.');
  }

  const input = parsed as Record<string, unknown>;
  const result: DevModeConfig = { ...DEFAULT_DEV_MODE_CONFIG };
  for (const key of Object.keys(DEFAULT_DEV_MODE_CONFIG) as Array<keyof DevModeConfig>) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'boolean') {
      throw new Error(`Invalid dev-mode.json: "${key}" must be a boolean.`);
    }
    result[key] = value;
  }
  return result;
}

let cachedFileConfig: DevModeConfig | null = null;

function fileConfig(): DevModeConfig {
  if (cachedFileConfig) {
    return cachedFileConfig;
  }
  try {
    const file = new URL('../../dev-mode.json', import.meta.url);
    cachedFileConfig = parseDevModeConfig(readFileSync(file, 'utf8'));
  } catch {
    // Missing or unreadable file → safe defaults (dev mode off).
    cachedFileConfig = { ...DEFAULT_DEV_MODE_CONFIG };
  }
  return cachedFileConfig;
}

/** Whether dev mode is on: `DEV_MODE` env override, else the file's `enabled`. */
export function devMode(): boolean {
  const env = process.env['DEV_MODE'];
  const enabled = env === 'true' ? true : env === 'false' ? false : fileConfig().enabled;
  if (!enabled) {
    return false;
  }

  // Dev mode disables production auth protections (verification, email
  // sending, anti-abuse). In production it therefore requires an explicit,
  // deliberate second opt-in so a misconfigured public instance fails loudly
  // at boot instead of silently running unprotected.
  if (
    process.env['NODE_ENV'] === 'production' &&
    process.env['ALLOW_DEV_MODE_IN_PRODUCTION'] !== 'true'
  ) {
    throw new Error(
      'Refusing to start: dev mode is enabled but NODE_ENV=production. ' +
        'Dev mode disables email verification, real email sending, and anti-abuse ' +
        'guards. Set ALLOW_DEV_MODE_IN_PRODUCTION=true to confirm this is a test ' +
        'instance, or disable dev mode.',
    );
  }

  return true;
}

/** Emails must be logged to console (never sent via Resend) in dev mode. */
export function emailToConsole(): boolean {
  return devMode() && fileConfig().emailToConsole;
}

/** Email send rate limits are bypassed in dev mode. */
export function bypassEmailRateLimits(): boolean {
  return devMode() && fileConfig().bypassEmailRateLimits;
}

/** Login lockout is bypassed in dev mode. */
export function bypassLoginLockout(): boolean {
  return devMode() && fileConfig().bypassLoginLockout;
}

/** Honeypot IP bans are not enforced in dev mode. */
export function bypassIpBan(): boolean {
  return devMode() && fileConfig().bypassIpBan;
}
