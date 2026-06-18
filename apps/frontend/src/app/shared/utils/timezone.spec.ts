import { getUserTimezone } from './timezone';

describe('getUserTimezone', () => {
  it('returns a non-empty string', () => {
    const tz = getUserTimezone();
    expect(tz).toBeTruthy();
    expect(typeof tz).toBe('string');
  });

  it('returns a valid IANA timezone or UTC fallback', () => {
    const tz = getUserTimezone();
    const isIANA = /^[A-Z][a-z]+\/[A-Z][a-z_]+$/.test(tz);
    expect(isIANA || tz === 'UTC').toBe(true);
  });
});
