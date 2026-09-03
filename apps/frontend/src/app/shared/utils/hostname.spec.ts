import { isLocalhostHostname } from './hostname';

describe('isLocalhostHostname', () => {
  it('accepts loopback hostnames', () => {
    expect(isLocalhostHostname('localhost')).toBeTrue();
    expect(isLocalhostHostname('127.0.0.1')).toBeTrue();
    expect(isLocalhostHostname('::1')).toBeTrue();
  });

  it('rejects remote hostnames', () => {
    expect(isLocalhostHostname('test.yotara.website')).toBeFalse();
    expect(isLocalhostHostname('yotara.website')).toBeFalse();
  });
});
