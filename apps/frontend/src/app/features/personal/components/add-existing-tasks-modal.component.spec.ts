import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import {
  AddExistingTasksModalComponent,
  MAX_BATCH_TASKS,
  type AddExistingTasksPayload,
} from './add-existing-tasks-modal.component';
import { TaskService } from '../../../core/services/task.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../shared/ui/date-picker/date-picker.component';
import { PaginatedResponse, ProjectSection, Task } from '@yotara/shared';

const sections: ProjectSection[] = [
  {
    id: 'section-1',
    projectId: 'project-1',
    name: 'Triage',
    sortOrder: 0,
    taskCount: 0,
    completedTaskCount: 0,
    openTaskCount: 0,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  },
];

const looseTasks = [
  { id: 'task-1', title: 'Write release notes' },
  { id: 'task-2', title: 'Book flights' },
] as Task[];

function paginated(tasks: Task[]): PaginatedResponse<Task[]> {
  return {
    data: tasks,
    meta: {
      total: tasks.length,
      page: 1,
      pageSize: 3000,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

describe('AddExistingTasksModalComponent', () => {
  let taskService: { getUnassignedTasks: jasmine.Spy; creating: ReturnType<typeof signal> };

  beforeEach(async () => {
    taskService = {
      getUnassignedTasks: jasmine
        .createSpy('getUnassignedTasks')
        .and.returnValue(of(paginated(looseTasks))),
      creating: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [AddExistingTasksModalComponent],
      providers: [{ provide: TaskService, useValue: taskService }],
    }).compileComponents();
  });

  function openModal() {
    const fixture = TestBed.createComponent(AddExistingTasksModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.componentRef.setInput('projectName', 'Launch');
    fixture.componentRef.setInput('sections', sections);
    fixture.detectChanges();
    return fixture;
  }

  it('loads unassigned tasks when opened', () => {
    const fixture = openModal();

    expect(taskService.getUnassignedTasks).toHaveBeenCalled();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Add existing tasks to Launch');
    expect(text).toContain('Write release notes');
    expect(text).toContain('Book flights');
    expect(fixture.debugElement.query(By.directive(ModalComponent))).toBeTruthy();
  });

  it('multi-selects tasks and emits a patch for all of them', () => {
    const fixture = openModal();
    let payload: unknown;
    fixture.componentInstance.add.subscribe((event) => (payload = event));

    const checkboxes = fixture.debugElement.queryAll(By.css('.task-list input[type=checkbox]'));
    expect(checkboxes.length).toBe(2);
    checkboxes[0].nativeElement.click();
    checkboxes[1].nativeElement.click();
    fixture.detectChanges();

    const confirm = fixture.debugElement.query(By.css('.picker-actions .primary-button'));
    expect(confirm.nativeElement.textContent).toContain('Add 2 tasks');
    confirm.nativeElement.click();

    expect(payload).toEqual({
      taskIds: ['task-1', 'task-2'],
      patch: { projectId: 'project-1', sectionId: null },
    });
  });

  it('supports select all and optional metadata', () => {
    const fixture = openModal();
    let payload: AddExistingTasksPayload | undefined;
    fixture.componentInstance.add.subscribe((event) => (payload = event));

    fixture.debugElement.query(By.css('.select-all input')).nativeElement.click();
    fixture.detectChanges();

    const selects = fixture.debugElement.queryAll(By.css('.metadata-bar select'));
    selects[0].nativeElement.selectedIndex = 1;
    selects[0].nativeElement.dispatchEvent(new Event('change'));
    selects[1].nativeElement.value = 'high';
    selects[1].nativeElement.dispatchEvent(new Event('change'));

    const datePicker = fixture.debugElement.query(By.directive(DatePickerComponent));
    datePicker.componentInstance.valueChange.emit('2026-11-20');
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.picker-actions .primary-button')).nativeElement.click();

    expect(payload?.taskIds).toEqual(['task-1', 'task-2']);
    expect(payload?.patch).toEqual({
      projectId: 'project-1',
      sectionId: 'section-1',
      priority: 'high',
      dueDate: '2026-11-20',
    });
  });

  it('filters the list by title', () => {
    const fixture = openModal();

    const filter = fixture.debugElement.query(By.css('.task-filter'));
    filter.nativeElement.value = 'book';
    filter.nativeElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const titles = fixture.debugElement
      .queryAll(By.css('.task-list .task-title'))
      .map((element) => element.nativeElement.textContent.trim());
    expect(titles).toEqual(['Book flights']);
  });

  it('caps selection at MAX_BATCH_TASKS and disables further checkboxes', () => {
    const manyTasks: Task[] = Array.from(
      { length: 105 },
      (_, i) =>
        ({
          id: `task-${i + 1}`,
          title: `Task ${i + 1}`,
        }) as Task,
    );
    taskService.getUnassignedTasks.and.returnValue(of(paginated(manyTasks)));

    const fixture = openModal();

    const capNote = fixture.debugElement.query(By.css('.cap-note'));
    expect(capNote).toBeTruthy();
    expect(capNote.nativeElement.textContent).toContain(
      `first ${MAX_BATCH_TASKS} will be selected`,
    );

    fixture.debugElement.query(By.css('.select-all input')).nativeElement.click();
    fixture.detectChanges();

    const confirmButton = fixture.debugElement.query(By.css('.picker-actions .primary-button'));
    expect(confirmButton.nativeElement.textContent).toContain(`Add ${MAX_BATCH_TASKS} tasks`);

    const capWarning = fixture.debugElement.query(By.css('.cap-warning'));
    expect(capWarning).toBeTruthy();
    expect(capWarning.nativeElement.textContent).toContain(
      `Maximum limit of ${MAX_BATCH_TASKS} tasks reached`,
    );

    const checkboxes = fixture.debugElement.queryAll(By.css('.task-list input[type=checkbox]'));
    expect(checkboxes.length).toBe(105);
    expect(checkboxes[0].nativeElement.checked).toBeTrue();
    expect(checkboxes[0].nativeElement.disabled).toBeFalse();
    expect(checkboxes[99].nativeElement.checked).toBeTrue();
    expect(checkboxes[99].nativeElement.disabled).toBeFalse();
    expect(checkboxes[100].nativeElement.checked).toBeFalse();
    expect(checkboxes[100].nativeElement.disabled).toBeTrue();
    expect(checkboxes[104].nativeElement.checked).toBeFalse();
    expect(checkboxes[104].nativeElement.disabled).toBeTrue();

    checkboxes[100].nativeElement.click();
    fixture.detectChanges();
    expect(confirmButton.nativeElement.textContent).toContain(`Add ${MAX_BATCH_TASKS} tasks`);

    checkboxes[0].nativeElement.click();
    fixture.detectChanges();
    expect(checkboxes[100].nativeElement.disabled).toBeFalse();
    expect(fixture.debugElement.query(By.css('.cap-warning'))).toBeNull();
  });
});
