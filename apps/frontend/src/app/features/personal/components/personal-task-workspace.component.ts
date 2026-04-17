import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CreateTaskDto, Task, UpdateTaskDto } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
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
      [initialProjectId]="initialProjectId"
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
  protected readonly modalOpen = signal(false);
  protected readonly selectedTask = signal<Task | null>(null);

  openCreateTaskModal() {
    this.selectedTask.set(null);
    this.modalOpen.set(true);
  }

  editTask(task: Task) {
    this.selectedTask.set(task);
    this.modalOpen.set(true);
  }

  closeTaskModal() {
    this.selectedTask.set(null);
    this.modalOpen.set(false);
  }

  protected async saveTask(event: SavePayload) {
    try {
      if (event.mode === 'create') {
        await this.taskService.createTask({
          ...event.payload,
          projectId: event.payload.projectId ?? this.initialProjectId ?? undefined,
        });
      } else {
        await this.taskService.updateTask(event.taskId, event.payload);
      }

      this.projectService.refreshProjects();
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
