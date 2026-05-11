import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { LabelsPageComponent } from './labels-page.component';
import { LabelService } from '../../../core/services/label.service';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';

describe('LabelsPageComponent', () => {
  const queryParams$ = new BehaviorSubject(convertToParamMap({}));
  const labels = signal([
    { id: 'writing', name: 'Writing', color: '#82d7a9', taskCount: 3 },
    { id: 'focus', name: 'Focus', color: '#81d7e8', taskCount: 1 },
    { id: 'finance', name: 'Finance', color: '#f1c582', taskCount: 2 },
    { id: 'frontend-only', name: 'frontend-only', color: '#b9a3f4', taskCount: 4 },
  ]);
  const tasks = signal([]);

  beforeEach(async () => {
    queryParams$.next(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [LabelsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams$.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: LabelService,
          useValue: {
            labels,
            loading: signal(false),
            error: signal(null),
            createLabel: jasmine.createSpy('createLabel').and.resolveTo({
              id: 'created-label',
              name: 'Created Label',
              color: '#82d7a9',
              taskCount: 0,
            }),
            refreshLabels: jasmine.createSpy('refreshLabels'),
          },
        },
        {
          provide: TaskService,
          useValue: {
            tasks,
            error: signal(null),
            createTask: jasmine.createSpy('createTask').and.resolveTo(undefined),
            updateTask: jasmine.createSpy('updateTask').and.resolveTo(undefined),
          },
        },
        {
          provide: ProjectService,
          useValue: {
            projects: signal([]),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the placeholder label summaries', () => {
    const fixture = TestBed.createComponent(LabelsPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Writing');
    expect(text).toContain('Focus');
    expect(text).toContain('Finance');
    expect(text).toContain('frontend-only');
  });

  it('selects a label and updates the task pane title', fakeAsync(() => {
    const fixture = TestBed.createComponent(LabelsPageComponent);
    fixture.detectChanges();
    tick();

    // Directly push to our mock to simulate navigation result
    queryParams$.next(convertToParamMap({ label: 'writing' }));
    fixture.detectChanges();
    tick();

    const paneTitle = fixture.nativeElement.querySelector('#task-pane-title');
    expect(paneTitle.textContent).toContain('Writing');
  }));

  it('opens the edit modal when the edit button is clicked', () => {
    const fixture = TestBed.createComponent(LabelsPageComponent);
    fixture.detectChanges();

    const editBtn = fixture.nativeElement.querySelector('[aria-label*="Edit label"]');
    editBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['labelModalOpen']()).toBeTrue();
    expect(fixture.componentInstance['labelModalMode']()).toBe('edit');
  });
});
