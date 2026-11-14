import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CalendarEventDto, CalendarSource, CalendarSyncStatus } from '@yotara/shared';
import { environment } from '../../../environments/environment';
import { getUserTimezone } from '../../shared/utils/timezone';
import { AuthStateService } from './auth-state.service';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  const currentUserId = signal<string | null>(null);
  let service: CalendarService;
  let http: HttpTestingController;

  const source = (id: string, enabled = true): CalendarSource => ({
    id,
    name: id,
    color: 'teal',
    enabled,
    host: 'calendar.example.com',
    eventCount: 1,
    lastFetchedAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: '2026-11-13T00:00:00.000Z',
    updatedAt: '2026-11-13T00:00:00.000Z',
  });

  const event = (sourceId: string, id = `event-${sourceId}`): CalendarEventDto => ({
    id,
    sourceId,
    sourceName: sourceId,
    sourceColor: 'teal',
    summary: 'Planning',
    description: null,
    location: null,
    allDay: false,
    dayKeys: ['2026-11-13'],
    startTime: '09:00',
    endTime: '10:00',
    floating: false,
    timezone: 'UTC',
    status: 'CONFIRMED',
  });

  beforeEach(() => {
    currentUserId.set(null);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CalendarService, { provide: AuthStateService, useValue: { currentUserId } }],
    });
    service = TestBed.inject(CalendarService);
    http = TestBed.inject(HttpTestingController);
    TestBed.flushEffects();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('loads and stores calendar sources with credentials', async () => {
    const expected = [source('work')];
    const promise = service.loadSources();
    const req = http.expectOne(`${environment.apiBaseUrl}/calendar/sources`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(expected);

    await expectAsync(promise).toBeResolvedTo(expected);
    expect(service.sources()).toEqual(expected);
  });

  it('loads events for the requested range and reader timezone', async () => {
    const expected = [event('work')];
    const promise = service.loadEvents('2026-11-13', '2026-11-13');
    expect(service.loadingEvents()).toBeTrue();

    const req = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/calendar/events` &&
        request.params.get('from') === '2026-11-13' &&
        request.params.get('to') === '2026-11-13' &&
        request.params.get('tz') === getUserTimezone(),
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(expected);

    await expectAsync(promise).toBeResolvedTo(expected);
    expect(service.events()).toEqual(expected);
    expect(service.loadingEvents()).toBeFalse();
  });

  it('clears the loading state when an event request fails', async () => {
    const promise = service.loadEvents('2026-11-13', '2026-11-13');
    http
      .expectOne((request) => request.url.endsWith('/calendar/events'))
      .flush({ message: 'failed' }, { status: 500, statusText: 'Server Error' });

    await expectAsync(promise).toBeRejected();
    expect(service.loadingEvents()).toBeFalse();
  });

  it('keeps the newest event range when responses arrive out of order', async () => {
    const olderPromise = service.loadEvents('2026-11-01', '2026-11-07');
    const newerPromise = service.loadEvents('2026-11-08', '2026-11-14');
    const requests = http.match((request) => request.url.endsWith('/calendar/events'));
    expect(requests.length).toBe(2);

    requests[1]!.flush([event('work', 'newer')]);
    await newerPromise;
    expect(service.events().map((item) => item.id)).toEqual(['newer']);
    expect(service.loadingEvents()).toBeFalse();

    requests[0]!.flush([event('work', 'older')]);
    await olderPromise;
    expect(service.events().map((item) => item.id)).toEqual(['newer']);
  });

  it('clears private state and loading when the signed-in owner changes', async () => {
    currentUserId.set('user-a');
    TestBed.flushEffects();
    service.sources.set([source('work')]);
    service.events.set([event('work')]);

    const pending = service.loadEvents('2026-11-13', '2026-11-13');
    const req = http.expectOne((request) => request.url.endsWith('/calendar/events'));
    expect(service.loadingEvents()).toBeTrue();

    currentUserId.set('user-b');
    TestBed.flushEffects();
    expect(service.sources()).toEqual([]);
    expect(service.events()).toEqual([]);
    expect(service.loadingEvents()).toBeFalse();

    req.flush([event('work', 'user-a-event')]);
    await pending;
    expect(service.events()).toEqual([]);
  });

  it('creates a source and appends it to the source signal', async () => {
    service.sources.set([source('existing')]);
    const created = source('new');
    const promise = service.createSource({ url: 'https://calendar.example.com/feed.ics' });
    const req = http.expectOne(`${environment.apiBaseUrl}/calendar/sources`);
    expect(req.request.method).toBe('POST');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(created);

    await expectAsync(promise).toBeResolvedTo(created);
    expect(service.sources()).toEqual([source('existing'), created]);
  });

  it('updates source settings and removes that source events when disabled', async () => {
    service.sources.set([source('work'), source('personal')]);
    service.events.set([event('work'), event('personal')]);
    const updated = source('work', false);
    const promise = service.updateSource('work', { enabled: false });
    const req = http.expectOne(`${environment.apiBaseUrl}/calendar/sources/work`);
    expect(req.request.method).toBe('PATCH');
    req.flush(updated);

    await expectAsync(promise).toBeResolvedTo(updated);
    expect(service.sources()).toEqual([updated, source('personal')]);
    expect(service.events().map((item) => item.sourceId)).toEqual(['personal']);
  });

  it('refreshes a source and reloads the source list', async () => {
    const status: CalendarSyncStatus = {
      sourceId: 'work',
      eventCount: 2,
      lastFetchedAt: '2026-11-13T12:00:00.000Z',
      lastSuccessAt: '2026-11-13T12:00:00.000Z',
      lastError: null,
      truncated: false,
    };
    const promise = service.refreshSource('work');
    const refresh = http.expectOne(`${environment.apiBaseUrl}/calendar/sources/work/refresh`);
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.body).toEqual({});
    refresh.flush(status);

    await Promise.resolve();
    const list = http.expectOne(`${environment.apiBaseUrl}/calendar/sources`);
    expect(list.request.method).toBe('GET');
    list.flush([source('work')]);

    await expectAsync(promise).toBeResolvedTo(status);
    expect(service.sources()).toEqual([source('work')]);
  });

  it('deletes a source and removes its events', async () => {
    service.sources.set([source('work'), source('personal')]);
    service.events.set([event('work'), event('personal')]);
    const promise = service.deleteSource('work');
    const req = http.expectOne(`${environment.apiBaseUrl}/calendar/sources/work`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });

    await promise;
    expect(service.sources()).toEqual([source('personal')]);
    expect(service.events().map((item) => item.sourceId)).toEqual(['personal']);
  });
});
