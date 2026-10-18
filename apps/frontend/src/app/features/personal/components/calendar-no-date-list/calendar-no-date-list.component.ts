import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { CalendarTaskChipComponent } from '../calendar-task-chip/calendar-task-chip.component';
import { CalendarTaskMetaComponent } from '../calendar-task-meta/calendar-task-meta.component';

export interface CalendarScheduleRequest {
  task: Task;
  date: string;
}

@Component({
  selector: 'app-calendar-no-date-list',
  standalone: true,
  imports: [DatePickerComponent, CalendarTaskChipComponent, CalendarTaskMetaComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="cal-panel">
      <header class="cal-panel-head">
        <h2 class="cal-panel-title">No date</h2>
        <span class="cal-panel-count">{{ countLabel }}</span>
      </header>

      @if (tasks.length > 0) {
        <ul class="cal-panel-list">
          @for (task of tasks; track task.id) {
            <li class="cal-nodate-row">
              <app-calendar-task-chip
                [task]="task"
                [completed]="completionIds.has(task.id)"
                [touchTargets]="touchTargets"
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

              <div class="cal-quick">
                <button type="button" class="cal-quick-btn" (click)="schedule(task, todayKey)">
                  Today
                </button>
                <button type="button" class="cal-quick-btn" (click)="schedule(task, tomorrowKey)">
                  Tomorrow
                </button>
                <app-date-picker
                  class="cal-quick-picker"
                  label="Pick a date"
                  [value]="''"
                  (valueChange)="onDatePicked(task, $event)"
                />
              </div>
            </li>
          }
        </ul>
      } @else {
        <p class="cal-panel-empty">Everything has a date.</p>
      }
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

      .cal-nodate-row {
        display: grid;
        gap: 0.25rem;
      }

      .cal-quick {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        min-width: 0;
      }

      .cal-quick-btn {
        flex: 0 0 auto;
        min-height: 1.9rem;
        padding: 0 0.55rem;
        border: 0;
        border-radius: 0.55rem;
        background: var(--surface-container-low);
        color: var(--on-surface);
        font-size: 0.72rem;
        font-weight: 700;
        cursor: pointer;
      }

      .cal-quick-btn:hover {
        background: var(--surface-container-high);
      }

      .cal-quick-picker {
        flex: 1 1 7rem;
        min-width: 0;
      }

      /* Compact the shared picker trigger for the in-row quick-date action. */
      .cal-quick-picker ::ng-deep .date-picker-trigger {
        min-height: 1.9rem;
        gap: 0.4rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.55rem;
      }

      .cal-quick-picker ::ng-deep .date-picker-label {
        display: none;
      }

      .cal-quick-picker ::ng-deep .date-picker-value {
        font-size: 0.72rem;
      }

      .cal-quick-picker ::ng-deep .date-picker-trigger fa-icon {
        font-size: 0.78rem;
      }

      .cal-panel-empty {
        margin: 0;
        color: var(--on-surface-muted);
        font-size: 0.85rem;
      }

      .cal-quick-btn:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }
    `,
  ],
})
export class CalendarNoDateListComponent {
  @Input() tasks: Task[] = [];
  @Input() accentByProject: Map<string, string> = new Map();
  @Input() completionIds: ReadonlySet<string> = new Set<string>();
  @Input() todayKey = '';
  @Input() projectNames: Map<string, string> = new Map();
  @Input() labelNames: Map<string, string> = new Map();
  @Input() showMetadata = false;
  @Input() touchTargets = false;
  @Output() readonly openTask = new EventEmitter<Task>();
  @Output() readonly completeTask = new EventEmitter<Task>();
  @Output() readonly scheduleTask = new EventEmitter<CalendarScheduleRequest>();

  protected get countLabel(): string {
    const count = this.tasks.length;
    return `${count} ${count === 1 ? 'task' : 'tasks'}`;
  }

  protected get tomorrowKey(): string {
    const today = DateTime.fromISO(this.todayKey);
    return today.isValid ? (today.plus({ days: 1 }).toISODate() ?? '') : '';
  }

  protected schedule(task: Task, date: string): void {
    if (!date) {
      return;
    }

    this.scheduleTask.emit({ task, date });
  }

  protected onDatePicked(task: Task, date: string): void {
    this.schedule(task, date);
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
}
