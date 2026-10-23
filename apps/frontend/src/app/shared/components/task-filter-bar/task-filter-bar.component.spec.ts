import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { Label, Project } from '@yotara/shared';
import { TaskFilterBarComponent, TaskFilterSelection } from './task-filter-bar.component';

const labels: Label[] = [
  {
    id: 'l1',
    name: 'Errand',
    color: '#f1c582',
    icon: 'basket-shopping',
    pinned: false,
    userId: 'u1',
  },
  { id: 'l2', name: 'Writing', color: '#82d7a9', icon: 'pen', pinned: false, userId: 'u1' },
];

const projects: Project[] = [
  {
    id: 'p1',
    name: 'Work',
    ownerId: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    taskCount: 0,
    completedTaskCount: 0,
    openTaskCount: 0,
  },
  {
    id: 'p2',
    name: 'Home',
    ownerId: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    taskCount: 0,
    completedTaskCount: 0,
    openTaskCount: 0,
  },
];

describe('TaskFilterBarComponent', () => {
  let fixture: ComponentFixture<TaskFilterBarComponent>;
  let component: TaskFilterBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskFilterBarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TaskFilterBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('labels', labels);
    fixture.componentRef.setInput('projects', projects);
    fixture.detectChanges();
  });

  function openPanel() {
    fixture.debugElement.query(By.css('.filter-trigger')).nativeElement.click();
    fixture.detectChanges();
  }

  it('opens one panel containing labels, project, and priority', () => {
    openPanel();

    expect(fixture.debugElement.query(By.css('.filter-panel'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('.filter-option')).length).toBe(2);
    expect(fixture.debugElement.query(By.css('.filter-select'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('.priority-pill')).length).toBe(4);
  });

  it('filters the label list as the user searches', () => {
    openPanel();

    const search = fixture.debugElement.query(By.css('.filter-search')).nativeElement;
    search.value = 'wri';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const names = fixture.debugElement
      .queryAll(By.css('.filter-option-name'))
      .map((name) => name.nativeElement.textContent.trim());
    expect(names).toEqual(['Writing']);
  });

  it('moves focus into the search field and returns it on Escape', fakeAsync(() => {
    const trigger: HTMLButtonElement = fixture.debugElement.query(
      By.css('.filter-trigger'),
    ).nativeElement;
    trigger.click();
    fixture.detectChanges();
    tick();

    const search: HTMLInputElement = fixture.debugElement.query(
      By.css('.filter-search'),
    ).nativeElement;
    expect(document.activeElement).toBe(search);

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);
    expect(fixture.debugElement.query(By.css('.filter-panel'))).toBeNull();
  }));

  it('keeps project and priority when a label is toggled', () => {
    fixture.componentRef.setInput('selectedProjectId', 'p1');
    fixture.componentRef.setInput('selectedPriority', 'high');
    fixture.detectChanges();
    openPanel();

    const emitted: TaskFilterSelection[] = [];
    component.filtersChange.subscribe((selection) => emitted.push(selection));

    fixture.debugElement.queryAll(By.css('.filter-option'))[1].nativeElement.click();

    expect(emitted).toEqual([
      { labelIds: ['l2'], labelMode: 'any', projectId: 'p1', priority: 'high' },
    ]);
  });

  it('shows the Any/All mode only with multiple label selections', () => {
    fixture.componentRef.setInput('selectedLabelIds', ['l1']);
    fixture.detectChanges();
    openPanel();
    expect(fixture.debugElement.query(By.css('.filter-mode'))).toBeNull();

    fixture.componentRef.setInput('selectedLabelIds', ['l1', 'l2']);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.filter-mode'))).toBeTruthy();

    const mode = fixture.debugElement.queryAll(By.css('.mode-pill'))[1];
    expect(mode.nativeElement.textContent.trim()).toBe('All labels');
  });

  it('emits a project change while preserving labels and priority', () => {
    fixture.componentRef.setInput('selectedLabelIds', ['l1']);
    fixture.componentRef.setInput('selectedPriority', 'low');
    fixture.detectChanges();
    openPanel();

    const emitted: TaskFilterSelection[] = [];
    component.filtersChange.subscribe((selection) => emitted.push(selection));

    const select: HTMLSelectElement = fixture.debugElement.query(
      By.css('.filter-select'),
    ).nativeElement;
    select.value = 'p2';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toEqual([
      { labelIds: ['l1'], labelMode: 'any', projectId: 'p2', priority: 'low' },
    ]);
  });

  it('emits a priority change while preserving labels and project', () => {
    fixture.componentRef.setInput('selectedLabelIds', ['l1']);
    fixture.componentRef.setInput('selectedProjectId', 'p1');
    fixture.detectChanges();
    openPanel();

    const emitted: TaskFilterSelection[] = [];
    component.filtersChange.subscribe((selection) => emitted.push(selection));

    fixture.debugElement.queryAll(By.css('.priority-pill'))[3].nativeElement.click();

    expect(emitted).toEqual([
      { labelIds: ['l1'], labelMode: 'any', projectId: 'p1', priority: 'high' },
    ]);
  });

  it('shows an active count badge and clears everything', () => {
    fixture.componentRef.setInput('selectedLabelIds', ['l1']);
    fixture.componentRef.setInput('selectedProjectId', 'p1');
    fixture.componentRef.setInput('selectedPriority', 'medium');
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.filter-badge')).nativeElement.textContent).toContain(
      '3',
    );

    const emitted: TaskFilterSelection[] = [];
    component.filtersChange.subscribe((selection) => emitted.push(selection));
    openPanel();
    fixture.debugElement.query(By.css('.filter-action')).nativeElement.click();

    expect(emitted).toEqual([{ labelIds: [], labelMode: 'any', projectId: null, priority: null }]);
  });

  // Regression: `labels` was a plain @Input while `filteredLabels` is a
  // computed. A computed only tracks signal reads, so the option list was
  // frozen at whatever the array held the first time the panel rendered.
  it('re-renders the option list when the labels input changes', () => {
    fixture.componentRef.setInput('labels', [] as Label[]);
    fixture.detectChanges();
    openPanel();
    expect(fixture.debugElement.queryAll(By.css('.filter-option')).length).toBe(0);

    fixture.componentRef.setInput('labels', labels);
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.css('.filter-option')).length).toBe(2);
  });
});
