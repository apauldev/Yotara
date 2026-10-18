import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faRotate, faTag } from '@fortawesome/free-solid-svg-icons';
import type { Task } from '@yotara/shared';
import { formatTimeLabel } from '../../../../shared/utils/timestamps';

@Component({
  selector: 'app-calendar-task-chip',
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div
      class="cal-chip"
      [class.cal-chip-overdue]="overdue"
      [class.cal-chip-completed]="completed"
      [class.cal-chip-priority-high]="task.priority === 'high'"
      [class.cal-chip-priority-medium]="task.priority === 'medium'"
      [class.cal-chip-priority-low]="task.priority === 'low'"
      [class.cal-chip-touch]="touchTargets"
    >
      @if (showCheck) {
        <button
          type="button"
          class="cal-chip-check"
          [class.cal-chip-check-done]="completed"
          [attr.aria-label]="
            completed
              ? 'Mark ' + task.title + ' as not complete'
              : 'Mark ' + task.title + ' as complete'
          "
          (click)="complete.emit(task)"
        >
          <span class="cal-chip-check-box" aria-hidden="true">
            @if (completed) {
              <span class="cal-chip-check-mark"></span>
            }
          </span>
        </button>
      }

      <button
        type="button"
        class="cal-chip-body"
        [attr.title]="task.title"
        [attr.aria-label]="bodyLabel"
        (click)="select.emit(task)"
      >
        <span class="cal-chip-bar cal-chip-bar-{{ task.priority }}" aria-hidden="true"></span>
        <span class="cal-chip-label">{{ task.title }}</span>
        @if (showTime && timeLabel) {
          <span class="cal-chip-time">{{ timeLabel }}</span>
        }
        @if (showMeta && labelCount > 0) {
          <span class="cal-chip-labels">
            <fa-icon [icon]="faTag" aria-hidden="true" />
            {{ labelCount }}
          </span>
        }
        @if (task.recurrenceRule) {
          <fa-icon class="cal-chip-recur" [icon]="faRotate" aria-hidden="true" />
        }
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .cal-chip {
        width: 100%;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.12rem 0.35rem 0.12rem 0.15rem;
        border-radius: 0.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        color: var(--on-surface);
        font-size: 0.72rem;
      }

      .cal-chip:hover {
        background: var(--surface-container-high);
      }

      .cal-chip-overdue {
        box-shadow: inset 0 0 0 1px var(--status-overdue);
      }

      .cal-chip-completed {
        opacity: 0.72;
      }

      .cal-chip-completed .cal-chip-label {
        color: var(--on-surface-subtle);
        text-decoration: line-through;
      }

      .cal-chip-check {
        flex: 0 0 auto;
        display: grid;
        place-items: center;
        width: 1.4rem;
        height: 1.4rem;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
      }

      .cal-chip-check-box {
        width: 0.85rem;
        height: 0.85rem;
        border-radius: 0.2rem;
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        background: var(--surface-container-lowest);
        display: grid;
        place-items: center;
        transition:
          background-color 120ms ease,
          box-shadow 120ms ease;
      }

      .cal-chip-check-done .cal-chip-check-box {
        background: var(--primary-solid);
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, hsl(var(--primary-foreground)) 18%, transparent);
      }

      .cal-chip-check-mark {
        width: 0.25rem;
        height: 0.45rem;
        border-right: 2px solid hsl(var(--primary-foreground));
        border-bottom: 2px solid hsl(var(--primary-foreground));
        transform: translateY(-0.05rem) rotate(45deg);
      }

      .cal-chip-body {
        flex: 1 1 auto;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.1rem 0;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .cal-chip-bar {
        flex: 0 0 auto;
        width: 3px;
        align-self: stretch;
        border-radius: 3px;
        background: var(--on-surface-subtle);
      }

      .cal-chip-bar-high {
        background: var(--priority-high);
      }

      .cal-chip-bar-medium {
        background: var(--priority-medium);
      }

      .cal-chip-bar-low {
        background: var(--priority-low);
      }

      .cal-chip-label {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .cal-chip-time {
        flex: 0 0 auto;
        color: var(--on-surface-subtle);
        font-weight: 700;
      }

      .cal-chip-recur {
        flex: 0 0 auto;
        color: var(--on-surface-subtle);
        font-size: 0.62rem;
      }

      .cal-chip-labels {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 0.15rem;
        color: var(--on-surface-subtle);
        font-weight: 700;
      }

      .cal-chip-labels fa-icon {
        font-size: 0.58rem;
      }

      .cal-chip-check:focus-visible,
      .cal-chip-body:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      @media (max-width: 720px) {
        .cal-chip-bar {
          display: none;
        }

        .cal-chip-priority-high {
          background: color-mix(in srgb, var(--danger-soft) 65%, var(--surface-card));
        }

        .cal-chip-priority-medium {
          background: color-mix(in srgb, var(--warning-soft) 65%, var(--surface-card));
        }

        .cal-chip-priority-low {
          background: color-mix(in srgb, var(--primary-soft) 65%, var(--surface-card));
        }
      }

      .cal-chip-touch .cal-chip-check {
        width: 2.4rem;
        height: 2.4rem;
      }

      .cal-chip-touch .cal-chip-check-box {
        width: 1.15rem;
        height: 1.15rem;
      }
    `,
  ],
})
export class CalendarTaskChipComponent {
  @Input({ required: true }) task!: Task;
  @Input() overdue = false;
  @Input() completed = false;
  @Input() showMeta = false;
  @Input() labelCount = 0;
  @Input() touchTargets = false;
  @Input() showCheck = true;
  @Input() showTime = true;
  @Output() readonly select = new EventEmitter<Task>();
  @Output() readonly complete = new EventEmitter<Task>();

  protected readonly faRotate = faRotate;
  protected readonly faTag = faTag;

  protected get timeLabel(): string {
    return formatTimeLabel(this.task.dueTime);
  }

  protected get bodyLabel(): string {
    const parts = [this.task.title];
    if (this.timeLabel) {
      parts.push(this.timeLabel);
    }
    parts.push(`${this.task.priority} priority`);
    if (this.showMeta && this.labelCount > 0) {
      parts.push(`${this.labelCount} labels`);
    }
    return parts.join(', ');
  }
}
