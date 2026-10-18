import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
  inject,
  signal,
} from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import type { Task } from '@yotara/shared';
import { DateTime } from 'luxon';
import { CalendarCell, CalendarRescheduleRequest } from '../../utils/calendar-view';
import { CalendarTaskChipComponent } from '../calendar-task-chip/calendar-task-chip.component';
import { fadeCollapse } from '../../../../shared/animations/fade-collapse.animation';

const MAX_VISIBLE_TASKS = 3;

@Component({
  selector: 'app-calendar-month-grid',
  standalone: true,
  imports: [CalendarTaskChipComponent, DragDropModule, FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeCollapse],
  template: `
    <div class="cal-grid" role="group" aria-label="Calendar month">
      <div class="cal-weekdays" aria-hidden="true">
        @for (weekday of weekdays; track weekday) {
          <span>{{ weekday }}</span>
        }
      </div>

      <div class="cal-days" cdkDropListGroup>
        @for (cell of cells; track cell.key) {
          <div
            class="cal-cell"
            cdkDropList
            [cdkDropListSortingDisabled]="true"
            (cdkDropListDropped)="onDrop($event, cell)"
            [class.cal-cell-outside]="!cell.inMonth"
            [class.cal-cell-today]="cell.isToday"
            [class.cal-cell-selected]="cell.key === selectedKey"
            (click)="onCellClick(cell, $event)"
            (dblclick)="onCellDoubleClick(cell, $event)"
          >
            <div class="cal-cell-head-row">
              <button
                type="button"
                class="cal-cell-head"
                [attr.data-cal-day]="cell.key"
                [attr.tabindex]="cell.key === tabbableKey() ? 0 : -1"
                [attr.aria-current]="cell.isToday ? 'date' : null"
                [attr.aria-pressed]="cell.key === selectedKey"
                [attr.aria-label]="dayAriaLabel(cell)"
                (focus)="onDayFocus(cell)"
                (keydown)="onDayKeydown($event, cell)"
                (click)="selectDate.emit(cell.date)"
              >
                <span class="cal-day-number">{{ cell.date.day }}</span>
              </button>

              @if (allowQuickCreate) {
                <button
                  type="button"
                  class="cal-cell-add"
                  tabindex="-1"
                  [attr.aria-label]="'Add task on ' + cell.date.toFormat('cccc, LLLL d, yyyy')"
                  (click)="onAddClick(cell, $event)"
                >
                  <fa-icon [icon]="faPlus" aria-hidden="true" />
                </button>
              }
            </div>

            @if (compactCounts) {
              @if (cell.tasks.length > 0) {
                <div class="cal-cell-count-wrap">
                  <span class="cal-cell-count">{{ cell.tasks.length }}</span>
                </div>
              }
            } @else {
              <div class="cal-cell-tasks">
                @for (task of visibleTasks(cell); track task.id) {
                  <app-calendar-task-chip
                    cdkDrag
                    [cdkDragData]="task"
                    [cdkDragDisabled]="!canDrag(task)"
                    @fadeCollapse
                    [task]="task"
                    [overdue]="isOverdue(task)"
                    [completed]="completionOverrides.get(task.id) ?? task.completed"
                    [showMeta]="showMetadata"
                    [labelCount]="task.labels?.length ?? 0"
                    [showCheck]="showCheck"
                    (select)="onSelect($event)"
                    (complete)="onComplete($event)"
                  />
                }
                @if (cell.tasks.length > maxVisible) {
                  <button type="button" class="cal-more" (click)="selectDate.emit(cell.date)">
                    +{{ cell.tasks.length - maxVisible }} more
                  </button>
                }
              </div>
            }
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

      .cal-cell.cdk-drop-list-receiving {
        background: var(--surface-container-high);
        box-shadow: inset 0 0 0 2px var(--primary-solid);
      }

      .cal-cell-head-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.25rem;
      }

      .cal-cell-head {
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

      .cal-cell-add {
        display: grid;
        place-items: center;
        width: 1.6rem;
        height: 1.6rem;
        padding: 0;
        border: 0;
        border-radius: 0.5rem;
        background: transparent;
        color: var(--on-surface-subtle);
        font-size: 0.7rem;
        cursor: pointer;
        opacity: 0;
        transition:
          opacity 120ms ease,
          background-color 120ms ease;
      }

      .cal-cell:hover .cal-cell-add,
      .cal-cell:focus-within .cal-cell-add,
      .cal-cell-add:focus-visible {
        opacity: 1;
      }

      .cal-cell-add:hover {
        background: var(--surface-container-high);
        color: var(--on-surface);
      }

      .cal-cell-today .cal-cell-head {
        background: color-mix(in srgb, var(--primary-soft) 70%, transparent);
      }

      .cal-cell-selected .cal-cell-head {
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
      }

      .cal-cell-head:focus-visible,
      .cal-cell-add:focus-visible,
      .cal-more:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      @media (max-width: 720px) {
        .cal-cell-add {
          display: none;
        }
      }

      .cal-cell-tasks {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
      }

      /*
       * On phones the seven columns are too narrow for task chips, so the
       * compact view shows only how many tasks fall on each day.
       */
      .cal-cell-count-wrap {
        display: grid;
        place-items: center;
        flex: 1;
      }

      .cal-cell-count {
        display: grid;
        place-items: center;
        min-width: 1.75rem;
        height: 1.75rem;
        padding: 0 0.45rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary-soft) 70%, transparent);
        color: var(--on-surface);
        font-size: 0.82rem;
        font-weight: 800;
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

      /*
       * The drag preview is a transient clone that CDK destroys on drop, so
       * these styles are the "picked up" indicator and cannot persist once the
       * task lands in its new day.
       */
      ::ng-deep .cdk-drag-preview {
        border-radius: 0.55rem;
        background: var(--surface-container-lowest);
        box-shadow:
          0 16px 30px var(--surface-dim-strong),
          0 0 0 1px var(--primary-solid);
      }

      ::ng-deep .cdk-drag-placeholder {
        opacity: 0.35;
      }
    `,
  ],
})
export class CalendarMonthGridComponent {
  @Input({ required: true }) cells: CalendarCell[] = [];
  @Input() selectedKey = '';
  @Input() completionOverrides: ReadonlyMap<string, boolean> = new Map();
  @Input() todayKey = '';
  @Input() showMetadata = false;
  @Input() showCheck = true;
  @Input() allowDrag = true;
  @Input() allowQuickCreate = true;
  /** On phones, show only the count of tasks per day instead of task chips. */
  @Input() compactCounts = false;
  @Output() readonly selectDate = new EventEmitter<DateTime>();
  @Output() readonly openTask = new EventEmitter<Task>();
  @Output() readonly completeTask = new EventEmitter<Task>();
  @Output() readonly rescheduleTask = new EventEmitter<CalendarRescheduleRequest>();
  @Output() readonly createTask = new EventEmitter<DateTime>();

