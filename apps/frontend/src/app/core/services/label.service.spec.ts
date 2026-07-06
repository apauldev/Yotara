import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Label } from '@yotara/shared';
import { AuthStateService } from './auth-state.service';
import { LabelService } from './label.service';

describe('LabelService', () => {
  const initialized = signal(false);
  const isAuthenticated = signal(false);
  const currentUserId = signal<string | null>(null);

  beforeEach(() => {
    initialized.set(false);
    isAuthenticated.set(false);
    currentUserId.set(null);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        LabelService,
        {
          provide: AuthStateService,
          useValue: {
            initialized,
            isAuthenticated,
            currentUserId,
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('exposes a version signal that increments on refresh', fakeAsync(() => {
    const service = TestBed.inject(LabelService);

    expect(service.version()).toBe(0);

    service.refresh();
    expect(service.version()).toBe(1);

    service.refresh();
    expect(service.version()).toBe(2);
  }));

  it('calls refresh after creating a label', fakeAsync(() => {
    const service = TestBed.inject(LabelService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne('http://localhost:3000/labels').flush([]);
    tick();

    expect(service.version()).toBe(0);

    let created: Label | undefined;
    void service.createLabel({ name: 'bug', color: 'tomato' }).then((label) => {
      created = label;
    });

    const createReq = http.expectOne('http://localhost:3000/labels');
    expect(createReq.request.method).toBe('POST');
    createReq.flush({
      id: 'label-1',
      name: 'bug',
      color: 'tomato',
      ownerId: 'user-1',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    });
    tick();

    expect(created?.id).toBe('label-1');
    expect(service.version()).toBe(1);

    http.expectOne('http://localhost:3000/labels').flush([]);
    tick();
  }));

  it('calls refresh after updating a label', fakeAsync(() => {
    const service = TestBed.inject(LabelService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne('http://localhost:3000/labels').flush([]);
    tick();

    const before = service.version();

    let updated: Label | undefined;
    void service.updateLabel('label-1', { name: 'bug', color: 'tomato' }).then((label) => {
      updated = label;
    });

    const updateReq = http.expectOne('http://localhost:3000/labels/label-1');
    expect(updateReq.request.method).toBe('PATCH');
    updateReq.flush({
      id: 'label-1',
      name: 'bug',
      color: 'tomato',
      ownerId: 'user-1',
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    });
    tick();

    expect(updated?.id).toBe('label-1');
    expect(service.version()).toBe(before + 1);

    http.expectOne('http://localhost:3000/labels').flush([]);
    tick();
  }));

  it('calls refresh after deleting a label', fakeAsync(() => {
    const service = TestBed.inject(LabelService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne('http://localhost:3000/labels').flush([]);
    tick();

    const before = service.version();

    void service.deleteLabel('label-1');

    const deleteReq = http.expectOne('http://localhost:3000/labels/label-1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ ok: true });
    tick();

    expect(service.version()).toBe(before + 1);

    http.expectOne('http://localhost:3000/labels').flush([]);
    tick();
  }));

  it('tracks version across multiple refreshes', fakeAsync(() => {
    const service = TestBed.inject(LabelService);

    service.refresh();
    service.refresh();
    service.refresh();
    expect(service.version()).toBe(3);
  }));
});
