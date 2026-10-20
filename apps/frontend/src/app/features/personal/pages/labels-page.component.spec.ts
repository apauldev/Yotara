import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { LabelsPageComponent } from './labels-page.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { LabelService } from '../../../core/services/label.service';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';

interface StubLabel {
  id: string;
  name: string;
  color: string;
  openTaskCount: number;
  completedTaskCount: number;
  totalTaskCount: number;
  taskCount: number;
}

describe('LabelsPageComponent', () => {
  // Pre-sorted alphabetically, mirroring the real LabelService ordering.
  const labels: StubLabel[] = [
    {
      id: 'finance',
      name: 'Finance',
      color: '#f1c582',
      openTaskCount: 2,
      completedTaskCount: 1,
      totalTaskCount: 3,
      taskCount: 3,
    },
    {
      id: 'focus',
      name: 'Focus',
      color: '#81d7e8',
      openTaskCount: 1,
      completedTaskCount: 0,
      totalTaskCount: 1,
      taskCount: 1,
    },
    {
      id: 'writing',
      name: 'Writing',
      color: '#82d7a9',
      openTaskCount: 3,
      completedTaskCount: 4,
      totalTaskCount: 7,
      taskCount: 7,
    },
  ];
  const writingTasks = [
    {
      id: 'task-1',
      title: 'Draft essay',
      status: 'inbox',
      priority: 'medium',
      completed: false,
      createdAt: '2026-04-17T10:00:00Z',
      updatedAt: '2026-04-17T10:00:00Z',
      order: 0,
      labels: ['writing'],
    },
    {
      id: 'task-2',
      title: 'Outline chapter',
      status: 'inbox',
      priority: 'low',
      completed: false,
      createdAt: '2026-04-17T10:00:00Z',
      updatedAt: '2026-04-17T10:00:00Z',
      order: 1,
      labels: ['writing'],
    },
  ];

  let queryParams$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let labelsSignal: WritableSignal<StubLabel[]>;
  let loadingSignal: WritableSignal<boolean>;
  let labelServiceStub: {
    labels: WritableSignal<StubLabel[]>;
    loading: WritableSignal<boolean>;
    error: WritableSignal<string | null>;
    labelById: () => Map<string, StubLabel>;
    createLabel: jasmine.Spy;
    updateLabel: jasmine.Spy;
    deleteLabel: jasmine.Spy;
    deleteLabelAndList: jasmine.Spy;
    refresh: jasmine.Spy;
  };
  let fetchTasksByLabel$: jasmine.Spy;

  beforeEach(async () => {
    queryParams$ = new BehaviorSubject(convertToParamMap({}));
    labelsSignal = signal(labels);
    loadingSignal = signal(false);
    fetchTasksByLabel$ = jasmine
      .createSpy('fetchTasksByLabel$')
      .and.callFake((labelId: string) => of(labelId === 'writing' ? writingTasks : []));

    labelServiceStub = {
      labels: labelsSignal,
      loading: loadingSignal,
      error: signal<string | null>(null),
      labelById: () => new Map(labelsSignal().map((label: StubLabel) => [label.id, label])),
      createLabel: jasmine.createSpy('createLabel'),
      updateLabel: jasmine.createSpy('updateLabel'),
      deleteLabel: jasmine.createSpy('deleteLabel'),
      deleteLabelAndList: jasmine
        .createSpy('deleteLabelAndList')
        .and.callFake(async (labelId: string) => {
          const remaining = labelsSignal().filter((label: StubLabel) => label.id !== labelId);
          labelsSignal.set(remaining);
          return remaining;
        }),
      refresh: jasmine.createSpy('refresh'),
    };

    await TestBed.configureTestingModule({
      imports: [LabelsPageComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            navigate: jasmine
              .createSpy('navigate')
              .and.callFake(
                (
                  _commands: unknown[],
                  extras?: { queryParams?: Record<string, string | null> },
                ) => {
                  const raw = extras?.queryParams ?? {};
                  const params: Record<string, string> = {};
                  for (const [key, value] of Object.entries(raw)) {
                    if (typeof value === 'string') {
                      params[key] = value;
                    }
                  }
                  queryParams$.next(convertToParamMap(params));
                  return Promise.resolve(true);
                },
              ),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams$.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        { provide: LabelService, useValue: labelServiceStub },
        { provide: TaskService, useValue: { fetchTasksByLabel$ } },
        { provide: ProjectService, useValue: { projects: signal([]) } },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(LabelsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders every label as a directory row with a chip', () => {
    const fixture = createFixture();

    const rows = fixture.debugElement.queryAll(By.css('.label-row'));
    expect(rows.length).toBe(3);
    const names = fixture.debugElement
      .queryAll(By.css('.label-directory app-label-chip .label-chip-name'))
      .map((chip) => chip.nativeElement.textContent.trim());
    expect(names).toEqual(['Finance', 'Focus', 'Writing']);
  });

  it('auto-selects the first alphabetical label after labels load', fakeAsync(() => {
    const fixture = TestBed.createComponent(LabelsPageComponent);
    fixture.detectChanges();
    tick();

    expect(queryParams$.getValue().get('label')).toBe('finance');
  }));

  it('queries the task API for the selected label instead of client-filtering', fakeAsync(() => {
    const fixture = TestBed.createComponent(LabelsPageComponent);
    fixture.detectChanges();
    tick();
    expect(fetchTasksByLabel$).toHaveBeenCalledWith('finance');

    // Simulate selecting Writing (row click pushes the param through the router stub).
    const writingRow = fixture.debugElement
      .queryAll(By.css('.label-row-link'))
      .find((link) => link.nativeElement.textContent.includes('Writing'));
    writingRow!.nativeElement.click();
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fetchTasksByLabel$).toHaveBeenCalledWith('writing');
    const titles = fixture.debugElement
      .queryAll(By.css('.task-pane h3'))
      .map((card) => card.nativeElement.textContent.trim());
    expect(titles).toContain('Draft essay');
  }));

  it('never touches allActiveTasks for the pane', () => {
    // The TaskService stub above has no allActiveTasks member at all; if the
    // page still client-filtered, label directory rendering would crash.
    expect(() => createFixture()).not.toThrow();
  });

  it('marks the selected row with aria-current', fakeAsync(() => {
    const fixture = createFixture();
    tick();

    queryParams$.next(convertToParamMap({ label: 'writing' }));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const rows = fixture.debugElement.queryAll(By.css('.label-row-link'));
    const currents = rows
      .filter((row) => row.nativeElement.getAttribute('aria-current') === 'true')
      .map((row) => row.nativeElement.textContent.includes('Writing'));
    expect(currents).toEqual([true]);
  }));

  it('suppresses the active label on pane cards and hides ambient pills', fakeAsync(() => {
    const fixture = createFixture();

    queryParams$.next(convertToParamMap({ label: 'writing' }));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const cards = fixture.debugElement.queryAll(By.directive(PersonalTaskCardComponent));
    expect(cards.length).toBe(2);
    for (const card of cards) {
      expect(card.componentInstance.suppressLabelId).toBe('writing');
      expect(card.componentInstance.showContextMetadata).toBe(false);
    }
  }));

  it('shows the label-not-found state for an unknown ?label param only after load', fakeAsync(() => {
    loadingSignal.set(true);
    const fixture = TestBed.createComponent(LabelsPageComponent);
    queryParams$.next(convertToParamMap({ label: 'ghost' }));
    fixture.detectChanges();

    // While loading, neither the directory nor the not-found state flashes.
    expect(fixture.nativeElement.querySelector('.label-directory')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Label not found');

    loadingSignal.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Label not found');
    expect(fixture.nativeElement.textContent).toContain('Back to all labels');
  }));

  it('opens the editor modal for the row label via the overflow menu', () => {
    const fixture = createFixture();

    const trigger = fixture.debugElement.queryAll(By.css('.row-menu-trigger'))[1];
    trigger.nativeElement.click();
    fixture.detectChanges();

    const editItem = fixture.debugElement.queryAll(By.css('.row-menu [role="menuitem"]'))[0];
    expect(editItem.nativeElement.textContent.trim()).toBe('Edit');
    editItem.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['labelEditorOpen']()).toBeTrue();
    expect(fixture.componentInstance['editorLabel']()?.name).toBe('Focus');
  });

  it('delete confirmation names the label and its open/completed counts', fakeAsync(() => {
    const fixture = createFixture();

    queryParams$.next(convertToParamMap({ label: 'finance' }));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    const trigger = fixture.debugElement.queryAll(By.css('.row-menu-trigger'))[0];
    trigger.nativeElement.click();
    fixture.detectChanges();

    const deleteItem = fixture.debugElement.queryAll(By.css('.row-menu [role="menuitem"]'))[1];
    expect(deleteItem.nativeElement.textContent.trim()).toBe('Delete');
    deleteItem.nativeElement.click();
    fixture.detectChanges();

    const dialog = fixture.debugElement.query(By.css('app-confirm-dialog'));
    expect(dialog.componentInstance.title).toContain('Delete Finance?');
    expect(dialog.componentInstance.description).toContain('2 open and 1 completed tasks');
  }));

  it('deleting a label selects the next one from the refreshed list', fakeAsync(() => {
    const fixture = createFixture();

    queryParams$.next(convertToParamMap({ label: 'writing' }));
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    // Flow through the real UI: row menu → Delete item → dialog confirm.
    const trigger = fixture.debugElement.queryAll(By.css('.row-menu-trigger'))[2];
    trigger.nativeElement.click();
    fixture.detectChanges();

    const deleteItem = fixture.debugElement.queryAll(By.css('.row-menu [role="menuitem"]'))[1];
    deleteItem.nativeElement.click();
    fixture.detectChanges();

    // Task cards embed their own confirm dialogs; pick the page-level one that
    // is actually open.
    const dialog = fixture.debugElement
      .queryAll(By.css('app-confirm-dialog'))
      .find((candidate) => candidate.componentInstance.open);
    if (!dialog) {
      fail('No open page-level confirm dialog after clicking Delete');
      return;
    }
    expect(dialog.componentInstance.title).toContain('Delete Writing?');

    const confirmButton = dialog.query(By.css('.primary-button'));
    confirmButton.nativeElement.click();
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(labelServiceStub.deleteLabelAndList).toHaveBeenCalledWith('writing');
    // finance follows writing's position and survives the delete.
    expect(queryParams$.getValue().get('label')).toBe('focus');
  }));

  it('shows the create-first-label CTA when the user deletes everything', fakeAsync(() => {
    const fixture = createFixture();

    labelsSignal.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Create your first label');
    expect(fixture.debugElement.queryAll(By.css('.label-row')).length).toBe(0);

    void fixture.componentInstance;
    tick();
  }));
});
