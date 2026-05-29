import { TestBed } from '@angular/core/testing';
import { LogService, LogEntry } from './log.service';

describe('LogService', () => {
  let service: LogService;
  const STORAGE_KEY = 'yotara_debug_logs';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LogService);

    // Spy on console to prevent test failures from expected error/warn logs
    spyOn(console, 'error');
    spyOn(console, 'warn');
    spyOn(console, 'info');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with an empty buffer if localStorage is empty', () => {
    expect(service.getLogs()).toEqual([]);
  });

  it('should add logs to the buffer and localStorage', () => {
    service.info('Test Info', { foo: 'bar' }, 'TestCtx');

    const logs = service.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('Test Info');
    expect(logs[0].level).toBe('info');
    expect(logs[0].context).toBe('TestCtx');
    expect(logs[0].data).toEqual({ foo: 'bar' });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    expect(stored.length).toBe(1);
    expect(stored[0].message).toBe('Test Info');
  });

  it('should maintain a maximum of 100 logs', () => {
    for (let i = 0; i < 110; i++) {
      service.info(`Log ${i}`);
    }

    const logs = service.getLogs();
    expect(logs.length).toBe(100);
    expect(logs[0].message).toBe('Log 10'); // First 10 should be shifted out
    expect(logs[99].message).toBe('Log 109');
  });

  it('should clear logs', () => {
    service.error('Error');
    expect(service.getLogs().length).toBe(1);

    service.clearLogs();
    expect(service.getLogs().length).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]');
  });

  it('should load logs from localStorage on initialization', () => {
    const mockLogs: LogEntry[] = [
      { timestamp: new Date().toISOString(), level: 'warn', message: 'Old Log' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockLogs));

    // Create new instance to trigger constructor load
    const newService = new LogService();
    expect(newService.getLogs().length).toBe(1);
    expect(newService.getLogs()[0].message).toBe('Old Log');
  });

  it('should sanitize circular data', () => {
    const circular: any = { name: 'circular' };
    circular.self = circular;

    service.error('Circular Data', circular);
    const logs = service.getLogs();
    expect(logs[0].data).toBe('[Unserializable Data]');
  });
});
