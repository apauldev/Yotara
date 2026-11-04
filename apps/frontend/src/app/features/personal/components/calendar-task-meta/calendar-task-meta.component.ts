import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFlag } from '@fortawesome/free-solid-svg-icons';
import type { Task } from '@yotara/shared';

/**
 * The full metadata line for a calendar task: priority, project, and labels.
 * Always rendered in the right-hand panels, where there is room for detail.
 */
@Component({
  selector: 'app-calendar-task-meta',
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="cal-meta">
      <span
        class="priority-chip priority-chip-{{ task.priority }}"
        role="img"
        [attr.aria-label]="priorityLabel"
        [attr.title]="priorityLabel"
      >
        <fa-icon [icon]="faFlag" />
      </span>

      @if (projectName) {
        <span class="project-inline">
          <span class="project-dot" [style.background]="projectAccent" aria-hidden="true"></span>
          <span class="project-name">{{ projectName }}</span>
        </span>
      }

      @for (label of labelNames; track label) {
        <span class="meta-pill meta-pill-label">{{ label }}</span>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .cal-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem;
        padding-left: 1.65rem;
      }

      .meta-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        border-radius: 999px;
        padding: 0.1rem 0.4rem;
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
      }

      .meta-pill-label {
        background: var(--accent-soft);
        color: var(--accent-strong);
      }

      .project-inline {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        max-width: 12rem;
        color: var(--on-surface-muted);
        font-size: 0.72rem;
        font-weight: 600;
      }

      .project-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .project-dot {
        width: 0.45rem;
        height: 0.45rem;
        flex: 0 0 auto;
        border-radius: 999px;
        background: var(--on-surface-subtle);
      }

      .priority-chip {
        display: inline-flex;
        align-items: center;
        padding: 0;
        background: transparent;
        font-size: 0.75rem;
        line-height: 1;
      }

      .priority-chip-high {
        color: var(--priority-high);
      }

      .priority-chip-medium {
        color: var(--priority-medium);
      }

      .priority-chip-low {
        color: var(--priority-low);
      }
    `,
  ],
})
export class CalendarTaskMetaComponent {
  @Input({ required: true }) task!: Task;
  @Input() projectName: string | null = null;
  @Input() projectAccent: string | null = null;
  @Input() labelNames: string[] = [];

  protected readonly faFlag = faFlag;

  protected get priorityLabel(): string {
    const priority = this.task.priority;
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }
}
