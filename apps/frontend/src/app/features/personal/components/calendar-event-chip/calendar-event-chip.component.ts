import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import type { CalendarEventDto } from '@yotara/shared';

@Component({
  selector: 'app-calendar-event-chip',
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <button
      type="button"
      class="event-chip"
      [class]="'event-chip event-chip-' + event.sourceColor"
      [attr.aria-label]="label"
      [title]="event.summary + ' · ' + event.sourceName + ' calendar'"
      (click)="select.emit(event)"
    >
      <span class="event-bar" aria-hidden="true"></span>
      <fa-icon [icon]="faCalendarDays" aria-hidden="true" />
      @if (event.startTime) {
        <span class="event-time">{{ event.startTime }}</span>
      }
      <span class="event-title">{{ event.summary || 'Untitled event' }}</span>
    </button>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .event-chip {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        width: 100%;
        min-width: 0;
        padding: 0.18rem 0.35rem;
        border: 0;
        border-radius: 0.45rem;
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
        font: inherit;
        font-size: 0.68rem;
        text-align: left;
        cursor: pointer;
      }
      .event-chip:hover {
        background: var(--surface-container-high);
        color: var(--on-surface);
      }
      .event-bar {
        flex: 0 0 3px;
        align-self: stretch;
        border-radius: 3px;
        background: var(--event-color, var(--primary-solid));
      }
      .event-chip-sage {
        --event-color: var(--success-strong);
      }
      .event-chip-teal {
        --event-color: var(--primary-solid);
      }
      .event-chip-olive {
        --event-color: var(--priority-low);
      }
      .event-chip-clay {
        --event-color: var(--status-pending);
      }
      .event-chip-forest {
        --event-color: var(--accent-strong);
      }
      .event-chip-deep-ocean {
        --event-color: var(--priority-high);
      }
      .event-time {
        flex: 0 0 auto;
        font-size: 0.62rem;
        font-weight: 800;
      }
      .event-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .event-chip:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }
      @media (pointer: coarse) {
        .event-chip {
          min-height: 2.75rem;
          padding: 0.35rem 0.5rem;
          font-size: 0.78rem;
        }
        .event-time {
          font-size: 0.7rem;
        }
      }
    `,
  ],
})
export class CalendarEventChipComponent {
  @Input({ required: true }) event!: CalendarEventDto;
  @Output() readonly select = new EventEmitter<CalendarEventDto>();
  protected readonly faCalendarDays = faCalendarDays;
  protected get label(): string {
    const time = this.event.startTime ? `, ${this.event.startTime}` : '';
    return `Event: ${this.event.summary || 'Untitled event'}${time}, from ${this.event.sourceName} calendar, read-only`;
  }
}
