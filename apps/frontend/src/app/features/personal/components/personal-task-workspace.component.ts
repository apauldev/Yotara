import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CreateTaskDto, Task, UpdateTaskDto } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { StatusService } from '../../../core/services/status.service';
import { TaskService } from '../../../core/services/task.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PersonalTaskModalComponent } from './personal-task-modal.component';
import type { DueDateDraft } from '../utils/due-date-draft';
import { taskCreationNotification } from '../utils/task-creation-notification';

type SavePayload =
  | { mode: 'create'; payload: CreateTaskDto }
  | { mode: 'update'; taskId: string; payload: UpdateTaskDto };

@Component({
  selector: 'app-personal-task-workspace',
  standalone: true,
  imports: [CommonModule, PersonalTaskModalComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
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
      [initialDueDateDraft]="draftDueDateDraft()"
      [error]="modalError()"
      (close)="closeTaskModal()"
      (save)="saveTask($event)"
    />
  `,
})
export class PersonalTaskWorkspaceComponent {
  @Input() initialProjectId: string | null = null;
  @Input() initialTitle = '';
  @Input() initialDueDateDraft: DueDateDraft | null = null;
  @Output() readonly taskSaved = new EventEmitter<'create' | 'update'>();
  @Output() readonly taskSaveFailed = new EventEmitter<string>();

  protected readonly projectService = inject(ProjectService);
  protected readonly taskService = inject(TaskService);
  private readonly statusService = inject(StatusService);
  private readonly preferences = inject(PreferencesStore);
  private readonly notificationService = inject(NotificationService);
  protected readonly modalOpen = signal(false);
  protected readonly selectedTask = signal<Task | null>(null);
  protected readonly draftProjectId = signal<string | null>(null);
  protected readonly draftDueDateDraft = signal<DueDateDraft | null>(null);
  protected readonly modalError = signal<string | null>(null);

  openCreateTaskModal(
    projectId?: string | null,
    dueDateDraft: DueDateDraft | null = this.initialDueDateDraft,
  ) {
    this.modalError.set(null);
    this.selectedTask.set(null);
    this.draftProjectId.set(
      projectId ?? this.initialProjectId ?? this.projectService.projects()[0]?.id ?? null,
    );
    this.draftDueDateDraft.set(dueDateDraft);
    this.modalOpen.set(true);
  }

  editTask(task: Task) {
    this.modalError.set(null);
    this.selectedTask.set(task);
    this.draftDueDateDraft.set(null);
    this.modalOpen.set(true);
  }

  closeTaskModal() {
    this.modalError.set(null);
    this.selectedTask.set(null);
    this.draftProjectId.set(null);
    this.draftDueDateDraft.set(null);
    this.modalOpen.set(false);
  }

  protected async saveTask(event: SavePayload) {
    const wasCompleted =
      event.mode === 'update' ? (this.selectedTask()?.completed ?? false) : false;
    const createdProjectId =
      event.mode === 'create'
        ? (event.payload.projectId ?? this.initialProjectId ?? undefined)
        : undefined;

    try {
      if (event.mode === 'create') {
        await this.taskService.createTask({
          ...event.payload,
          projectId: createdProjectId,
        });
      } else {
        await this.taskService.updateTask(event.taskId, event.payload);
      }

      if (event.mode === 'create') {
        this.statusService.success(
          taskCreationNotification({
            title: event.payload.title,
            dueDate: event.payload.dueDate,
            status: event.payload.status ?? 'inbox',
            projects: this.projectService.projects(),
            projectId: createdProjectId,
          }),
        );
      }

      if (event.mode === 'update' && event.payload.completed === true && !wasCompleted) {
        if (this.preferences.actionNotifications()) {
          this.statusService.success('Task completed');
        }
        this.notificationService.showBrowserNotification(
          'Task completed',
          this.selectedTask()?.title ?? '',
        );
      }

      this.projectService.refresh();
      this.taskSaved.emit(event.mode);
      this.closeTaskModal();
    } catch {
      const message =
        this.taskService.error() ??
        (event.mode === 'create'
          ? 'Could not save your task right now.'
          : 'Could not update your task right now.');
      this.modalError.set(message);
      this.taskSaveFailed.emit(message);
    }
  }
}