  protected readonly weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  protected readonly maxVisible = MAX_VISIBLE_TASKS;
  protected readonly faPlus = faPlus;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly focusedKey = signal('');
  private suppressClickUntil = 0;

  protected visibleTasks(cell: CalendarCell): Task[] {
    return cell.tasks.slice(0, this.maxVisible);
  }

  /** The single day that participates in tab order: focused, else selected, else the month's first day. */
  protected tabbableKey(): string {
    const keys = new Set(this.cells.map((cell) => cell.key));
    const focused = this.focusedKey();
    if (focused && keys.has(focused)) {
      return focused;
    }
    if (keys.has(this.selectedKey)) {
      return this.selectedKey;
    }
    return (this.cells.find((cell) => cell.inMonth) ?? this.cells[0])?.key ?? '';
  }

  protected dayAriaLabel(cell: CalendarCell): string {
    const count = cell.tasks.length;
    const tasks = `${count} ${count === 1 ? 'task' : 'tasks'}`;
    return `${cell.date.toFormat('cccc, LLLL d, yyyy')}, ${tasks}${cell.isToday ? ', today' : ''}`;
  }

  protected onDayFocus(cell: CalendarCell): void {
    this.focusedKey.set(cell.key);
  }

  /** Roving focus across the grid: arrows move by day/week, Home/End by week. */
  protected onDayKeydown(event: KeyboardEvent, cell: CalendarCell): void {
    let delta: number;
    switch (event.key) {
      case 'ArrowRight':
        delta = 1;
        break;
      case 'ArrowLeft':
        delta = -1;
        break;
      case 'ArrowDown':
        delta = 7;
        break;
      case 'ArrowUp':
        delta = -7;
        break;
      case 'Home':
        delta = -(cell.date.weekday % 7);
        break;
      case 'End':
        delta = 6 - (cell.date.weekday % 7);
        break;
      default:
        return;
    }

    event.preventDefault();
    this.focusDay(cell.date.plus({ days: delta }).toISODate() ?? '');
  }

