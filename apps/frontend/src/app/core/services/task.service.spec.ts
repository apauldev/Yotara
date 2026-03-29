import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TaskService } from './task.service';
import { AuthStateService } from './auth-state.service';

describe('TaskService', () => {
  const initialized = signal(false);
  const isAuthenticated = signal(false);

  beforeEach(() => {
    initialized.set(false);
    isAuthenticated.set(false);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        TaskService,
        {
          provide: AuthStateService,
          useValue: {
            initialized,
            isAuthenticated,
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('does not request tasks before auth initialization completes', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    tick();

    expect(service.tasks()).toEqual([]);
    http.expectNone('http://localhost:3000/tasks');
  }));

  it('does not request tasks when the user is not authenticated', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    tick();

    expect(service.tasks()).toEqual([]);
    http.expectNone('http://localhost:3000/tasks');
  }));

  it('returns an empty list when the tasks endpoint responds with 401', fakeAsync(() => {
    const service = TestBed.inject(TaskService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    tick();

    const request = http.expectOne('http://localhost:3000/tasks');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    tick();

    expect(service.tasks()).toEqual([]);
    expect(service.pendingTasks()).toEqual([]);
    expect(service.completedTasks()).toEqual([]);
  }));
});
