import { TestBed } from '@angular/core/testing';
import { LogService } from './log.service';

describe('LogService', () => {
  let service: LogService;
  let errorSpy: jasmine.Spy;
  let warnSpy: jasmine.Spy;
  let infoSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LogService);

    // Spy on console to prevent test failures from expected error/warn logs
    errorSpy = spyOn(console, 'error');
    warnSpy = spyOn(console, 'warn');
    infoSpy = spyOn(console, 'info');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('logs errors with their context and a sanitized error object', () => {
    const error = new Error('Test Error Message');
    error.name = 'CustomError';

    service.error('Failed to save', error, 'TaskService');

    expect(errorSpy).toHaveBeenCalled();
    const [message, data] = errorSpy.calls.mostRecent().args;
    expect(message).toBe('[TaskService] Failed to save');
    expect(data.name).toBe('CustomError');
    expect(data.message).toBe('Test Error Message');
    expect(data.stack).toBeDefined();
  });

  it('uses the matching console method for each level', () => {
    service.info('Heads up', { foo: 'bar' }, 'Ctx');
    service.warn('Careful', { foo: 'bar' }, 'Ctx');

    const [infoMessage, infoData] = infoSpy.calls.mostRecent().args;
    expect(infoMessage).toBe('[Ctx] Heads up');
    expect(infoData).toEqual({ foo: 'bar' });

    const [warnMessage, warnData] = warnSpy.calls.mostRecent().args;
    expect(warnMessage).toBe('[Ctx] Careful');
    expect(warnData).toEqual({ foo: 'bar' });
  });

  it('redacts sensitive keys before logging', () => {
    const sensitiveData = {
      email: 'user@example.com',
      password: 'supersecret',
      token: 'fake-test-token-value',
      nested: {
        authorization: 'Bearer tok123',
        normalField: 'hello',
      },
    };

    service.error('Sensitive Data Test', sensitiveData);
    const data = errorSpy.calls.mostRecent().args[1];

    expect(data.password).toBe('[REDACTED]');
    expect(data.token).toBe('[REDACTED]');
    expect(data.email).toBe('user@example.com');
    expect(data.nested.authorization).toBe('[REDACTED]');
    expect(data.nested.normalField).toBe('hello');
  });

  it('handles circular data without throwing', () => {
    const circular: { name: string; self?: unknown } = { name: 'circular' };
    circular.self = circular;

    service.error('Circular Data', circular);

    expect(errorSpy.calls.mostRecent().args[1]).toBe('[Unserializable Data]');
  });

  it('does not persist logs to localStorage', () => {
    service.info('Nothing to persist');

    expect(localStorage.getItem('yotara_debug_logs')).toBeNull();
  });
});
