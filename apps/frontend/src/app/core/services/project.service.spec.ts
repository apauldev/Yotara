import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Project } from '@yotara/shared';
import { AuthStateService } from './auth-state.service';
import { LogService } from './log.service';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  const initialized = signal(false);
  const isAuthenticated = signal(false);
  const currentUserId = signal<string | null>(null);
  const onboardingCompleted = signal(false);
  let logErrorSpy: jasmine.Spy;

  beforeEach(() => {
    logErrorSpy = jasmine.createSpy('logError');
    initialized.set(false);
    isAuthenticated.set(false);
    currentUserId.set(null);
    onboardingCompleted.set(false);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProjectService,
        { provide: LogService, useValue: { error: logErrorSpy } },
        {
          provide: AuthStateService,
          useValue: {
            initialized,
            isAuthenticated,
            currentUserId,
            onboardingCompleted,
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
    onboardingCompleted.set(true);

    tick();

    expect(service.projects()).toEqual([]);
    http.expectNone('http://localhost:3000/projects');
  }));

  it('waits for onboarding to complete before loading projects', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    tick();

    expect(service.projects()).toEqual([]);
    http.expectNone('http://localhost:3000/projects');

    onboardingCompleted.set(true);
    tick();

    http.expectOne('http://localhost:3000/projects').flush([]);
    tick();
  }));

  it('loads projects for authenticated users', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    onboardingCompleted.set(true);
    tick();

    const projects: Project[] = [
      {
        id: 'project-1',
        name: 'Launch Yotara MVP',
        description: 'Core release scope',
        color: 'sage',
        kind: 'project',
        sortOrder: 0,
        pinned: false,
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
    onboardingCompleted.set(true);
    tick();

    http.expectOne('http://localhost:3000/projects').flush([
      {
        id: 'project-1',
        name: 'User One Project',
        description: 'First account',
        color: 'sage',
        kind: 'project',
        sortOrder: 0,
        pinned: false,
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
    onboardingCompleted.set(true);
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

  it('keeps saving true until all overlapping mutations finish', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    onboardingCompleted.set(true);
    tick();
    http.expectOne('http://localhost:3000/projects').flush([]);
    tick();

    void service.createProject({ name: 'First' });
    void service.createProject({ name: 'Second' });
    expect(service.saving()).toBeTrue();

    const posts = http.match(
      (req) => req.url === 'http://localhost:3000/projects' && req.method === 'POST',
    );
    expect(posts.length).toBe(2);
    posts[0]?.flush({ id: 'p1', name: 'First', ownerId: 'user-1' });
    tick();
    expect(service.saving()).withContext('one mutation is still in flight').toBeTrue();

    posts[1]?.flush({ id: 'p2', name: 'Second', ownerId: 'user-1' });
    tick();
    expect(service.saving()).toBeFalse();

    const refreshes = http.match(
      (req) => req.url === 'http://localhost:3000/projects' && req.method === 'GET',
    );
    refreshes.filter((request) => !request.cancelled).forEach((request) => request.flush([]));
    tick();
  }));

  it('exposes a version signal that increments on refresh', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);

    expect(service.version()).toBe(0);

    service.refresh();
    expect(service.version()).toBe(1);

    service.refresh();
    expect(service.version()).toBe(2);
  }));

  it('completes, reopens, archives, unarchives and deletes projects', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    // completeProject
    let completedProject: Project | undefined;
    service.completeProject('project-1').then((res) => {
      completedProject = res;
    });
    tick();

    const completeReq = http.expectOne('http://localhost:3000/projects/project-1/complete');
    expect(completeReq.request.method).toBe('POST');
    completeReq.flush({
      id: 'project-1',
      name: 'Launch MVP',
      kind: 'project',
      completedAt: '2026-11-16T12:00:00.000Z',
      sortOrder: 0,
      pinned: false,
      ownerId: 'user-1',
      taskCount: 0,
      completedTaskCount: 0,
      openTaskCount: 0,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-11-16T12:00:00.000Z',
    });
    tick();
    expect(completedProject?.completedAt).toBe('2026-11-16T12:00:00.000Z');

    // reopenProject
    let reopenedProject: Project | undefined;
    service.reopenProject('project-1').then((res) => {
      reopenedProject = res;
    });
    tick();

    const reopenReq = http.expectOne('http://localhost:3000/projects/project-1/reopen');
    expect(reopenReq.request.method).toBe('POST');
    reopenReq.flush({
      id: 'project-1',
      name: 'Launch MVP',
      kind: 'project',
      completedAt: null,
      sortOrder: 0,
      pinned: false,
      ownerId: 'user-1',
      taskCount: 0,
      completedTaskCount: 0,
      openTaskCount: 0,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-11-16T12:05:00.000Z',
    });
    tick();
    expect(reopenedProject?.completedAt).toBeNull();

    // archiveProject
    let archivedProject: Project | undefined;
    service.archiveProject('project-1').then((res) => {
      archivedProject = res;
    });
    tick();

    const archiveReq = http.expectOne('http://localhost:3000/projects/project-1/archive');
    expect(archiveReq.request.method).toBe('POST');
    archiveReq.flush({
      id: 'project-1',
      name: 'Launch MVP',
      kind: 'project',
      archivedAt: '2026-11-16T12:10:00.000Z',
      sortOrder: 0,
      pinned: false,
      ownerId: 'user-1',
      taskCount: 0,
      completedTaskCount: 0,
      openTaskCount: 0,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-11-16T12:10:00.000Z',
    });
    tick();
    expect(archivedProject?.archivedAt).toBe('2026-11-16T12:10:00.000Z');

    // unarchiveProject
    let unarchivedProject: Project | undefined;
    service.unarchiveProject('project-1').then((res) => {
      unarchivedProject = res;
    });
    tick();

    const unarchiveReq = http.expectOne('http://localhost:3000/projects/project-1/unarchive');
    expect(unarchiveReq.request.method).toBe('POST');
    unarchiveReq.flush({
      id: 'project-1',
      name: 'Launch MVP',
      kind: 'project',
      archivedAt: null,
      sortOrder: 0,
      pinned: false,
      ownerId: 'user-1',
      taskCount: 0,
      completedTaskCount: 0,
      openTaskCount: 0,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-11-16T12:15:00.000Z',
    });
    tick();
    expect(unarchivedProject?.archivedAt).toBeNull();

    // deleteProject
    let deleted = false;
    service.deleteProject('project-1', true).then(() => {
      deleted = true;
    });
    tick();

    const deleteReq = http.expectOne('http://localhost:3000/projects/project-1?keepTasks=true');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ success: true });
    tick();
    expect(deleted).toBeTrue();

    // getProjectsByStatus
    let statusProjects: Project[] = [];
    service.getProjectsByStatus('archived').then((res) => {
      statusProjects = res;
    });
    tick();

    const statusReq = http.expectOne('http://localhost:3000/projects?status=archived');
    expect(statusReq.request.method).toBe('GET');
    statusReq.flush([]);
    tick();
    expect(statusProjects).toEqual([]);
  }));

  it('reorders projects and refreshes the list', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    let reordered: Project[] = [];
    void service.reorderProjects(['project-2', 'project-1']).then((res) => {
      reordered = res;
    });
    tick();

    const request = http.expectOne('http://localhost:3000/projects/reorder');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ ids: ['project-2', 'project-1'] });
    request.flush([]);
    tick();

    expect(reordered).toEqual([]);
    expect(service.version()).toBe(1);
  }));

  it('manages project sections through the section endpoints', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);
    const section = {
      id: 'section-1',
      projectId: 'project-1',
      name: 'Planning',
      sortOrder: 0,
      taskCount: 0,
      completedTaskCount: 0,
      openTaskCount: 0,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    };

    let listed: unknown[] = [];
    void service.getSections('project-1').then((res) => {
      listed = res;
    });
    tick();
    const listReq = http.expectOne('http://localhost:3000/projects/project-1/sections');
    expect(listReq.request.method).toBe('GET');
    listReq.flush([section]);
    tick();
    expect(listed).toEqual([section]);

    let created: unknown = null;
    void service.createSection('project-1', { name: 'Planning' }).then((res) => {
      created = res;
    });
    tick();
    const createReq = http.expectOne('http://localhost:3000/projects/project-1/sections');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({ name: 'Planning' });
    createReq.flush(section);
    tick();
    expect(created).toEqual(section);

    void service.reorderSections('project-1', ['section-1']);
    tick();
    const reorderReq = http.expectOne('http://localhost:3000/sections/reorder');
    expect(reorderReq.request.method).toBe('PATCH');
    expect(reorderReq.request.body).toEqual({ projectId: 'project-1', ids: ['section-1'] });
    reorderReq.flush([section]);
    tick();

    void service.deleteSection('section-1');
    tick();
    const deleteReq = http.expectOne('http://localhost:3000/sections/section-1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({ success: true });
    tick();
  }));

  it('refreshes the list after a successful project or section update', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);
    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    onboardingCompleted.set(true);
    tick();
    http.expectOne('http://localhost:3000/projects').flush([]);
    tick();

    const updatedProject: Project = {
      id: 'project-1',
      name: 'Updated',
      description: '',
      color: 'sage',
      kind: 'project',
      sortOrder: 0,
      pinned: false,
      ownerId: 'user-1',
      taskCount: 0,
      completedTaskCount: 0,
      openTaskCount: 0,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    };
    void service.updateProject('project-1', { name: 'Updated' });
    http.expectOne('http://localhost:3000/projects/project-1').flush(updatedProject);
    tick();
    http.expectOne('http://localhost:3000/projects').flush([updatedProject]);
    tick();

    void service.updateSection('section-1', { name: 'Renamed' });
    http
      .expectOne('http://localhost:3000/sections/section-1')
      .flush({ id: 'section-1', projectId: 'project-1', name: 'Renamed' });
    tick();
    http.expectOne('http://localhost:3000/projects').flush([updatedProject]);
    tick();

    expect(service.error()).toBeNull();
  }));

  it('returns null when a project or its tasks are not found', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);
    let project: Project | null | undefined;
    let tasks: unknown;

    void service.getProject('missing').then((result) => (project = result));
    void service.getProjectTasks('missing').then((result) => (tasks = result));

    http
      .expectOne('http://localhost:3000/projects/missing')
      .flush('nope', { status: 404, statusText: 'Not Found' });
    http
      .expectOne('http://localhost:3000/projects/missing/tasks')
      .flush('nope', { status: 404, statusText: 'Not Found' });
    tick();

    expect(project).toBeNull();
    expect(tasks).toBeNull();
  }));

  it('rethrows non-404 failures when loading a project or its tasks', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);
    let projectError: unknown;
    let tasksError: unknown;

    void service.getProject('project-1').catch((error) => (projectError = error));
    void service.getProjectTasks('project-1').catch((error) => (tasksError = error));

    http
      .expectOne('http://localhost:3000/projects/project-1')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    http
      .expectOne('http://localhost:3000/projects/project-1/tasks')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    tick();

    expect(projectError).toBeTruthy();
    expect(tasksError).toBeTruthy();
  }));

  it('swallows 401 but reports other failures when loading the project list', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);
    initialized.set(true);
    isAuthenticated.set(true);
    currentUserId.set('user-1');
    onboardingCompleted.set(true);
    tick();

    http
      .expectOne('http://localhost:3000/projects')
      .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    tick();
    expect(service.error()).toBeNull();

    service.refresh();
    tick();
    http
      .expectOne('http://localhost:3000/projects')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    tick();

    expect(service.error()).toBe('Could not load your projects right now.');
    expect(logErrorSpy).toHaveBeenCalledWith(
      'Failed to load projects',
      jasmine.anything(),
      'ProjectService',
    );
  }));

  it('reports failures, logs, and releases saving for every mutation', fakeAsync(() => {
    const service = TestBed.inject(ProjectService);
    const http = TestBed.inject(HttpTestingController);

    const mutations: Array<{
      label: string;
      run: () => Promise<unknown>;
      url: string;
      method: string;
      message: string;
    }> = [
      {
        label: 'create project',
        run: () => service.createProject({ name: 'X' }),
        url: 'http://localhost:3000/projects',
        method: 'POST',
        message: 'Could not create your project right now.',
      },
      {
        label: 'update project',
        run: () => service.updateProject('project-1', { name: 'X' }),
        url: 'http://localhost:3000/projects/project-1',
        method: 'PATCH',
        message: 'Could not update your project right now.',
      },
      {
        label: 'complete project',
        run: () => service.completeProject('project-1'),
        url: 'http://localhost:3000/projects/project-1/complete',
        method: 'POST',
        message: 'Could not complete your project right now.',
      },
      {
        label: 'reopen project',
        run: () => service.reopenProject('project-1'),
        url: 'http://localhost:3000/projects/project-1/reopen',
        method: 'POST',
        message: 'Could not reopen your project right now.',
      },
      {
        label: 'archive project',
        run: () => service.archiveProject('project-1'),
        url: 'http://localhost:3000/projects/project-1/archive',
        method: 'POST',
        message: 'Could not archive your project right now.',
      },
      {
        label: 'unarchive project',
        run: () => service.unarchiveProject('project-1'),
        url: 'http://localhost:3000/projects/project-1/unarchive',
        method: 'POST',
        message: 'Could not unarchive your project right now.',
      },
      {
        label: 'reorder projects',
        run: () => service.reorderProjects(['project-1']),
        url: 'http://localhost:3000/projects/reorder',
        method: 'PATCH',
        message: 'Could not reorder your projects right now.',
      },
      {
        label: 'delete project',
        run: () => service.deleteProject('project-1'),
        url: 'http://localhost:3000/projects/project-1?keepTasks=true',
        method: 'DELETE',
        message: 'Could not delete your project right now.',
      },
      {
        label: 'create section',
        run: () => service.createSection('project-1', { name: 'X' }),
        url: 'http://localhost:3000/projects/project-1/sections',
        method: 'POST',
        message: 'Could not create the section right now.',
      },
      {
        label: 'update section',
        run: () => service.updateSection('section-1', { name: 'X' }),
        url: 'http://localhost:3000/sections/section-1',
        method: 'PATCH',
        message: 'Could not update the section right now.',
      },
      {
        label: 'reorder sections',
        run: () => service.reorderSections('project-1', ['section-1']),
        url: 'http://localhost:3000/sections/reorder',
        method: 'PATCH',
        message: 'Could not reorder your sections right now.',
      },
      {
        label: 'delete section',
        run: () => service.deleteSection('section-1'),
        url: 'http://localhost:3000/sections/section-1',
        method: 'DELETE',
        message: 'Could not delete the section right now.',
      },
    ];

    for (const mutation of mutations) {
      let caught: unknown;
      void mutation.run().catch((error) => (caught = error));
      tick();

      const request = http.expectOne(mutation.url);
      expect(request.request.method).withContext(mutation.label).toBe(mutation.method);
      request.flush('boom', { status: 500, statusText: 'Server Error' });
      tick();

      expect(caught).withContext(mutation.label).toBeTruthy();
      expect(service.error()).withContext(mutation.label).toBe(mutation.message);
      expect(service.saving()).withContext(mutation.label).toBeFalse();
    }

    expect(logErrorSpy).toHaveBeenCalledTimes(mutations.length);
  }));
});
