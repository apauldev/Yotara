import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { TrashListComponent } from './trash-list.component';
import { TaskService } from '../../../core/services/task.service';
import { LogService } from '../../../core/services/log.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginatedResponse, Task } from '@yotara/shared';

const trashedTask = (overrides?: Partial<Task>): Task =>
  ({
    id: 'task-1',
    title: 'Deleted with project',
    status: 'inbox',
    priority: 'medium',
    completed: false,
    order: 0,
    deletedAt: '2026-11-17T10:00:00.000Z',
    labels: [],
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-17T10:00:00.000Z',
    ...overrides,
  }) as Task;

function paginatedResponse(tasks: Task[]): PaginatedResponse<Task[]> {
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

describe('TrashListComponent', () => {
  let taskService: {
    version: ReturnType<typeof signal>;
    getDeletedTasks: jasmine.Spy;
    restoreTask: jasmine.Spy;
  };

  beforeEach(async () => {
    taskService = {
      version: signal(0),
      getDeletedTasks: jasmine
        .createSpy('getDeletedTasks')
        .and.returnValue(of(paginatedResponse([]))),
      restoreTask: jasmine.createSpy('restoreTask').and.resolveTo(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TrashListComponent],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: LogService, useValue: { error: jasmine.createSpy('error') } },
      ],
    }).compileComponents();
  });

  it('shows the 30-day recovery note and empty state when nothing is deleted', () => {
    const fixture = TestBed.createComponent(TrashListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('removed permanently after 30 days');
    expect(text).toContain('restores the whole project with its tasks');
    expect(text).toContain('Trash is empty');
    expect(fixture.debugElement.query(By.directive(EmptyStateComponent))).toBeTruthy();
  });

  it('lists a single trashed task with its deletion date and restore action', () => {
    taskService.getDeletedTasks.and.returnValue(of(paginatedResponse([trashedTask()])));
    const fixture = TestBed.createComponent(TrashListComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Deleted with project');
    expect(text).toContain('Deleted 2026-11-17');
    expect(text).toContain('1 task');

    const button = fixture.debugElement.query(By.css('.restore-button'));
    expect(button.nativeElement.textContent).toContain('Restore task');
    expect(button.nativeElement.getAttribute('aria-label')).toBe('Restore 1 task');

    button.nativeElement.click();
    expect(taskService.restoreTask).toHaveBeenCalledOnceWith('task-1');
  });

  it('groups tasks deleted together under a single restore button', () => {
    taskService.getDeletedTasks.and.returnValue(
      of(
        paginatedResponse([
          trashedTask(),
          trashedTask({ id: 'task-2', title: 'Second deleted task' }),
          trashedTask({
            id: 'task-3',
            title: 'Older deletion',
            deletedAt: '2026-11-10T10:00:00.000Z',
          }),
        ]),
      ),
    );
    const fixture = TestBed.createComponent(TrashListComponent);
    fixture.detectChanges();

    const groups = fixture.debugElement.queryAll(By.css('.trash-group'));
    expect(groups.length).toBe(2);

    const buttons = fixture.debugElement.queryAll(By.css('.restore-button'));
    expect(buttons.length).toBe(2);
    expect(buttons[0].nativeElement.textContent).toContain('Restore task');

    // One click restores the whole batch identified by the deletion stamp.
    buttons[0].nativeElement.click();
    expect(taskService.restoreTask).toHaveBeenCalledOnceWith('task-1');

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Deleted with project');
    expect(text).toContain('Second deleted task');
    expect(text).toContain('Older deletion');
  });

  it('names the deleted project and offers a single project restore', () => {
    taskService.getDeletedTasks.and.returnValue(
      of(
        paginatedResponse([
          trashedTask({ deletedProjectName: 'Launch Yotara MVP' }),
          trashedTask({
            id: 'task-2',
            title: 'Second deleted task',
            deletedProjectName: 'Launch Yotara MVP',
          }),
        ]),
      ),
    );
    const fixture = TestBed.createComponent(TrashListComponent);
    fixture.detectChanges();

    const group = fixture.debugElement.query(By.css('.trash-group'));
    expect(group.nativeElement.textContent).toContain('Launch Yotara MVP · 2 tasks');

    const button = group.query(By.css('.restore-button')).nativeElement;
    expect(button.textContent).toContain('Restore project & tasks');
    expect(button.getAttribute('aria-label')).toBe('Restore Launch Yotara MVP · 2 tasks');
  });

  it('shows the loading copy while Trash is being fetched', () => {
    const pending = new Subject<PaginatedResponse<Task[]>>();
    taskService.getDeletedTasks.and.returnValue(pending.asObservable());

    const fixture = TestBed.createComponent(TrashListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading your trashed tasks');

    pending.next(paginatedResponse([]));
    pending.complete();
    fixture.detectChanges();
  });

  it('shows an error message when fetching fails', () => {
    taskService.getDeletedTasks.and.returnValue(throwError(() => new Error('boom')));
    const fixture = TestBed.createComponent(TrashListComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Could not load Trash right now.');
  });

  it('surfaces a restore failure without losing the group', async () => {
    taskService.getDeletedTasks.and.returnValue(of(paginatedResponse([trashedTask()])));
    taskService.restoreTask.and.rejectWith(new Error('boom'));

    const fixture = TestBed.createComponent(TrashListComponent);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('.restore-button')).nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Could not restore these tasks');
    expect(fixture.nativeElement.textContent).toContain('Deleted with project');
  });
});
