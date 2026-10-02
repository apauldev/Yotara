import { getUserTimezone, tryGetUserTimezone } from './timezone';

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

describe('tryGetUserTimezone', () => {
  it('returns the browser timezone when one is available', () => {
    const tz = tryGetUserTimezone();
    expect(typeof tz).toBe('string');
    expect(tz).not.toBe('');
  });

  it('returns null when the browser cannot resolve a timezone', () => {
    spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').and.returnValue(
      {} as Intl.ResolvedDateTimeFormatOptions,
    );

    expect(tryGetUserTimezone()).toBeNull();
  });

  it('returns null when Intl is unavailable', () => {
    spyOn(Intl, 'DateTimeFormat').and.throwError('Intl unavailable');

    expect(tryGetUserTimezone()).toBeNull();
  });
});
