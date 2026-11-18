import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faRotateLeft, faTrash } from '@fortawesome/free-solid-svg-icons';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { TaskService } from '../../../core/services/task.service';
import { LogService } from '../../../core/services/log.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PaginatedResponse, Task } from '@yotara/shared';

interface TrashGroup {
  deletedAt: string;
  tasks: Task[];
  projectName?: string;
}

@Component({
  selector: 'app-trash-list',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, EmptyStateComponent],
  template: `
    <p class="status-copy">
      Deleted projects and their tasks are removed permanently after 30 days. Restoring one restores
      the whole project with its tasks.
    </p>

    @if (loading()) {
      <p class="status-copy">Loading your trashed tasks...</p>
    } @else if (loadError()) {
      <p class="status-copy">{{ loadError() }}</p>
    } @else if (groups().length === 0) {
      <app-empty-state
        title="Trash is empty"
        description="Tasks deleted with a project appear here and can be restored within 30 days."
        [icon]="faTrash"
      />
    } @else {
      @if (restoreError()) {
        <p class="status-copy restore-error" role="alert">{{ restoreError() }}</p>
      }

      @for (group of groups(); track group.deletedAt) {
        <section class="trash-group" [attr.aria-label]="groupLabel(group)">
          <header class="trash-group-header">
            <div class="trash-group-summary">
              <strong>{{ groupLabel(group) }}</strong>
              <span class="trash-meta">Deleted {{ group.deletedAt.slice(0, 10) }}</span>
            </div>
            <button
              type="button"
              class="restore-button"
              [disabled]="restoringGroup() === group.deletedAt"
              [attr.aria-label]="'Restore ' + groupLabel(group)"
              (click)="restoreGroup(group)"
            >
              <fa-icon [icon]="faRotateLeft" aria-hidden="true"></fa-icon>
              <span>{{ restoreButtonLabel(group) }}</span>
            </button>
          </header>

          <ul class="trash-task-list">
            @for (task of group.tasks; track task.id) {
              <li>{{ task.title }}</li>
            }
          </ul>
        </section>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
      }

      .status-copy {
        margin: 0.6rem 0 1rem;
        color: var(--on-surface-muted);
        font-size: 0.95rem;
      }

      .restore-error {
        color: var(--status-overdue);
      }

      .trash-group {
        margin-bottom: 1rem;
        padding: 1.25rem;
        border-radius: 1.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .trash-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .trash-group-summary {
        display: grid;
        gap: 0.2rem;
      }

      .trash-meta {
        color: var(--on-surface-muted);
        font-size: 0.8rem;
      }

      .trash-task-list {
        list-style: none;
        margin: 0.85rem 0 0;
        padding: 0;
        display: grid;
        gap: 0.35rem;
      }

      .trash-task-list li {
        color: var(--on-surface-muted);
        font-size: 0.9rem;
        overflow-wrap: anywhere;
      }

      .trash-task-list li::before {
        content: '•';
        margin-right: 0.5rem;
      }

      .restore-button {
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
        white-space: nowrap;
      }

      .restore-button:hover:not(:disabled) {
        border-color: var(--primary-solid);
        color: var(--primary-solid);
      }

      .restore-button:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      .restore-button:disabled {
        opacity: 0.6;
        cursor: default;
      }
    `,
  ],
})
export class TrashListComponent {
  protected readonly taskService = inject(TaskService);
  private readonly logService = inject(LogService);
  protected readonly faTrash = faTrash;
  protected readonly faRotateLeft = faRotateLeft;

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly restoringGroup = signal<string | null>(null);
  protected readonly restoreError = signal<string | null>(null);

  protected readonly response = toSignal(
    toObservable(this.taskService.version).pipe(
      switchMap(() => {
        this.loading.set(true);
        this.loadError.set(null);
        // Trash is short-lived; fetch it whole so a deletion batch never
        // gets split across pages.
        return this.taskService.getDeletedTasks(1, 3000).pipe(
          catchError((error: unknown) => {
            this.logService.error('Failed to load trashed tasks', error, 'TrashList');
            this.loadError.set('Could not load Trash right now.');
            return of(this.emptyResponse());
          }),
          finalize(() => {
            this.loading.set(false);
          }),
        );
      }),
    ),
    { initialValue: this.emptyResponse() },
  );

  /** Tasks removed by the same project deletion share a deletedAt stamp. */
  protected readonly groups = computed<TrashGroup[]>(() => {
    const byTimestamp = new Map<string, Task[]>();
    for (const task of this.response().data) {
      const key = task.deletedAt ?? 'unknown';
      const group = byTimestamp.get(key);
      if (group) {
        group.push(task);
      } else {
        byTimestamp.set(key, [task]);
      }
    }
    return [...byTimestamp.entries()]
      .map(
        ([deletedAt, tasks]): TrashGroup => ({
          deletedAt,
          tasks,
          projectName: tasks.find((task) => !!task.deletedProjectName)?.deletedProjectName,
        }),
      )
      .sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  });

  private emptyResponse(): PaginatedResponse<Task[]> {
    return {
      data: [],
      meta: {
        total: 0,
        page: 1,
        pageSize: 3000,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  protected groupLabel(group: TrashGroup): string {
    const count = `${group.tasks.length} ${group.tasks.length === 1 ? 'task' : 'tasks'}`;
    return group.projectName ? `${group.projectName} · ${count}` : count;
  }

  protected restoreButtonLabel(group: TrashGroup): string {
    if (group.projectName) {
      return 'Restore project & tasks';
    }
    return group.tasks.length > 1 ? 'Restore tasks' : 'Restore task';
  }

  protected async restoreGroup(group: TrashGroup) {
    if (this.restoringGroup() || group.tasks.length === 0) {
      return;
    }

    this.restoringGroup.set(group.deletedAt);
    this.restoreError.set(null);
    try {
      // The API restores the whole batch identified by this deletion stamp.
      await this.taskService.restoreTask(group.tasks[0].id);
    } catch {
      this.restoreError.set('Could not restore these tasks. Please try again.');
    } finally {
      this.restoringGroup.set(null);
    }
  }
}
