import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Task } from '@yotara/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBoxArchive, faRotateLeft, faTrash } from '@fortawesome/free-solid-svg-icons';
import { LabelService } from '../../../core/services/label.service';
import { TaskService } from '../../../core/services/task.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { parseCalendarDate } from '../../../shared/utils/timestamps';

@Component({
  selector: 'app-personal-task-card',
  standalone: true,
  imports: [CommonModule, ConfirmDialogComponent, FontAwesomeModule],
  template: `
    <article
      class="task-card"
      [class.task-card-overdue]="tone === 'overdue'"
      [class.task-card-complete]="task.completed"
      [class.task-card-interactive]="interactive"
      [attr.role]="interactive ? 'button' : null"
      [attr.tabindex]="interactive ? 0 : null"
      [attr.aria-label]="interactive ? 'Open task details for ' + task.title : null"
      (click)="select.emit()"
      (keydown)="onKeydown($event)"
    >
      <button
        type="button"
        class="task-check"
        [class.task-check-complete]="task.completed"
        [attr.aria-label]="task.completed ? 'Task completed' : 'Mark task complete'"
        (click)="requestComplete($event)"
        (keydown)="$event.stopPropagation()"
      >
        <span class="task-check-box" aria-hidden="true">
          @if (task.completed) {
            <span class="task-check-mark"></span>
          }
        </span>
      </button>

      <div class="task-copy">
        <div class="task-title-row">
          <h3>{{ task.title }}</h3>

          <div class="task-badges">
            @if (task.labels?.length) {
              @for (labelId of task.labels?.slice(0, 1) ?? []; track labelId) {
                <span class="meta-pill meta-pill-label">{{ labelName(labelId) }}</span>
              }
            }

            @if (task.dueDate) {
              <span class="meta-pill meta-pill-date">
                {{ dateLabel() }}
              </span>
            }

            <span class="meta-pill meta-pill-muted">{{ statusLabel() }}</span>
            <span class="priority-chip priority-chip-{{ task.priority }}">{{
              priorityLabel()
            }}</span>

            @if (task.bucket) {
              <span class="meta-pill meta-pill-bucket">{{ bucketLabel() }}</span>
            }

            @if (task.simpleMode) {
              <span class="meta-pill meta-pill-simple">Simple mode</span>
            }

            @if (showCompletionState && task.completed) {
              <span class="meta-pill meta-pill-complete">Done</span>
            }
          </div>

          @if (task.completed) {
            <div class="completion-group">
              <span class="completion-chip completion-chip-complete">Completed</span>
              <button
                type="button"
                class="restore-pill"
                (click)="requestComplete($event)"
                (keydown)="$event.stopPropagation()"
                aria-label="Restore task"
              >
                <fa-icon [icon]="faRotateLeft" class="restore-icon"></fa-icon>
                <span>Restore</span>
              </button>

              @if (showArchiveActions) {
                <button
                  type="button"
                  class="restore-pill archive-pill"
                  [class.archive-pill-active]="task.permanentArchive"
                  (click)="$event.stopPropagation(); togglePermanentArchive.emit()"
                  (keydown)="$event.stopPropagation()"
                  [attr.aria-label]="
                    task.permanentArchive
                      ? 'Remove permanent archive tag'
                      : 'Mark permanent archive'
                  "
                >
                  <fa-icon [icon]="faBoxArchive" class="restore-icon"></fa-icon>
                  <span>{{ task.permanentArchive ? 'Permanent archive' : 'Make permanent' }}</span>
                </button>

                <button
                  type="button"
                  class="restore-pill delete-pill"
                  (click)="$event.stopPropagation(); deleteForever.emit()"
                  (keydown)="$event.stopPropagation()"
                  aria-label="Delete task forever"
                >
                  <fa-icon [icon]="faTrash" class="restore-icon"></fa-icon>
                  <span>Delete forever</span>
                </button>
              }
            </div>
          }
        </div>

        @if (showDescription && task.description) {
          <p class="task-description">
            {{
              task.description.length > 120
                ? (task.description | slice: 0 : 120) + '...'
                : task.description
            }}
          </p>
        }
      </div>
    </article>

    <app-confirm-dialog
      [open]="completeConfirmOpen()"
      [title]="task.completed ? 'Move task back to doing?' : 'Complete task?'"
      [description]="
        task.completed
          ? 'This will return the task to your active work list.'
          : 'This will move the task into completed and archive it.'
      "
      [confirmLabel]="task.completed ? 'Put back into doing' : 'Mark complete'"
      cancelLabel="Keep as is"
      [loading]="completing()"
      [loadingLabel]="task.completed ? 'Restoring...' : 'Completing...'"
      (confirm)="completeTask()"
      (cancel)="closeCompleteConfirm()"
      (close)="closeCompleteConfirm()"
    />
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .task-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.8rem;
        border-radius: 0.8rem;
        background: var(--surface-card);
        box-shadow:
          0 2px 8px var(--surface-dim),
          inset 0 0 0 1px var(--outline-variant);
        padding: 0.6rem 0.85rem;
      }

      .task-card-overdue {
        box-shadow:
          0 2px 8px var(--surface-dim),
          inset 0 0 0 1px var(--outline-variant),
          inset 4px 0 0 0 var(--status-overdue);
      }

      .task-card-interactive {
        cursor: pointer;
      }

      .task-card-complete {
        background: color-mix(in srgb, var(--surface-card) 84%, var(--surface-container-low));
        box-shadow: none;
        opacity: 0.76;
      }

      .task-check {
        appearance: none;
        padding: 0;
        width: 1.15rem;
        height: 1.15rem;
        border: 0;
        margin-top: 0.05rem;
        background: transparent;
        cursor: pointer;
        display: grid;
        place-items: center;
      }

      .task-check-box {
        width: 0.95rem;
        height: 0.95rem;
        border-radius: 0.22rem;
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        background: var(--surface-container-lowest);
        display: grid;
        place-items: center;
        transition:
          background-color 120ms ease,
          border-color 120ms ease,
          box-shadow 120ms ease;
      }

      .task-check-complete .task-check-box {
        background: var(--primary-solid);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
      }

      .task-check-mark {
        width: 0.3rem;
        height: 0.55rem;
        border-right: 2px solid #fff;
        border-bottom: 2px solid #fff;
        transform: translateY(-0.05rem) rotate(45deg);
      }

      .task-copy {
        min-width: 0;
      }

      .task-title-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .task-badges {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 0.3rem;
        flex-wrap: wrap;
      }

      .completion-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .completion-chip {
        border-radius: 999px;
        padding: 0.12rem 0.4rem;
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .completion-chip-complete {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      .restore-pill {
        appearance: none;
        border: 0;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        background: var(--primary-soft);
        color: var(--primary-solid);
        border-radius: 999px;
        padding: 0.12rem 0.5rem;
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background-color 120ms ease;
      }

      .restore-pill:hover {
        background: var(--primary-soft-strong);
      }

      .archive-pill {
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
      }

      .archive-pill:hover {
        background: var(--surface-container-high);
      }

      .archive-pill-active {
        color: var(--primary-solid);
      }

      .delete-pill {
        color: var(--status-overdue);
      }

      .delete-pill:hover {
        background: var(--error-soft);
      }

      .restore-icon {
        font-size: 0.68rem;
      }

      h3 {
        margin: 0;
        font-size: 0.98rem;
        line-height: 1.25;
        letter-spacing: -0.015em;
        color: var(--on-surface);
        font-weight: 600;
      }

      .task-card-complete h3 {
        text-decoration: line-through;
      }

      .task-description {
        margin: 0.2rem 0 0;
        color: var(--on-surface-muted);
        font-size: 0.88rem;
        line-height: 1.35;
      }

      .meta-pill,
      .priority-chip {
        border-radius: 999px;
        padding: 0.12rem 0.4rem;
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .meta-pill {
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
      }

      .meta-pill-muted {
        background: var(--surface-container-low);
        color: var(--on-surface-subtle);
      }

      .meta-pill-label {
        background: var(--accent-soft);
        color: var(--accent-strong);
      }

      .meta-pill-date {
        background: var(--surface-container-high);
        color: var(--on-surface);
      }

      .meta-pill-complete {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      .meta-pill-simple {
        background: var(--info-soft);
        color: var(--on-surface-muted);
      }

      .priority-chip-high {
        background: var(--danger-soft);
        color: var(--status-overdue);
      }

      .priority-chip-medium {
        background: var(--warning-soft);
        color: var(--status-pending);
      }

      .priority-chip-low {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      @media (max-width: 720px) {
        .task-card {
          padding: 0.55rem 0.7rem;
          border-radius: 0.7rem;
          gap: 0.6rem;
        }

        .task-title-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.3rem;
        }

        .task-badges {
          margin-left: 0;
          gap: 0.25rem;
        }

        .completion-group {
          margin-top: 0.1rem;
        }

        .meta-pill,
        .priority-chip {
          font-size: 0.58rem;
          padding: 0.1rem 0.35rem;
        }

        h3 {
          font-size: 0.92rem;
        }
      }
    `,
  ],
})
export class PersonalTaskCardComponent {
  private readonly taskService = inject(TaskService);
  private readonly labelService = inject(LabelService);
  protected readonly completeConfirmOpen = signal(false);
  protected readonly completing = signal(false);
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly faBoxArchive = faBoxArchive;
  protected readonly faTrash = faTrash;

