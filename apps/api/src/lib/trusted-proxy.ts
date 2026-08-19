export function getTrustedProxy(): false | string[] {
  const configured = process.env['TRUST_PROXY']
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return configured && configured.length > 0 ? configured : false;
}
