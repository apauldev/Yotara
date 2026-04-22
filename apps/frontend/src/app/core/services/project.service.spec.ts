import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Project } from '@yotara/shared';
import { AuthStateService } from './auth-state.service';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
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
        ProjectService,
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

  it('does not request projects before auth initialization completes', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    tick();

    expect(service.projects()).toEqual([]);
    http.expectNone('http://localhost:3000/projects');
  }));

  it('loads projects for authenticated users', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    const projects: Project[] = [
      {
        id: 'project-1',
        name: 'Launch Yotara MVP',
        description: 'Core release scope',
        color: 'sage',
        ownerId: 'user-1',
        taskCount: 18,
        completedTaskCount: 11,
        openTaskCount: 7,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z',
      },
    ];

    const request = http.expectOne('http://localhost:3000/projects');
    expect(request.request.withCredentials).toBeTrue();
    request.flush(projects);
    tick();

    expect(service.projects()).toEqual(projects);
    expect(service.hasProjects()).toBeTrue();
  }));

  it('drops the previous user projects and reloads for the next login', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne('http://localhost:3000/projects').flush([
      {
        id: 'project-1',
        name: 'User One Project',
        description: 'First account',
        color: 'sage',
        ownerId: 'user-1',
        taskCount: 1,
        completedTaskCount: 0,
        openTaskCount: 1,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z',
      },
    ]);
    tick();

    expect(service.projects().map((project) => project.id)).toEqual(['project-1']);

    currentUserId.set(null);
    isAuthenticated.set(false);
    tick();

    expect(service.projects()).toEqual([]);
    http.expectNone('http://localhost:3000/projects');

    isAuthenticated.set(true);
    currentUserId.set('user-2');
    tick();

    http.expectOne('http://localhost:3000/projects').flush([
      {
        id: 'project-2',
        name: 'User Two Project',
        description: 'Second account',
        color: 'olive',
        ownerId: 'user-2',
        taskCount: 2,
        completedTaskCount: 1,
        openTaskCount: 1,
        createdAt: '2026-04-04T10:00:00.000Z',
        updatedAt: '2026-04-05T10:00:00.000Z',
      },
    ]);
    tick();

    expect(service.projects().map((project) => project.id)).toEqual(['project-2']);
  }));

  it('creates a project and refreshes the list', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    http.expectOne('http://localhost:3000/projects').flush([]);
    tick();

    let createdProject: Project | undefined;
    void service
      .createProject({
        name: 'Garden Renovation',
        description: 'Outdoor planning',
        color: 'olive',
      })
      .then((project) => {
        createdProject = project;
      });

    const createRequest = http.expectOne('http://localhost:3000/projects');
    expect(createRequest.request.method).toBe('POST');
    createRequest.flush({
      id: 'project-2',
      name: 'Garden Renovation',
      description: 'Outdoor planning',
      color: 'olive',
      ownerId: 'user-1',
      taskCount: 0,
      completedTaskCount: 0,
      openTaskCount: 0,
      createdAt: '2026-04-04T10:00:00.000Z',
      updatedAt: '2026-04-04T10:00:00.000Z',
    });
    tick();

    http.expectOne('http://localhost:3000/projects').flush([
      {
        id: 'project-2',
        name: 'Garden Renovation',
        description: 'Outdoor planning',
        color: 'olive',
        ownerId: 'user-1',
        taskCount: 0,
        completedTaskCount: 0,
        openTaskCount: 0,
        createdAt: '2026-04-04T10:00:00.000Z',
        updatedAt: '2026-04-04T10:00:00.000Z',
      },
    ]);
    tick();

    expect(createdProject?.id).toBe('project-2');
    expect(service.projects().map((project) => project.id)).toEqual(['project-2']);
  }));
});