  @Input({ required: true }) task!: Task;
  @Input() tone: 'default' | 'overdue' = 'default';
  @Input() showDescription = true;
  @Input() showCompletionState = false;
  @Input() showArchiveActions = false;
  @Input() interactive = false;
  @Output() readonly select = new EventEmitter<void>();
  @Output() readonly togglePermanentArchive = new EventEmitter<void>();
  @Output() readonly deleteForever = new EventEmitter<void>();

  protected priorityLabel() {
    return `${this.task.priority} priority`;
  }

  protected statusLabel() {
    switch (this.task.status) {
      case 'today':
        return 'Today';
      case 'upcoming':
        return 'Upcoming';
      case 'done':
        return 'Complete';
      case 'archived':
        return 'Archived';
      default:
        return 'Inbox';
    }
  }

  protected dateLabel() {
    const parsed = parseCalendarDate(this.task.dueDate);

    if (!parsed) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
  }

  protected labelName(labelId: string) {
    return this.labelService.labels().find((label) => label.id === labelId)?.name ?? labelId;
  }

  protected bucketLabel() {
    switch (this.task.bucket) {
      case 'personal-sanctuary':
        return 'Personal Sanctuary';
      case 'deep-work':
        return 'Deep Work';
      case 'home':
        return 'Home';
      case 'health':
        return 'Health';
      default:
        return this.task.bucket || '';
    }
  }

  requestComplete(event: MouseEvent) {
    event.stopPropagation();
    this.completeConfirmOpen.set(true);
  }

  onKeydown(event: KeyboardEvent) {
    if (!this.interactive) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select.emit();
    }
  }

  closeCompleteConfirm() {
    this.completeConfirmOpen.set(false);
  }

  async completeTask() {
    this.completing.set(true);

    try {
      await this.taskService.updateTask(this.task.id, { completed: !this.task.completed });
      this.completeConfirmOpen.set(false);
    } finally {
      this.completing.set(false);
    }
  }
}
