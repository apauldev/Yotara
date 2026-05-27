import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { BehaviorSubject } from 'rxjs';
import { SearchPageComponent } from './search-page.component';
import { SearchService } from '../../../../core/services/search.service';
import { TaskService } from '../../../../core/services/task.service';
import { ProjectService } from '../../../../core/services/project.service';
import { LabelService } from '../../../../core/services/label.service';

describe('SearchPageComponent', () => {
  const queryParams$ = new BehaviorSubject(convertToParamMap({}));

  const mockTasks = signal([
    {
      id: 'task-1',
      title: 'Polish search results',
      description: 'Tune the global search page copy and ranking.',
      status: 'today' as const,
      priority: 'high' as const,
      completed: false,
      dueDate: '2026-04-24',
      simpleMode: false,
      bucket: 'deep-work' as const,
      projectId: 'project-1',
      parentId: null,
      order: 0,
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-23T10:00:00.000Z',
    },
    {
      id: 'task-2',
      title: 'Buy groceries',
      description: 'Milk, eggs, bread',
      status: 'inbox' as const,
      priority: 'medium' as const,
      completed: false,
      dueDate: null,
      simpleMode: true,
      bucket: 'home' as const,
      projectId: null,
      parentId: null,
      order: 1,
      createdAt: '2026-04-25T10:00:00.000Z',
      updatedAt: '2026-04-25T10:00:00.000Z',
    },
    {
      id: 'task-3',
      title: 'Archive old notebook',
      description: 'Move the completed notes into archive.',
      status: 'archived' as const,
      priority: 'low' as const,
      completed: true,
      dueDate: '2026-03-24',
      simpleMode: false,
      bucket: 'home' as const,
      projectId: null,
      parentId: null,
      order: 2,
      createdAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-22T10:00:00.000Z',
    },
  ]);

  const mockProjects = signal([
    {
      id: 'project-1',
      name: 'Launch Yotara MVP',
      description: 'Core release scope',
      color: 'sage' as const,
      ownerId: 'user-1',
      taskCount: 1,
      completedTaskCount: 0,
      openTaskCount: 1,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-03T10:00:00.000Z',
    },
  ]);

  const mockLabels = signal([
    { id: 'label-1', name: 'bug', color: '#ef4444', taskCount: 2 },
    { id: 'label-2', name: 'enhancement', color: '#3b82f6', taskCount: 1 },
  ]);

  let router: Router;
  let navigateSpy: jasmine.Spy;

  beforeEach(async () => {
    queryParams$.next(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [SearchPageComponent],
      providers: [
        provideRouter([]),
        provideMarkdown(),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams$.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: TaskService,
          useValue: {
            tasks: mockTasks,
            error: signal<string | null>(null),
            creating: signal(false),
            createTask: jasmine.createSpy('createTask').and.resolveTo(undefined),
            updateTask: jasmine.createSpy('updateTask').and.resolveTo(undefined),
          },
        },
        {
          provide: ProjectService,
          useValue: {
            projects: mockProjects,
            refreshProjects: jasmine.createSpy('refreshProjects'),
          },
        },
        {
          provide: LabelService,
          useValue: {
            labels: mockLabels,
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('shows an empty state when no search query is provided', () => {
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Start with a title, project, or keyword');
    expect(text).toContain('Search tasks and projects from the sanctuary.');
  });

  it('shows an empty state when the query matches nothing', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'zzzznonexistent' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No matches found');
  }));

  it('renders task results for a matching query', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'search' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Polish search results');
    expect(text).toContain('1 matches');
  }));

  it('displays the search query in the page subtitle', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'groceries' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Results for');
    expect(text).toContain('groceries');
  }));

  it('navigates to /search with the query on form submit', fakeAsync(() => {
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();

    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'test query';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    tick();

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], {
      queryParams: { q: 'test query', tab: null },
      replaceUrl: true,
    });
  }));

  it('navigates with the tab param when a tab chip is clicked', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'search' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const tabButtons = [...fixture.nativeElement.querySelectorAll('.tab-chip')];
    const tasksTab = tabButtons.find((btn: Element) =>
      btn.textContent?.trim().startsWith('Tasks'),
    ) as HTMLElement;
    expect(tasksTab).toBeTruthy();
    tasksTab.click();
    fixture.detectChanges();
    tick();

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], {
      queryParams: { q: 'search', tab: 'tasks' },
      replaceUrl: true,
    });
  }));

  it('renders project results in the All tab when the query matches a project', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'launch' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Launch Yotara MVP');
    // Projects section header should appear
    expect(text).toContain('Projects');
  }));

  it('switches to the labels tab and shows label results', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'bug', tab: 'labels' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('bug');
  }));

  it('toggles sort option via pill buttons', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'search', tab: 'tasks' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    // Default sort is 'date' — the "Date" pill should be active
    const pills = [...fixture.nativeElement.querySelectorAll('.control-pill')];
    const datePill = pills.find(
      (btn: Element) => btn.textContent?.trim() === 'Date',
    ) as HTMLElement;
    const alphaPill = pills.find(
      (btn: Element) => btn.textContent?.trim() === 'A-Z',
    ) as HTMLElement;
    expect(datePill.classList.contains('active')).toBeTrue();
    expect(alphaPill.classList.contains('active')).toBeFalse();

    alphaPill.click();
    fixture.detectChanges();

    expect(datePill.classList.contains('active')).toBeFalse();
    expect(alphaPill.classList.contains('active')).toBeTrue();
  }));

  it('toggles page size via pill buttons', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'search', tab: 'tasks' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    // Default page size is 10
    const pills = [...fixture.nativeElement.querySelectorAll('.control-pill')];
    const tenPill = pills.find((btn: Element) => btn.textContent?.trim() === '10') as HTMLElement;
    const twentyFivePill = pills.find(
      (btn: Element) => btn.textContent?.trim() === '25',
    ) as HTMLElement;
    expect(tenPill.classList.contains('active')).toBeTrue();
    expect(twentyFivePill.classList.contains('active')).toBeFalse();

    twentyFivePill.click();
    fixture.detectChanges();

    expect(tenPill.classList.contains('active')).toBeFalse();
    expect(twentyFivePill.classList.contains('active')).toBeTrue();
  }));

  it('shows the result count in the header chip', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'search' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.header-chip');
    expect(chip).toBeTruthy();
    // task-1 matches 'search' in title + description, project-1 doesn't contain 'search'
    expect(chip.textContent).toContain('1');
  }));

  it('clears the tab param when switching to the All tab', fakeAsync(() => {
    queryParams$.next(convertToParamMap({ q: 'search', tab: 'tasks' }));
    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    // Switch back to All tab
    const tabButtons = [...fixture.nativeElement.querySelectorAll('.tab-chip')];
    const allTab = tabButtons.find(
      (btn: Element) => btn.textContent?.trim() === 'All',
    ) as HTMLElement;
    allTab.click();
    fixture.detectChanges();
    tick();

    expect(navigateSpy).toHaveBeenCalledWith(['/search'], {
      queryParams: { q: 'search', tab: null },
      replaceUrl: true,
    });
  }));
});
