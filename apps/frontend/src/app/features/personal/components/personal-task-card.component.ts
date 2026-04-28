import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Task, TaskBucket } from '@yotara/shared';
import { TaskService } from '../../../core/services/task.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-personal-task-card',
  standalone: true,
  imports: [CommonModule, ConfirmDialogComponent],
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
          <span class="priority-chip priority-chip-{{ task.priority }}">{{ priorityLabel() }}</span>
          @if (task.completed) {
            <span class="completion-chip completion-chip-complete">Completed</span>
          }
        </div>

        @if (showDescription && task.description) {
          <p class="task-description">{{ task.description }}</p>
        }

        <div class="task-meta">
          @if (task.bucket) {
            <span class="meta-pill meta-pill-bucket">{{ bucketLabel() }}</span>
          }

          @if (task.dueDate) {
            <span class="meta-pill">
              {{ dateLabel() }}
            </span>
          }

          <span class="meta-pill meta-pill-muted">{{ statusLabel() }}</span>

          @if (task.simpleMode) {
            <span class="meta-pill meta-pill-simple">Simple mode</span>
          }

          @if (showCompletionState && task.completed) {
            <span class="meta-pill meta-pill-complete">Done</span>
          }
        </div>
      </div>
    </article>

    <app-confirm-dialog
      [open]="completeConfirmOpen()"
      [title]="task.completed ? 'Move task back to doing?' : 'Complete task?'"
      [description]="
        task.completed
          ? 'This will return the task to your active work list.'
          : 'This will move the task into completed and archive it for 30 days.'
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
        gap: 1rem;
        border-radius: 1.3rem;
        background: var(--surface-card);
        box-shadow:
          0 14px 30px var(--surface-dim),
          inset 0 0 0 1px var(--outline-variant);
        padding: 1.15rem 1.2rem;
      }

      .task-card-overdue {
        box-shadow:
          0 14px 30px var(--surface-dim),
          inset 0 0 0 1px var(--outline-variant),
          inset 4px 0 0 0 #dd8b4c;
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
        margin-top: 0.18rem;
        background: transparent;
        cursor: pointer;
        display: grid;
        place-items: center;
      }

      .task-check-box {
        width: 1.02rem;
        height: 1.02rem;
        border-radius: 0.28rem;
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
        background: #84a4f6;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
      }

      .task-check-mark {
        width: 0.34rem;
        height: 0.62rem;
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
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .completion-chip {
        margin-left: auto;
        border-radius: 999px;
        padding: 0.18rem 0.55rem;
        font-size: 0.69rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .completion-chip-complete {
        background: #dff0e3;
        color: #3d7b59;
      }

      h3 {
        margin: 0;
        font-size: 1.18rem;
        line-height: 1.3;
        letter-spacing: -0.03em;
        color: var(--on-surface);
      }

      .task-card-complete h3 {
        text-decoration: line-through;
      }

      .task-description {
        margin: 0.45rem 0 0;
        color: var(--on-surface-muted);
        font-size: 0.96rem;
        line-height: 1.45;
      }

      .task-meta {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        margin-top: 0.7rem;
      }

      .meta-pill,
      .priority-chip {
        border-radius: 999px;
        padding: 0.18rem 0.55rem;
        font-size: 0.69rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .meta-pill {
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
      }

      .meta-pill-muted {
        background: var(--surface-container-low);
        color: var(--on-surface-subtle);
      }

      .meta-pill-complete {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      .meta-pill-bucket {
        background: var(--accent-soft);
        color: var(--primary-solid);
      }

      .meta-pill-simple {
        background: var(--info-soft);
        color: var(--on-surface-muted);
      }

      .priority-chip-high {
        background: var(--danger-soft);
        color: #cc764b;
      }

      .priority-chip-medium {
        background: var(--warning-soft);
        color: #b28734;
      }

      .priority-chip-low {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      @media (max-width: 720px) {
        .task-card {
          padding: 1rem;
          border-radius: 1rem;
          gap: 0.8rem;
        }

        .task-title-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.45rem;
        }

        .completion-chip {
          margin-left: 0;
        }

        .task-meta {
          gap: 0.35rem;
          margin-top: 0.65rem;
        }

        .meta-pill,
        .priority-chip {
          font-size: 0.64rem;
          padding: 0.16rem 0.5rem;
        }

        h3 {
          font-size: 1.05rem;
        }
      }
    `,
  ],
})
export class PersonalTaskCardComponent {
  private readonly taskService = inject(TaskService);
  protected readonly completeConfirmOpen = signal(false);
  protected readonly completing = signal(false);

  @Input({ required: true }) task!: Task;
  @Input() tone: 'default' | 'overdue' = 'default';
  @Input() showDescription = true;
  @Input() showCompletionState = false;
  @Input() interactive = false;
  @Output() readonly select = new EventEmitter<void>();

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
    const parsed = new Date(this.task.dueDate ?? '');

    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
  }

  protected bucketLabel() {
    const labels: Record<TaskBucket, string> = {
      'personal-sanctuary': 'Personal Sanctuary',
      'deep-work': 'Deep Work',
      home: 'Home',
      health: 'Health',
    };

    return this.task.bucket ? labels[this.task.bucket] : '';
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
