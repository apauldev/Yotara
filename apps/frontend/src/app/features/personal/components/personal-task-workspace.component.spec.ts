import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { provideMarkdown } from 'ngx-markdown';
import { CreateTaskDto, Task, UpdateTaskDto } from '@yotara/shared';
import { PersonalTaskModalComponent } from './personal-task-modal.component';
import { PersonalTaskWorkspaceComponent } from './personal-task-workspace.component';
import { ProjectService } from '../../../core/services/project.service';
import { StatusService } from '../../../core/services/status.service';
import { TaskService } from '../../../core/services/task.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import type { DueDateDraft } from '../utils/due-date-draft';

@Component({
  standalone: true,
  imports: [PersonalTaskWorkspaceComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-personal-task-workspace
      [initialProjectId]="initialProjectId"
      [initialTitle]="initialTitle"
    >
      <p class="projected-copy">Projected content</p>
    </app-personal-task-workspace>
  `,
})
class WorkspaceHostComponent {
  initialProjectId = 'project-1';
  initialTitle = 'Captured from inbox';
}

describe('PersonalTaskWorkspaceComponent', () => {
  let fixture: ComponentFixture<WorkspaceHostComponent>;
  let projectService: { projects: ReturnType<typeof signal>; refresh: jasmine.Spy };
  let taskService: {
    error: ReturnType<typeof signal<string | null>>;
    createTask: jasmine.Spy;
    updateTask: jasmine.Spy;
  };
  let statusServiceSpy: jasmine.SpyObj<StatusService>;
  let preferences: PreferencesStore;

  const task: Task = {
    id: 'task-1',
    title: 'Draft release notes',
    description: 'Summarize the rollout',
    status: 'today',
    priority: 'high',
    completed: false,
    createdAt: '2026-04-18T08:00:00.000Z',
    updatedAt: '2026-04-18T08:00:00.000Z',
    order: 1,
    simpleMode: true,
    bucket: 'deep-work',
    projectId: 'project-1',
  };

  beforeEach(async () => {
    projectService = {
      projects: signal([
        {
          id: 'project-1',
          name: 'Launch Plan',
          description: 'Core release scope',
          color: 'sage' as const,
          ownerId: 'user-1',
          taskCount: 4,
          completedTaskCount: 2,
          openTaskCount: 2,
          createdAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-03T10:00:00.000Z',
        },
      ]),
      refresh: jasmine.createSpy('refresh'),
    };

    taskService = {
      error: signal<string | null>(null),
      createTask: jasmine.createSpy('createTask').and.resolveTo({
        id: 'created-task',
      }),
      updateTask: jasmine.createSpy('updateTask').and.resolveTo({
        id: 'updated-task',
      }),
    };

    statusServiceSpy = jasmine.createSpyObj<StatusService>('StatusService', [
      'success',
      'error',
      'show',
      'remove',
    ]);

    preferences = {
      actionNotifications: signal(true),
      setActionNotifications: jasmine.createSpy('setActionNotifications'),
    } as unknown as PreferencesStore;

    await TestBed.configureTestingModule({
      imports: [WorkspaceHostComponent],
      providers: [
        provideMarkdown(),
        { provide: ProjectService, useValue: projectService },
        { provide: TaskService, useValue: taskService },
        { provide: StatusService, useValue: statusServiceSpy },
        { provide: PreferencesStore, useValue: preferences },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspaceHostComponent);
  });

  it('projects content and keeps the modal closed by default', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Projected content');

    const modal = fixture.debugElement.query(By.directive(PersonalTaskModalComponent))
      .componentInstance as PersonalTaskModalComponent;
    expect(modal.open).toBeFalse();
    expect(modal.task).toBeNull();
  });

  it('opens the create modal with the workspace defaults', () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;

    workspace.openCreateTaskModal();
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(PersonalTaskModalComponent))
      .componentInstance as PersonalTaskModalComponent;

    expect(modal.open).toBeTrue();
    expect(modal.task).toBeNull();
    expect(modal.initialProjectId).toBe('project-1');
    expect(modal.initialTitle).toBe('Captured from inbox');
  });

  it('does not show a stale service error in a new modal session', () => {
    fixture.detectChanges();
    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;

    taskService.error.set('Could not load tasks right now.');
    workspace.openCreateTaskModal();
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(PersonalTaskModalComponent))
      .componentInstance as PersonalTaskModalComponent;
    expect(taskService.error()).toBe('Could not load tasks right now.');
    expect(modal.error).toBeNull();
  });

  it('passes a structured new-task date draft into the modal', () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;
    const dueDateDraft: DueDateDraft = {
      value: '2026-10-02',
      source: 'inferred',
      matchedText: 'Friday',
      matchStart: 9,
      matchEnd: 15,
    };

    workspace.openCreateTaskModal('project-1', dueDateDraft);
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(PersonalTaskModalComponent))
      .componentInstance as PersonalTaskModalComponent;
    expect(modal.initialDueDateDraft).toEqual(dueDateDraft);
    expect(modal['draftDueDate']()).toBe('2026-10-02');
    expect(modal['draftSimpleMode']()).toBeFalse();
  });

  it('does not hydrate a cleared date draft as a due date', () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;
    workspace.openCreateTaskModal('project-1', {
      value: '',
      source: 'cleared',
      matchedText: 'Friday',
      matchStart: 9,
      matchEnd: 15,
    });
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(PersonalTaskModalComponent))
      .componentInstance as PersonalTaskModalComponent;
    expect(modal['draftDueDate']()).toBe('');
    expect(modal['draftSimpleMode']()).toBeTrue();
  });

  it('opens the edit modal for a selected task', () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;

    workspace.editTask(task);
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(PersonalTaskModalComponent))
      .componentInstance as PersonalTaskModalComponent;

    expect(modal.open).toBeTrue();
    expect(modal.task).toEqual(task);
    expect(modal.initialProjectId).toBe('project-1');
  });

  it('closes the visible edit modal when Escape is pressed in the dialog', () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;

    workspace.editTask(task);
    fixture.detectChanges();

    // Escape handling is local to the shared dialog (Task 2), not document-level.
    const dialog = fixture.nativeElement.querySelector('.modal-card') as HTMLElement;
    expect(dialog).toBeTruthy();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(PersonalTaskModalComponent))
      .componentInstance as PersonalTaskModalComponent;
    expect(modal.open).toBeFalse();
    expect(modal.task).toBeNull();
  });

  it('creates a task, refreshes projects, and closes the modal', async () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;
    const savedSpy = spyOn(workspace.taskSaved, 'emit');

    await workspace['saveTask']({
      mode: 'create',
      payload: {
        title: 'New task',
        description: 'Focus on the next step',
        status: 'inbox',
        priority: 'medium',
        dueDate: undefined,
        simpleMode: true,
        bucket: 'personal-sanctuary',
        projectId: undefined,
      },
    });

    expect(taskService.createTask).toHaveBeenCalledWith(
      jasmine.objectContaining({
        title: 'New task',
        projectId: 'project-1',
      }),
    );
    expect(projectService.refresh).toHaveBeenCalled();
    expect(statusServiceSpy.success).toHaveBeenCalledWith(
      '"New task" added to Inbox (Launch Plan)',
    );
    expect(savedSpy).toHaveBeenCalledWith('create');
    expect(workspace['modalOpen']()).toBeFalse();
    expect(workspace['selectedTask']()).toBeNull();
  });

  it('confirms the destination view for a manually created task with a status', async () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;

    await workspace['saveTask']({
      mode: 'create',
      payload: {
        title: 'Plan the week',
        description: '',
        status: 'today',
        priority: 'medium',
        dueDate: undefined,
        simpleMode: true,
        bucket: 'personal-sanctuary',
        projectId: 'project-1',
      },
    });

    expect(statusServiceSpy.success).toHaveBeenCalledWith(
      '"Plan the week" added to Today (Launch Plan)',
    );
  });

  it('does not announce a destination when updating an existing task', async () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;

    await workspace['saveTask']({
      mode: 'update',
      taskId: task.id,
      payload: {
        title: 'Draft release notes',
        description: '',
        status: 'today',
        priority: 'high',
        dueDate: '2026-10-02',
        simpleMode: true,
        bucket: 'deep-work',
        projectId: 'project-1',
      } as UpdateTaskDto,
    });

    expect(statusServiceSpy.success).not.toHaveBeenCalled();
  });

  it('updates a task and emits the update event', async () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;
    const savedSpy = spyOn(workspace.taskSaved, 'emit');

    await workspace['saveTask']({
      mode: 'update',
      taskId: task.id,
      payload: {
        title: 'Draft release notes',
        description: 'Summarize the rollout',
        status: 'today',
        priority: 'high',
        dueDate: undefined,
        simpleMode: true,
        bucket: 'deep-work',
        projectId: 'project-1',
        completed: true,
      } as UpdateTaskDto,
    });

    expect(taskService.updateTask).toHaveBeenCalledWith(
      task.id,
      jasmine.objectContaining({
        completed: true,
      }),
    );
    expect(projectService.refresh).toHaveBeenCalled();
    expect(savedSpy).toHaveBeenCalledWith('update');
    expect(workspace['modalOpen']()).toBeFalse();
    expect(statusServiceSpy.success).toHaveBeenCalledWith('Task completed');
  });

  it('emits a save failure when the service rejects', async () => {
    taskService.error.set('Could not save your task right now.');
    taskService.createTask.and.rejectWith(new Error('offline'));

    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;
    const failedSpy = spyOn(workspace.taskSaveFailed, 'emit');

    await workspace['saveTask']({
      mode: 'create',
      payload: {
        title: 'New task',
        description: undefined,
        status: 'inbox',
        priority: 'medium',
        dueDate: undefined,
        simpleMode: true,
        bucket: 'personal-sanctuary',
        projectId: undefined,
      } as CreateTaskDto,
    });

    expect(failedSpy).toHaveBeenCalledWith('Could not save your task right now.');
    expect(projectService.refresh).not.toHaveBeenCalled();
    expect(workspace['modalOpen']()).toBeFalse();
  });
});
