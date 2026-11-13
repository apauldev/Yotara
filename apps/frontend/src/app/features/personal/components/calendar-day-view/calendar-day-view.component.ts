import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DateTime } from 'luxon';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import type { CalendarEventDto, Task } from '@yotara/shared';
import { buildDayAgenda, type CalendarAgendaEntry } from '../../utils/calendar-view';
import { CalendarEventChipComponent } from '../calendar-event-chip/calendar-event-chip.component';
import { CalendarTaskChipComponent } from '../calendar-task-chip/calendar-task-chip.component';
import { CalendarTaskMetaComponent } from '../calendar-task-meta/calendar-task-meta.component';

type AgendaRow = CalendarAgendaEntry | { kind: 'now'; time: string };

@Component({
  selector: 'app-calendar-day-view',
  standalone: true,
  imports: [
    FontAwesomeModule,
    CalendarEventChipComponent,
    CalendarTaskChipComponent,
    CalendarTaskMetaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="agenda" aria-label="Day agenda">
      <header class="agenda-head">
        <div>
          <h2>{{ dateLabel }}</h2>
          <p>
            {{ tasks.length }} {{ tasks.length === 1 ? 'task' : 'tasks' }} · {{ events.length }}
            {{ events.length === 1 ? 'event' : 'events' }}
          </p>
        </div>
        <button type="button" class="agenda-add" (click)="addTask.emit()">
          <fa-icon [icon]="faPlus" aria-hidden="true" /> Add task for this date
        </button>
      </header>

      <section class="agenda-section" aria-labelledby="all-day-heading">
        <h3 id="all-day-heading">All day</h3>
        @if (allDayEvents.length) {
          <ul class="agenda-list">
            @for (event of allDayEvents; track event.id) {
              <li><app-calendar-event-chip [event]="event" (select)="openEvent.emit($event)" /></li>
            }
          </ul>
        } @else {
          <p class="agenda-muted">No all-day events.</p>
        }
      </section>

      <section class="agenda-section" aria-labelledby="timed-heading">
        <h3 id="timed-heading">Schedule</h3>
        @if (timedRows.length) {
          <ol class="agenda-timeline">
            @for (row of timedRows; track $index) {
              @if (row.kind === 'now') {
                <li class="agenda-now" aria-label="Current time">
                  <span>Now · {{ row.time }}</span>
                </li>
              } @else if (row.kind === 'event') {
                <li class="agenda-row">
                  <time class="agenda-time">{{ row.time }}</time>
                  <div class="agenda-row-content">
                    <app-calendar-event-chip
                      [event]="row.event"
                      (select)="openEvent.emit($event)"
                    /><small>{{ row.event.sourceName }} calendar</small>
                  </div>
                </li>
              } @else {
                <li class="agenda-row">
                  <time class="agenda-time">{{ row.time }}</time>
                  <div class="agenda-row-content">
                    <app-calendar-task-chip
                      [task]="row.task"
                      [completed]="completionOverrides.get(row.task.id) ?? row.task.completed"
                      [touchTargets]="touchTargets"
                      [showTime]="false"
                      (select)="openTask.emit($event)"
                      (complete)="completeTask.emit($event)"
                    />
                    @if (showMetadata) {
                      <app-calendar-task-meta
                        [task]="row.task"
                        [projectName]="projectNames.get(row.task.projectId ?? '') ?? null"
                        [projectAccent]="accentByProject.get(row.task.projectId ?? '') ?? null"
                        [labelNames]="namesFor(row.task)"
                      />
                    }
                  </div>
                </li>
              }
            }
          </ol>
        } @else {
          <p class="agenda-muted">No timed events or tasks.</p>
        }
      </section>

      <section class="agenda-section" aria-labelledby="tasks-heading">
        <h3 id="tasks-heading">Tasks</h3>
        @if (untimedTasks.length) {
          <ul class="agenda-list">
            @for (task of untimedTasks; track task.id) {
              <li>
                <app-calendar-task-chip
                  [task]="task"
                  [completed]="completionOverrides.get(task.id) ?? task.completed"
                  [touchTargets]="touchTargets"
                  (select)="openTask.emit($event)"
                  (complete)="completeTask.emit($event)"
                />
                @if (showMetadata) {
                  <app-calendar-task-meta
                    [task]="task"
                    [projectName]="projectNames.get(task.projectId ?? '') ?? null"
                    [projectAccent]="accentByProject.get(task.projectId ?? '') ?? null"
                    [labelNames]="namesFor(task)"
                  />
                }
              </li>
            }
          </ul>
        } @else if (tasks.length === 0) {
          <p class="agenda-muted">No tasks due.</p>
        } @else {
          <p class="agenda-muted">No untimed tasks.</p>
        }
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .agenda {
        display: grid;
        gap: 1rem;
        padding: 0.9rem;
        border-radius: 1rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }
      .agenda-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .agenda-head h2 {
        margin: 0;
        font-size: 1rem;
      }
      .agenda-head p {
        margin: 0.2rem 0 0;
        color: var(--on-surface-subtle);
        font-size: 0.72rem;
      }
      .agenda-add {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        min-height: 2.2rem;
        padding: 0 0.65rem;
        border: 0;
        border-radius: 0.6rem;
        background: var(--surface-container-low);
        color: var(--on-surface);
        font-weight: 700;
        cursor: pointer;
      }
      .agenda-section {
        display: grid;
        gap: 0.45rem;
      }
      .agenda-section h3 {
        margin: 0;
        color: var(--on-surface-subtle);
        font-size: 0.68rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .agenda-list,
      .agenda-timeline {
        display: grid;
        gap: 0.4rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .agenda-row {
        display: grid;
        grid-template-columns: 3.4rem minmax(0, 1fr);
        gap: 0.55rem;
        align-items: start;
      }
      .agenda-time {
        padding-top: 0.35rem;
        color: var(--on-surface-muted);
        font-size: 0.72rem;
        font-weight: 800;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .agenda-row-content {
        display: grid;
        gap: 0.15rem;
        min-width: 0;
      }
      .agenda-row-content small {
        color: var(--on-surface-subtle);
        font-size: 0.66rem;
      }
      .agenda-muted {
        margin: 0;
        padding: 0.35rem 0;
        color: var(--on-surface-subtle);
        font-size: 0.8rem;
      }
      .agenda-now {
        position: relative;
        grid-column: 1 / -1;
        margin: 0.3rem 0;
        border-top: 1px solid var(--status-overdue);
        color: var(--status-overdue);
        font-size: 0.65rem;
      }
      .agenda-now span {
        position: relative;
        top: -0.7rem;
        display: inline-block;
        padding-right: 0.35rem;
        background: var(--surface-card);
      }
      @media (max-width: 720px) {
        .agenda {
          padding: 0.85rem;
        }
        .agenda-add {
          min-height: 2.5rem;
        }
      }
      @media (max-width: 400px) {
        .agenda-head {
          flex-direction: column;
          align-items: stretch;
        }
        .agenda-add {
          justify-content: center;
        }
      }
    `,
  ],
})
export class CalendarDayViewComponent {
  @Input() dateLabel = '';
  @Input() dateKey = '';
  @Input() todayKey = '';
  @Input() tasks: Task[] = [];
  @Input() events: CalendarEventDto[] = [];
  @Input() accentByProject: ReadonlyMap<string, string> = new Map();
  @Input() projectNames: ReadonlyMap<string, string> = new Map();
  @Input() labelNames: ReadonlyMap<string, string> = new Map();
  @Input() completionOverrides: ReadonlyMap<string, boolean> = new Map();
  @Input() showMetadata = false;
  @Input() touchTargets = false;
  @Output() readonly openTask = new EventEmitter<Task>();
  @Output() readonly completeTask = new EventEmitter<Task>();
  @Output() readonly openEvent = new EventEmitter<CalendarEventDto>();
  @Output() readonly addTask = new EventEmitter<void>();
  protected readonly faPlus = faPlus;

  protected get allDayEvents(): CalendarEventDto[] {
    return this.events.filter((event) => event.allDay);
  }
  protected get untimedTasks(): Task[] {
    return this.tasks.filter((task) => !task.dueTime);
  }
  protected get timedRows(): AgendaRow[] {
    const rows: AgendaRow[] = buildDayAgenda(this.tasks, this.events);
    if (this.dateKey === this.todayKey)
      rows.push({ kind: 'now', time: DateTime.local().toFormat('HH:mm') });
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }
  protected namesFor(task: Task): string[] {
    return (task.labels ?? []).map((id) => this.labelNames.get(id) ?? '').filter(Boolean);
  }
}
