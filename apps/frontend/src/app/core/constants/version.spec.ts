import { APP_VERSION } from './version';

describe('APP_VERSION', () => {
  it('should have a valid version string', () => {
    expect(APP_VERSION.version).toMatch(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/);
  });

  it('should have a git hash', () => {
    expect(APP_VERSION.hash).toBeDefined();
    expect(APP_VERSION.hash.length).toBeGreaterThan(0);
  });

  it('should have a branch name', () => {
    expect(APP_VERSION.branch).toBeDefined();
    expect(APP_VERSION.branch.length).toBeGreaterThan(0);
  });

  it('should have a full build timestamp', () => {
    // ISO 8601 format check
    expect(APP_VERSION.buildDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should have a full version string containing v, version and hash', () => {
    expect(APP_VERSION.full).toContain('v' + APP_VERSION.version);
    expect(APP_VERSION.full).toContain('+' + APP_VERSION.hash);
  });
});