  private focusDay(key: string): void {
    const button = this.host.nativeElement.querySelector<HTMLButtonElement>(
      `[data-cal-day="${key}"]`,
    );
    button?.focus();
  }

  /** Recurring tasks and completed tasks are not draggable; neither is touch. */
  protected canDrag(task: Task): boolean {
    return this.allowDrag && !task.recurrenceRule && !task.completed;
  }

  protected onDrop(event: CdkDragDrop<CalendarCell>, cell: CalendarCell): void {
    // CDK leaves the DOM element where it was dropped; suppress the trailing
    // click that would otherwise open the task.
    this.suppressClickUntil = Date.now() + 250;

    const task = event.item.data as Task | undefined;
    if (!task) return;
    if (task.dueDate?.slice(0, 10) === cell.key) return;

    this.rescheduleTask.emit({ task, date: cell.key });
  }

  protected onSelect(task: Task): void {
    if (this.isClickSuppressed()) return;

    this.openTask.emit(task);
  }

  protected onComplete(task: Task): void {
    if (this.isClickSuppressed()) return;
    this.completeTask.emit(task);
  }

  private isClickSuppressed(): boolean {
    return Date.now() < this.suppressClickUntil;
  }

  /** The cell's hover "+" starts the create flow for that day. */
  protected onAddClick(cell: CalendarCell, event: MouseEvent): void {
    event.stopPropagation();
    // Release focus so :focus-within doesn't pin this cell's "+" open once the
    // modal opens (and restores focus on close).
    (event.currentTarget as HTMLElement | null)?.blur();
    this.createTask.emit(cell.date);
  }

  /** Double-clicking a cell's empty space starts the create flow for that day. */
  protected onCellDoubleClick(cell: CalendarCell, event: MouseEvent): void {
    if (!this.allowQuickCreate || this.isClickSuppressed()) return;

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('app-calendar-task-chip, button, a, input, [role="button"]')
    ) {
      return;
    }

    this.createTask.emit(cell.date);
  }

  /**
   * Clicking a cell's empty space selects the day, matching the day-number
   * button and the "+N more" affordance. Creation stays explicit — the hover
   * "+" or a double-click — so a single click never opens the editor. Clicks on
   * a task chip are left to the chip's own controls.
   */
  protected onCellClick(cell: CalendarCell, event: MouseEvent): void {
    if (this.isClickSuppressed()) return;

    const target = event.target;
    if (target instanceof HTMLElement) {
      // Interactive controls handle their own taps.
      if (target.closest('button, a, input, [role="button"]')) {
        return;
      }

      // Clicks on a chip's padding (not its buttons) belong to the chip.
      if (target.closest('app-calendar-task-chip')) {
        return;
      }
    }

    this.selectDate.emit(cell.date);
  }

  protected isOverdue(task: Task): boolean {
    return !!task.dueDate && task.dueDate.slice(0, 10) < this.todayKey && !task.completed;
  }
}
