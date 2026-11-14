import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { DateTime } from 'luxon';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import type { CalendarWeekDay } from '../../utils/calendar-view';

@Component({
  selector: 'app-calendar-week-strip',
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="cal-week-strip" role="group" aria-label="Week">
      @for (day of days; track day.key) {
        <button
          type="button"
          class="cal-week-day"
          [class.cal-week-day-today]="day.isToday"
          [class.cal-week-day-selected]="day.isSelected"
          [attr.data-cal-day]="day.key"
          [attr.aria-pressed]="day.isSelected"
          [attr.aria-label]="dayLabel(day)"
          (click)="selectDate.emit(day.date)"
        >
          <span class="cal-week-weekday">{{ day.date.toFormat('ccc') }}</span>
          <span class="cal-week-number">{{ day.date.day }}</span>
          @if (day.taskCount > 0) {
            <span class="cal-week-count">{{ day.taskCount }}</span>
          }
          @if (day.eventCount > 0) {
            <span class="cal-week-event-count">
              <fa-icon [icon]="faCalendarDays" aria-hidden="true" />{{ day.eventCount }}
            </span>
          }
        </button>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .cal-week-strip {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.25rem;
        padding: 0.5rem;
        border-radius: 1rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .cal-week-day {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;
        min-width: 0;
        min-height: 2.9rem;
        padding: 0.35rem 0.1rem;
        border: 0;
        border-radius: 0.7rem;
        background: transparent;
        color: var(--on-surface);
        cursor: pointer;
      }

      .cal-week-weekday {
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--on-surface-subtle);
      }

      .cal-week-number {
        font-size: 0.92rem;
        font-weight: 800;
      }

      .cal-week-count {
        display: grid;
        place-items: center;
        min-width: 1.05rem;
        height: 1.05rem;
        padding: 0 0.3rem;
        border-radius: 999px;
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
        font-size: 0.6rem;
        font-weight: 800;
      }

      .cal-week-event-count {
        display: inline-flex;
        align-items: center;
        gap: 0.15rem;
        color: var(--on-surface-subtle);
        font-size: 0.58rem;
        font-weight: 800;
        line-height: 1;
      }

      .cal-week-day-today .cal-week-number {
        color: var(--primary-solid);
      }

      .cal-week-day-selected {
        background: var(--primary-gradient);
      }

      .cal-week-day-selected .cal-week-weekday,
      .cal-week-day-selected .cal-week-number {
        color: hsl(var(--primary-foreground));
      }

      .cal-week-day-selected .cal-week-count {
        background: color-mix(in srgb, hsl(var(--primary-foreground)) 22%, transparent);
        color: hsl(var(--primary-foreground));
      }

      .cal-week-day:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 2px;
      }

      @media (pointer: coarse) {
        .cal-week-day {
          min-height: 2.75rem;
        }
      }
    `,
  ],
})
export class CalendarWeekStripComponent {
  @Input() days: CalendarWeekDay[] = [];
  @Output() readonly selectDate = new EventEmitter<DateTime>();
  protected readonly faCalendarDays = faCalendarDays;

  protected dayLabel(day: CalendarWeekDay): string {
    const count = day.taskCount;
    const tasks = `${count} ${count === 1 ? 'task' : 'tasks'}`;
    const events = `${day.eventCount} ${day.eventCount === 1 ? 'event' : 'events'}`;
    return `${day.date.toFormat('cccc, LLLL d, yyyy')}, ${tasks}, ${events}${day.isToday ? ', today' : ''}`;
  }
}
