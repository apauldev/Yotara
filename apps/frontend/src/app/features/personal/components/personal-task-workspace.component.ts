import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CreateTaskDto, Task, UpdateTaskDto } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { StatusService } from '../../../core/services/status.service';
import { TaskService } from '../../../core/services/task.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { PersonalTaskModalComponent } from './personal-task-modal.component';

type SavePayload =
  | { mode: 'create'; payload: CreateTaskDto }
  | { mode: 'update'; taskId: string; payload: UpdateTaskDto };

@Component({
  selector: 'app-personal-task-workspace',
  standalone: true,
  imports: [CommonModule, PersonalTaskModalComponent],
  template: `
    <ng-content />

    <app-personal-task-modal
      [open]="modalOpen()"
      [task]="selectedTask()"
      [projects]="projectService.projects()"
      [initialProjectId]="
        draftProjectId() || initialProjectId || projectService.projects()[0]?.id || null
      "
      [initialTitle]="initialTitle"
      [error]="taskService.error()"
      (close)="closeTaskModal()"
      (save)="saveTask($event)"
    />
  `,
})
export class PersonalTaskWorkspaceComponent {
  @Input() initialProjectId: string | null = null;
  @Input() initialTitle = '';
  @Output() readonly taskSaved = new EventEmitter<'create' | 'update'>();
  @Output() readonly taskSaveFailed = new EventEmitter<string>();

  protected readonly projectService = inject(ProjectService);
  protected readonly taskService = inject(TaskService);
  private readonly statusService = inject(StatusService);
  private readonly preferences = inject(PreferencesStore);
  protected readonly modalOpen = signal(false);
  protected readonly selectedTask = signal<Task | null>(null);
  protected readonly draftProjectId = signal<string | null>(null);

  openCreateTaskModal(projectId?: string | null) {
    this.selectedTask.set(null);
    this.draftProjectId.set(
      projectId ?? this.initialProjectId ?? this.projectService.projects()[0]?.id ?? null,
    );
    this.modalOpen.set(true);
  }

  editTask(task: Task) {
    this.selectedTask.set(task);
    this.modalOpen.set(true);
  }

  closeTaskModal() {
    this.selectedTask.set(null);
    this.draftProjectId.set(null);
    this.modalOpen.set(false);
  }

  protected async saveTask(event: SavePayload) {
    const wasCompleted =
      event.mode === 'update' ? (this.selectedTask()?.completed ?? false) : false;

    try {
      if (event.mode === 'create') {
        await this.taskService.createTask({
          ...event.payload,
          projectId: event.payload.projectId ?? this.initialProjectId ?? undefined,
        });
      } else {
        await this.taskService.updateTask(event.taskId, event.payload);
      }

      if (
        event.mode === 'update' &&
        event.payload.completed === true &&
        !wasCompleted &&
        this.preferences.actionNotifications()
      ) {
        this.statusService.success('Task completed');
      }

      this.projectService.refresh();
      this.taskSaved.emit(event.mode);
      this.closeTaskModal();
    } catch {
      this.taskSaveFailed.emit(
        this.taskService.error() ??
          (event.mode === 'create'
            ? 'Could not save your task right now.'
            : 'Could not update your task right now.'),
      );
    }
  }
}
