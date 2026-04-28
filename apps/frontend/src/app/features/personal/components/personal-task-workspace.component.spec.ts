import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { CreateTaskDto, Task, UpdateTaskDto } from '@yotara/shared';
import { PersonalTaskModalComponent } from './personal-task-modal.component';
import { PersonalTaskWorkspaceComponent } from './personal-task-workspace.component';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';

@Component({
  standalone: true,
  imports: [PersonalTaskWorkspaceComponent],
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
  let projectService: { projects: ReturnType<typeof signal>; refreshProjects: jasmine.Spy };
  let taskService: {
    error: ReturnType<typeof signal<string | null>>;
    createTask: jasmine.Spy;
    updateTask: jasmine.Spy;
  };

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
      refreshProjects: jasmine.createSpy('refreshProjects'),
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

    await TestBed.configureTestingModule({
      imports: [WorkspaceHostComponent],
      providers: [
        { provide: ProjectService, useValue: projectService },
        { provide: TaskService, useValue: taskService },
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

  it('closes the visible edit modal when Escape is pressed', () => {
    fixture.detectChanges();

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;

    workspace.editTask(task);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
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
    expect(projectService.refreshProjects).toHaveBeenCalled();
    expect(savedSpy).toHaveBeenCalledWith('create');
    expect(workspace['modalOpen']()).toBeFalse();
    expect(workspace['selectedTask']()).toBeNull();
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
    expect(projectService.refreshProjects).toHaveBeenCalled();
    expect(savedSpy).toHaveBeenCalledWith('update');
    expect(workspace['modalOpen']()).toBeFalse();
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
    expect(projectService.refreshProjects).not.toHaveBeenCalled();
    expect(workspace['modalOpen']()).toBeFalse();
  });
});
