import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Task, TaskBucket } from '@yotara/shared';

@Component({
  selector: 'app-personal-task-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article
      class="task-card"
      [class.task-card-overdue]="tone === 'overdue'"
      [class.task-card-complete]="task.completed"
      [class.task-card-interactive]="interactive"
      (click)="select.emit()"
    >
      <div class="task-check" [class.task-check-complete]="task.completed" aria-hidden="true">
        @if (task.completed) {
          <span>✓</span>
        }
      </div>

      <div class="task-copy">
        <div class="task-title-row">
          <h3>{{ task.title }}</h3>
          <span class="priority-chip priority-chip-{{ task.priority }}">{{ priorityLabel() }}</span>
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
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(235, 228, 212, 0.9);
        box-shadow: 0 14px 30px rgba(105, 97, 74, 0.06);
        padding: 1.15rem 1.2rem;
      }

      .task-card-overdue {
        border-left: 4px solid #dd8b4c;
      }

      .task-card-interactive {
        cursor: pointer;
      }

      .task-card-complete {
        background: rgba(252, 250, 243, 0.76);
        box-shadow: none;
        opacity: 0.76;
      }

      .task-check {
        width: 1.1rem;
        height: 1.1rem;
        border-radius: 0.22rem;
        border: 1.5px solid #b9c2bb;
        margin-top: 0.22rem;
        display: grid;
        place-items: center;
        color: #f9faf6;
        font-size: 0.72rem;
        font-weight: 700;
        background: #ffffff;
      }

      .task-check-complete {
        background: #84a4f6;
        border-color: #84a4f6;
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

      h3 {
        margin: 0;
        font-size: 1.18rem;
        line-height: 1.3;
        letter-spacing: -0.03em;
        color: #262a24;
      }

      .task-card-complete h3 {
        text-decoration: line-through;
      }

      .task-description {
        margin: 0.45rem 0 0;
        color: #827b6f;
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
        background: #f2eee3;
        color: #7a7468;
      }

      .meta-pill-muted {
        background: #f5f2ea;
        color: #92897b;
      }

      .meta-pill-complete {
        background: #dff0e3;
        color: #3d7b59;
      }

      .meta-pill-bucket {
        background: #dff0e6;
        color: #41785a;
      }

      .meta-pill-simple {
        background: #edf0f5;
        color: #6d7690;
      }

      .priority-chip-high {
        background: #f9e5de;
        color: #cc764b;
      }

      .priority-chip-medium {
        background: #f6edd8;
        color: #b28734;
      }

      .priority-chip-low {
        background: #e0efe2;
        color: #508164;
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
}
