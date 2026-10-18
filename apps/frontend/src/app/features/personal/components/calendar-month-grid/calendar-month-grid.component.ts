import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import type { Task } from '@yotara/shared';
import { DateTime } from 'luxon';
import { CalendarCell } from '../../utils/calendar-view';
import { CalendarTaskChipComponent } from '../calendar-task-chip/calendar-task-chip.component';
import { fadeCollapse } from '../../../../shared/animations/fade-collapse.animation';

const MAX_VISIBLE_TASKS = 3;

@Component({
  selector: 'app-calendar-month-grid',
  standalone: true,
  imports: [CalendarTaskChipComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeCollapse],
  template: `
    <div class="cal-grid" role="grid">
      <div class="cal-weekdays" aria-hidden="true">
        @for (weekday of weekdays; track weekday) {
          <span>{{ weekday }}</span>
        }
      </div>

      <div class="cal-days">
        @for (cell of cells; track cell.key) {
          <div
            class="cal-cell"
            [class.cal-cell-outside]="!cell.inMonth"
            [class.cal-cell-today]="cell.isToday"
            [class.cal-cell-selected]="cell.key === selectedKey"
            role="gridcell"
            (click)="onCellClick(cell, $event)"
          >
            <button
              type="button"
              class="cal-cell-head"
              [attr.aria-current]="cell.isToday ? 'date' : null"
              [attr.aria-pressed]="cell.key === selectedKey"
              (click)="selectDate.emit(cell.date)"
            >
              <span class="cal-day-number">{{ cell.date.day }}</span>
            </button>

            <div class="cal-cell-tasks">
              @for (task of visibleTasks(cell); track task.id) {
                <app-calendar-task-chip
                  @fadeCollapse
                  [task]="task"
                  [overdue]="isOverdue(task)"
                  [completed]="completionIds.has(task.id) || task.completed"
                  [showMeta]="showMetadata"
                  [labelCount]="task.labels?.length ?? 0"
                  [showCheck]="showCheck"
                  (select)="openTask.emit($event)"
                  (complete)="completeTask.emit($event)"
                />
              }
              @if (cell.tasks.length > maxVisible) {
                <button type="button" class="cal-more" (click)="selectDate.emit(cell.date)">
                  +{{ cell.tasks.length - maxVisible }} more
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .cal-weekdays,
      .cal-days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
      }

      .cal-weekdays span {
        padding: 0.3rem 0.4rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.68rem;
        font-weight: 800;
        color: var(--on-surface-subtle);
      }

      .cal-days {
        gap: 0.3rem;
      }

      .cal-cell {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-height: 6.5rem;
        padding: 0.25rem;
        border-radius: 0.7rem;
        background: var(--surface-container-lowest);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .cal-cell-outside {
        opacity: 0.55;
      }

      .cal-cell-today {
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--primary-solid) 35%, var(--outline-variant));
      }

      .cal-cell-selected {
        box-shadow: inset 0 0 0 2px var(--primary-solid);
      }

      .cal-cell-head {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.6rem;
        min-height: 1.6rem;
        padding: 0 0.3rem;
        border: 0;
        border-radius: 0.5rem;
        background: transparent;
        color: var(--on-surface);
        font-weight: 800;
        font-size: 0.78rem;
        cursor: pointer;
      }

      .cal-cell-today .cal-cell-head {
        background: color-mix(in srgb, var(--primary-soft) 70%, transparent);
      }

      .cal-cell-selected .cal-cell-head {
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
      }

      .cal-cell-head:focus-visible,
      .cal-more:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      .cal-cell-tasks {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
      }

      .cal-more {
        align-self: flex-start;
        border: 0;
        background: transparent;
        color: var(--on-surface-muted);
        font-size: 0.68rem;
        font-weight: 700;
        padding: 0.1rem 0.2rem;
        cursor: pointer;
      }

      @media (width <= 900px) {
        .cal-cell {
          min-height: 4.5rem;
        }
      }
    `,
  ],
})
export class CalendarMonthGridComponent {
  @Input({ required: true }) cells: CalendarCell[] = [];
  @Input() selectedKey = '';
  @Input() completionIds: ReadonlySet<string> = new Set<string>();
  @Input() todayKey = '';
  @Input() showMetadata = false;
  @Input() showCheck = true;
  @Output() readonly selectDate = new EventEmitter<DateTime>();
  @Output() readonly openTask = new EventEmitter<Task>();
  @Output() readonly completeTask = new EventEmitter<Task>();

  protected readonly weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  protected readonly maxVisible = MAX_VISIBLE_TASKS;

  protected visibleTasks(cell: CalendarCell): Task[] {
    return cell.tasks.slice(0, this.maxVisible);
  }

  /**
   * Clicking a cell's empty space selects the day, matching the day-number
   * button and the "+N more" affordance. Creating a task is an explicit action
   * — "Add task for this date" in the day panel, or "New task" in the header —
   * so browsing days never opens the editor. Clicks on a task chip (including
   * its padding) are left to the chip's own controls.
   */
  protected onCellClick(cell: CalendarCell, event: MouseEvent): void {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('app-calendar-task-chip, button, a, input, [role="button"]')
    ) {
      return;
    }

    this.selectDate.emit(cell.date);
  }

  protected isOverdue(task: Task): boolean {
    return !!task.dueDate && task.dueDate.slice(0, 10) < this.todayKey && !task.completed;
  }
}
