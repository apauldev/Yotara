import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import type { Task } from '@yotara/shared';
import { CalendarTaskChipComponent } from '../calendar-task-chip/calendar-task-chip.component';
import { CalendarTaskMetaComponent } from '../calendar-task-meta/calendar-task-meta.component';
import { fadeCollapse } from '../../../../shared/animations/fade-collapse.animation';

@Component({
  selector: 'app-calendar-day-panel',
  standalone: true,
  imports: [FontAwesomeModule, CalendarTaskChipComponent, CalendarTaskMetaComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeCollapse],
  template: `
    <div class="cal-panel">
      <header class="cal-panel-head">
        <h2 class="cal-panel-title">{{ dateLabel }}</h2>
        <span class="cal-panel-count">{{ countLabel }}</span>
      </header>

      @if (tasks.length > 0) {
        <ul class="cal-panel-list">
          @for (task of tasks; track task.id) {
            <li class="cal-panel-item">
              <app-calendar-task-chip
                @fadeCollapse
                [task]="task"
                [overdue]="isOverdue(task)"
                [completed]="completionIds.has(task.id) || task.completed"
                (select)="openTask.emit($event)"
                (complete)="completeTask.emit($event)"
              />
              @if (showMetadata) {
                <app-calendar-task-meta
                  [task]="task"
                  [projectName]="projectNameFor(task)"
                  [projectAccent]="accentFor(task)"
                  [labelNames]="labelNamesFor(task)"
                />
              }
            </li>
          }
        </ul>
      } @else {
        <p class="cal-panel-empty">Nothing due on this day.</p>
      }

      <button type="button" class="cal-panel-add" (click)="addTask.emit()">
        <fa-icon [icon]="faPlus" aria-hidden="true" />
        Add task for this date
      </button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .cal-panel {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.9rem;
        border-radius: 1rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .cal-panel-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .cal-panel-title {
        margin: 0;
        font-size: 1rem;
        color: var(--on-surface);
      }

      .cal-panel-count {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 800;
        color: var(--on-surface-subtle);
      }

      .cal-panel-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
      }

      .cal-panel-item {
        display: grid;
        gap: 0.25rem;
      }

      .cal-panel-empty {
        margin: 0;
        color: var(--on-surface-muted);
        font-size: 0.85rem;
      }

      .cal-panel-add {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        min-height: 2.4rem;
        padding: 0 0.9rem;
        border: 0;
        border-radius: 0.7rem;
        background: var(--surface-container-low);
        color: var(--on-surface);
        font-weight: 700;
        cursor: pointer;
      }

      .cal-panel-add:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 2px;
      }
    `,
  ],
})
export class CalendarDayPanelComponent {
  @Input() dateLabel = '';
  @Input() tasks: Task[] = [];
  @Input() accentByProject: Map<string, string> = new Map();
  @Input() completionIds: ReadonlySet<string> = new Set<string>();
  @Input() todayKey = '';
  @Input() projectNames: Map<string, string> = new Map();
  @Input() labelNames: Map<string, string> = new Map();
  @Input() showMetadata = false;
  @Output() readonly openTask = new EventEmitter<Task>();
  @Output() readonly completeTask = new EventEmitter<Task>();
  @Output() readonly addTask = new EventEmitter<void>();

  protected readonly faPlus = faPlus;

  protected get countLabel(): string {
    const count = this.tasks.length;
    return `${count} ${count === 1 ? 'task' : 'tasks'}`;
  }

  protected accentFor(task: Task): string | null {
    return task.projectId ? (this.accentByProject.get(task.projectId) ?? null) : null;
  }

  protected projectNameFor(task: Task): string | null {
    return task.projectId ? (this.projectNames.get(task.projectId) ?? null) : null;
  }

  protected labelNamesFor(task: Task): string[] {
    return (task.labels ?? [])
      .map((id) => this.labelNames.get(id))
      .filter((name): name is string => !!name);
  }

  protected isOverdue(task: Task): boolean {
    return !!task.dueDate && task.dueDate.slice(0, 10) < this.todayKey && !task.completed;
  }
}
