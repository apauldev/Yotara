import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { TaskService } from '../../../core/services/task.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';

@Component({
  selector: 'app-archive-page',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    ConfirmDialogComponent,
    PageHeaderComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
  ],
  template: `
    <app-personal-task-workspace #workspace>
      <section class="page">
        <app-page-header
          eyebrow="Personal Sanctuary"
          title="Archive"
          subtitle="Completed tasks stay here, and permanent archives remain until you remove them."
        />

        @if (taskService.loading()) {
          <p class="status-copy">Loading your recent completions...</p>
        } @else if (taskService.error()) {
          <p class="status-copy">{{ taskService.error() }}</p>
        } @else if (taskService.archivedTasks().length === 0) {
          <div class="empty-state">
            <h2>Nothing archived yet</h2>
            <p>Completed work will appear here, and permanent archives stay put.</p>
          </div>
        } @else {
          <div class="archive-summary">
            <span>{{ taskService.archivedTasks().length }} archived tasks</span>
            <p>Use the permanent archive tag to keep a task from being auto-cleared.</p>
          </div>

          <div class="task-stack">
            @for (task of taskService.archivedTasks(); track task.id) {
              <app-personal-task-card
                [task]="task"
                [interactive]="true"
                [showDescription]="false"
                [showCompletionState]="true"
                [showArchiveActions]="true"
                (select)="workspace.editTask(task)"
                (togglePermanentArchive)="togglePermanentArchive(task)"
                (deleteForever)="requestDelete(task)"
              />
            }
          </div>
        }
      </section>
    </app-personal-task-workspace>

    <app-confirm-dialog
      [open]="deleteConfirmOpen()"
      title="Delete archived task?"
      [description]="deleteDescription()"
      confirmLabel="Delete forever"
      cancelLabel="Keep it"
      [loading]="deletingTask()"
      loadingLabel="Deleting..."
      [danger]="true"
      (confirm)="deleteArchivedTask()"
      (cancel)="closeDeleteConfirm()"
      (close)="closeDeleteConfirm()"
    >
      <div confirm-icon class="confirm-icon-wrap" aria-hidden="true">
        <div class="confirm-icon-disc">
          <fa-icon [icon]="faTrash"></fa-icon>
        </div>
      </div>
    </app-confirm-dialog>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        padding: 1rem 0 2rem;
      }

      .status-copy {
        margin-top: 0.6rem;
        color: var(--on-surface-muted);
        font-size: 1.08rem;
      }

      .archive-summary {
        margin: 1rem 0 1rem;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        color: var(--on-surface-muted);
      }

      .archive-summary span {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
      }

      .archive-summary p {
        margin: 0;
      }

      .confirm-icon-wrap {
        display: grid;
        place-items: center;
        margin-bottom: 1rem;
      }

      .confirm-icon-disc {
        width: 4.4rem;
        height: 4.4rem;
        border-radius: 999px;
        background: var(--error-soft);
        display: grid;
        place-items: center;
        color: var(--status-overdue);
        font-size: 1.35rem;
      }

      .task-stack,
      .empty-state {
        border-radius: 1.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 1.25rem;
      }

      .task-stack {
        display: grid;
        gap: 0.85rem;
      }

      .empty-state h2 {
        margin: 0;
        font-size: 1.7rem;
        letter-spacing: -0.04em;
      }

      .empty-state p {
        margin: 0.55rem 0 0;
        color: var(--on-surface-muted);
      }
    `,
  ],
})
export class ArchivePageComponent {
  protected readonly taskService = inject(TaskService);
  protected readonly faTrash = faTrash;
  protected readonly deletingTask = signal(false);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly taskPendingDelete = signal<{
    id: string;
    title: string;
  } | null>(null);

  requestDelete(task: { id: string; title: string }) {
    this.taskPendingDelete.set(task);
    this.deleteConfirmOpen.set(true);
  }

  closeDeleteConfirm() {
    this.deleteConfirmOpen.set(false);
    this.taskPendingDelete.set(null);
  }

  async deleteArchivedTask() {
    const task = this.taskPendingDelete();
    if (!task) {
      return;
    }

    this.deletingTask.set(true);
    try {
      await this.taskService.deleteTask(task.id);
      this.closeDeleteConfirm();
    } finally {
      this.deletingTask.set(false);
    }
  }

  async togglePermanentArchive(task: { id: string; permanentArchive?: boolean }) {
    await this.taskService.updateTask(task.id, {
      permanentArchive: !task.permanentArchive,
    });
  }

  deleteDescription() {
    const task = this.taskPendingDelete();
    return task
      ? `This will permanently remove ${task.title} from your archive.`
      : 'This will permanently remove the selected task from your archive.';
  }
}
