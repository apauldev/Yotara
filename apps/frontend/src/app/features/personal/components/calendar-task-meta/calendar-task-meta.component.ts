import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import type { Task } from '@yotara/shared';

/**
 * The full metadata line for a calendar task: priority, project, and labels.
 * Always rendered in the right-hand panels, where there is room for detail.
 */
@Component({
  selector: 'app-calendar-task-meta',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="cal-meta">
      <span class="meta-pill priority-chip-{{ task.priority }}">{{ priorityLabel }}</span>

      @if (projectName) {
        <span class="meta-pill meta-pill-project">
          <span class="project-dot" [style.background]="projectAccent" aria-hidden="true"></span>
          {{ projectName }}
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

      .meta-pill-project {
        color: var(--on-surface);
      }

      .meta-pill-label {
        background: var(--accent-soft);
        color: var(--accent-strong);
      }

      .project-dot {
        width: 0.45rem;
        height: 0.45rem;
        flex: 0 0 auto;
        border-radius: 999px;
        background: var(--on-surface-subtle);
      }

      .priority-chip-high {
        background: var(--danger-soft);
        color: color-mix(in srgb, var(--priority-high) 75%, var(--on-surface));
      }

      .priority-chip-medium {
        background: var(--warning-soft);
        color: color-mix(in srgb, var(--priority-medium) 50%, var(--on-surface));
      }

      .priority-chip-low {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }
    `,
  ],
})
export class CalendarTaskMetaComponent {
  @Input({ required: true }) task!: Task;
  @Input() projectName: string | null = null;
  @Input() projectAccent: string | null = null;
  @Input() labelNames: string[] = [];

  protected get priorityLabel(): string {
    const priority = this.task.priority;
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }
}
