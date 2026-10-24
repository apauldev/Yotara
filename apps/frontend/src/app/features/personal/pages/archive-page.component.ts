import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBoxArchive, faTrash } from '@fortawesome/free-solid-svg-icons';
import { catchError, combineLatest, finalize, of, switchMap, tap } from 'rxjs';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { TaskService } from '../../../core/services/task.service';
import { LogService } from '../../../core/services/log.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { PaginatedResponse, Task } from '@yotara/shared';

@Component({
  selector: 'app-archive-page',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    ConfirmDialogComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    PaginationComponent,
  ],
  template: `
    <app-personal-task-workspace #workspace>
      <section class="page">
        <app-page-header title="Completed">
          <div page-header-actions>
            @if (totalArchived() > 0) {
              <button
                type="button"
                class="clear-completed"
                [attr.aria-label]="'Clear completed tasks'"
                (click)="requestClearCompleted()"
              >
                <fa-icon [icon]="faTrash" aria-hidden="true"></fa-icon>
                <span>Clear completed</span>
              </button>
            }
          </div>
        </app-page-header>

        @if (loadingArchive()) {
          <p class="status-copy">Loading your recent completions...</p>
        } @else if (archiveError()) {
          <p class="status-copy">{{ archiveError() }}</p>
        } @else if (archiveResponse().data.length === 0 && totalArchived() === 0) {
          <app-empty-state
            title="No completed tasks yet"
            description="Finished tasks will appear here for 30 days. Mark one “Keep forever” to save it from auto-clearing."
            [icon]="faBoxArchive"
          />
        } @else if (archiveResponse().data.length === 0 && totalArchived() > 0) {
          <div class="archive-summary">
            <span>{{ totalArchived() }} completed tasks</span>
            <p>Mark a task “Keep forever” to save it from auto-clearing.</p>
          </div>

          <p class="status-copy">This page is empty — try a different page.</p>

          @if (totalArchived() > pageSize()) {
            <div class="pagination-wrap">
              <app-pagination
                [currentPage]="currentPage()"
                [pageSize]="pageSize()"
                [totalItems]="totalArchived()"
                (pageChange)="onPageChange($event)"
              />
            </div>
          }
        } @else {
          <div class="archive-summary">
            <span>{{ totalArchived() }} completed tasks</span>
            <p>Completed tasks auto-clear after 30 days. Marked “Keep forever” tasks never do.</p>
          </div>

          <div class="task-stack">
            @for (task of archiveResponse().data; track task.id) {
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

          @if (totalArchived() > pageSize()) {
            <div class="pagination-wrap">
              <app-pagination
                [currentPage]="currentPage()"
                [pageSize]="pageSize()"
                [totalItems]="totalArchived()"
                (pageChange)="onPageChange($event)"
              />
            </div>
          }
        }
      </section>
    </app-personal-task-workspace>

    <app-confirm-dialog
      [open]="deleteConfirmOpen()"
      title="Delete completed task?"
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

    <app-confirm-dialog
      [open]="clearConfirmOpen()"
      title="Clear completed tasks?"
      [description]="clearDescription()"
      confirmLabel="Clear completed"
      cancelLabel="Keep your history"
      [loading]="clearingTask()"
      loadingLabel="Clearing..."
      [danger]="true"
      (confirm)="clearCompletedNow()"
      (cancel)="closeClearConfirm()"
      (close)="closeClearConfirm()"
    >
      <div confirm-icon class="confirm-icon-wrap" aria-hidden="true">
        <div class="confirm-icon-disc">
          <fa-icon [icon]="faTrash"></fa-icon>
        </div>
      </div>
    </app-confirm-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        padding: 1rem 0 2rem;
      }

      .clear-completed {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        min-height: 2.5rem;
        padding: 0 0.85rem;
        border: 1px solid var(--outline-variant);
        border-radius: 0.75rem;
        background: var(--surface-card);
        color: var(--on-surface);
        font: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
      }

      .clear-completed:hover {
        background: var(--error-soft);
        border-color: var(--status-overdue);
      }

      .clear-completed:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
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

      .task-stack {
        border-radius: 1.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 1.25rem;
        display: grid;
        gap: 0.85rem;
        margin-bottom: 2rem;
      }

      .pagination-wrap {
        display: flex;
        justify-content: center;
      }
    `,
  ],
})
export class ArchivePageComponent {
  protected readonly taskService = inject(TaskService);
  private readonly logService = inject(LogService);
  protected readonly faTrash = faTrash;
  protected readonly faBoxArchive = faBoxArchive;
  protected readonly deletingTask = signal(false);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly archiveError = signal<string | null>(null);
  protected readonly taskPendingDelete = signal<{
    id: string;
    title: string;
  } | null>(null);
  protected readonly clearConfirmOpen = signal(false);
  protected readonly clearingTask = signal(false);

  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal<10 | 25>(10);
  protected readonly loadingArchive = signal(false);

  protected readonly archiveResponse = toSignal(
    combineLatest([
      toObservable(this.currentPage),
      toObservable(this.pageSize),
      toObservable(this.taskService.version),
    ]).pipe(
      switchMap(([page, size]) => {
        this.loadingArchive.set(true);
        this.archiveError.set(null);
        return this.taskService.getArchivedTasks(page, size).pipe(
          tap((response) => {
            // If the requested page is empty but there are archived tasks,
            // clamp currentPage so the user isn't stranded on a page that no longer exists.
            // The combineLatest re-emission will trigger the refetch.
            if (response.data.length === 0 && response.meta.total > 0) {
              const lastPage = Math.max(1, Math.ceil(response.meta.total / size));
              if (page > lastPage) {
                this.currentPage.set(lastPage);
              }
            }
          }),
          catchError((error: unknown) => {
            this.logService.error('Failed to load completed tasks', error, 'ArchivePage');
            this.archiveError.set('Could not load completed tasks right now.');
            return of({
              data: [],
              meta: {
                total: 0,
                page,
                pageSize: size,
                totalPages: 0,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            } as PaginatedResponse<Task[]>);
          }),
          finalize(() => {
            this.loadingArchive.set(false);
          }),
        );
      }),
    ),
    {
      initialValue: {
        data: [],
        meta: {
          total: 0,
          page: 1,
          pageSize: 10,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      } as PaginatedResponse<Task[]>,
    },
  );

  protected readonly totalArchived = computed(() => this.archiveResponse().meta.total);

  onPageChange(page: number) {
    this.currentPage.set(page);
  }

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

  requestClearCompleted() {
    this.clearConfirmOpen.set(true);
  }

  closeClearConfirm() {
    this.clearConfirmOpen.set(false);
  }

  clearDescription() {
    return (
      'This removes your completed tasks now instead of waiting for the 30-day ' +
      'auto-clear. Tasks marked “Keep forever” are not touched.'
    );
  }

  async clearCompletedNow() {
    this.clearingTask.set(true);
    try {
      await this.taskService.clearCompletedTasks();
      this.closeClearConfirm();
      this.currentPage.set(1);
    } catch (error) {
      this.logService.error('Failed to clear completed tasks', error, 'ArchivePage');
      this.archiveError.set('Could not clear completed tasks right now.');
    } finally {
      this.clearingTask.set(false);
    }
  }

  deleteDescription() {
    const task = this.taskPendingDelete();
    return task
      ? `This will permanently remove ${task.title} from your completed tasks.`
      : 'This will permanently remove the selected task from your completed tasks.';
  }
}
