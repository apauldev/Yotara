/** Localhost hostnames that may show dev-mode UI on screen. */
export function isLocalhostHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
