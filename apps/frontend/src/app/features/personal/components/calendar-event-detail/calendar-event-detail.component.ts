import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCalendarDays, faLocationDot, faXmark } from '@fortawesome/free-solid-svg-icons';
import type { CalendarEventDto } from '@yotara/shared';

@Component({
  selector: 'app-calendar-event-detail',
  standalone: true,
  imports: [FontAwesomeModule, CdkTrapFocus],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="event-backdrop" role="presentation" (click)="close.emit()">
      <section
        class="event-detail"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        [attr.aria-label]="event.summary || 'Calendar event'"
        (click)="$event.stopPropagation()"
        (keydown.escape)="close.emit()"
      >
        <button
          type="button"
          class="event-close"
          aria-label="Close event details"
          (click)="close.emit()"
        >
          <fa-icon [icon]="faXmark" aria-hidden="true" />
        </button>
        <p class="event-source">
          <fa-icon [icon]="faCalendarDays" aria-hidden="true" /> {{ event.sourceName }} calendar ·
          Read-only
        </p>
        <h2>{{ event.summary || 'Untitled event' }}</h2>
        @if (event.startTime) {
          <p class="event-when">
            {{ event.dayKeys[0] }} · {{ event.startTime }}–{{ event.endTime || '…' }}
          </p>
        } @else {
          <p class="event-when">{{ event.dayKeys.join(' – ') }} · All day</p>
        }
        @if (event.location) {
          <p class="event-location">
            <fa-icon [icon]="faLocationDot" aria-hidden="true" /> {{ event.location }}
          </p>
        }
        @if (event.description) {
          <p class="event-description">{{ event.description }}</p>
        }
        <p class="event-provenance">
          From {{ event.sourceName }} calendar · Read-only. Edit this event in your calendar
          provider.
        </p>
      </section>
    </div>
  `,
  styles: [
    `
      .event-backdrop {
        position: fixed;
        inset: 0;
        z-index: 20;
        display: grid;
        place-items: center;
        padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
          max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
        background: var(--backdrop-overlay);
      }
      .event-detail {
        position: relative;
        width: min(100%, 30rem);
        max-height: min(80vh, 40rem);
        max-height: min(80dvh, 40rem);
        overflow: auto;
        padding: 1.4rem;
        border-radius: 1rem;
        background: var(--surface-card);
        color: var(--on-surface);
        box-shadow: 0 1.5rem 4rem var(--surface-dim-strong);
      }
      .event-detail h2 {
        margin: 0.4rem 2rem 0.6rem 0;
        font-size: 1.25rem;
        overflow-wrap: anywhere;
      }
      .event-detail p {
        line-height: 1.5;
      }
      .event-source,
      .event-when,
      .event-location {
        color: var(--on-surface-muted);
      }
      .event-source,
      .event-location {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }
      .event-description {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .event-provenance {
        margin: 1.2rem 0 0;
        padding-top: 0.8rem;
        border-top: 1px solid var(--outline-variant);
        color: var(--on-surface-subtle);
        font-size: 0.82rem;
      }
      .event-close {
        position: absolute;
        top: 0.7rem;
        right: 0.7rem;
        width: 2.25rem;
        height: 2.25rem;
        border: 0;
        border-radius: 0.6rem;
        background: var(--surface-container-low);
        color: var(--on-surface);
        cursor: pointer;
      }
      @media (pointer: coarse) {
        .event-close {
          width: 2.75rem;
          height: 2.75rem;
        }
      }
    `,
  ],
})
export class CalendarEventDetailComponent {
  @Input({ required: true }) event!: CalendarEventDto;
  @Output() readonly close = new EventEmitter<void>();
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faLocationDot = faLocationDot;
  protected readonly faXmark = faXmark;
}
