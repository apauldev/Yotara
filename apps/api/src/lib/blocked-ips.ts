import { sqlite } from '../db/client.js';

/** How long a honeypot-triggered IP stays banned (configurable via env). */
export function getIpBanWindowMs(): number {
  return Number(process.env['SIGNUP_IP_BAN_MS'] ?? 24 * 60 * 60 * 1000);
}

/**
 * Record an IP as banned for the ban window. Called when the signup honeypot
 * fires — no user is created and no email is sent, but the bot's IP is
 * remembered so it cannot retry signup/verification endpoints.
 */
export function banIp(ip: string): void {
  const blockedUntil = Date.now() + getIpBanWindowMs();
  sqlite
    .prepare(
      `INSERT INTO blocked_ips (ip, blocked_until, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET blocked_until = excluded.blocked_until`,
    )
    .run(ip, blockedUntil, Date.now());
}

/** Whether the given IP is currently banned (ban window has not elapsed). */
export function isIpBanned(ip: string): boolean {
  const row = sqlite.prepare(`SELECT blocked_until FROM blocked_ips WHERE ip = ?`).get(ip) as
    | { blocked_until: number }
    | undefined;
  if (!row) {
    return false;
  }
  if (row.blocked_until <= Date.now()) {
    // Expired ban — clean it up lazily.
    sqlite.prepare(`DELETE FROM blocked_ips WHERE ip = ?`).run(ip);
    return false;
  }
  return true;
}
