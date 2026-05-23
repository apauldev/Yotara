import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faCalendarDays,
  faChevronLeft,
  faChevronRight,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  BrnCalendar,
  BrnCalendarCellButton,
  BrnCalendarGrid,
  BrnCalendarHeader,
  BrnCalendarImports,
} from '@spartan-ng/brain/calendar';
import { provideNativeDateAdapter } from '@spartan-ng/brain/date-time';
import { BrnPopover, BrnPopoverImports } from '@spartan-ng/brain/popover';
import { parseCalendarDate } from '../../utils/timestamps';

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    BrnPopoverImports,
    BrnCalendarImports,
    BrnCalendarCellButton,
    BrnCalendarGrid,
    BrnCalendarHeader,
  ],
  providers: [provideNativeDateAdapter()],
  template: `
    <div class="date-picker-shell">
      <button
        type="button"
        class="date-picker-trigger"
        [disabled]="disabled"
        brnPopoverTrigger
        [brnPopoverTriggerFor]="popover"
      >
        <span class="date-picker-copy">
          <span class="date-picker-label">{{ label }}</span>
          <span class="date-picker-value">{{ displayValue() }}</span>
        </span>

        <fa-icon [icon]="faCalendarDays"></fa-icon>
      </button>

      <brn-popover #popover="brnPopover" align="end" sideOffset="12" class="date-picker-popover">
        <ng-template brnPopoverContent>
          <div
            class="date-picker-panel"
            brnCalendar
            [date]="selectedDate() ?? undefined"
            [defaultFocusedDate]="selectedDate() ?? today"
            [disabled]="disabled"
            [min]="minDate() ?? undefined"
            [max]="maxDate() ?? undefined"
            (dateChange)="handleSelection($event)"
          >
            <div class="date-picker-header" brnCalendarHeader>
              <button
                type="button"
                class="date-picker-nav"
                brnCalendarPreviousButton
                [attr.aria-label]="previousMonthLabel"
              >
                <fa-icon [icon]="faChevronLeft"></fa-icon>
              </button>

              <div class="date-picker-month">{{ monthLabel() }}</div>

              <button
                type="button"
                class="date-picker-nav"
                brnCalendarNextButton
                [attr.aria-label]="nextMonthLabel"
              >
                <fa-icon [icon]="faChevronRight"></fa-icon>
              </button>
            </div>

            <div class="date-picker-weekdays" aria-hidden="true">
              @for (weekday of weekdays; track weekday) {
                <span>{{ weekday }}</span>
              }
            </div>

            <div class="date-picker-grid" brnCalendarGrid>
              @for (day of days(); track day.getTime()) {
                <button
                  type="button"
                  class="date-picker-day"
                  brnCalendarCellButton
                  [date]="day"
                  (click)="handleSelection(day)"
                >
                  {{ day.getDate() }}
                </button>
              }
            </div>

            <div class="date-picker-footer">
              <span class="date-picker-help">{{ helpText() }}</span>

              @if (selectedDate()) {
                <button type="button" class="date-picker-clear" (click)="clearDate()">
                  <fa-icon [icon]="faXmark"></fa-icon>
                  Clear
                </button>
              }
            </div>
          </div>
        </ng-template>
      </brn-popover>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .date-picker-shell {
        width: 100%;
      }

      .date-picker-trigger {
        width: 100%;
        min-height: 3.05rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.85rem;
        border: 0;
        border-radius: 0.95rem;
        padding: 0.78rem 0.92rem;
        background: var(--surface-container-lowest);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        color: var(--on-surface);
        text-align: left;
      }

      .date-picker-trigger:disabled {
        opacity: 0.66;
        cursor: not-allowed;
      }

      .date-picker-copy {
        min-width: 0;
        display: grid;
        gap: 0.14rem;
      }

      .date-picker-label {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.68rem;
        font-weight: 800;
        color: var(--on-surface-subtle);
      }

      .date-picker-value {
        min-width: 0;
        font-size: 0.96rem;
        font-weight: 700;
        color: var(--on-surface);
      }

      .date-picker-trigger fa-icon {
        color: var(--on-surface-subtle);
      }

      .date-picker-panel {
        width: min(20.75rem, calc(100vw - 2rem));
        border-radius: 1.15rem;
        background: var(--surface-container-lowest);
        box-shadow:
          0 24px 48px var(--surface-dim-strong),
          inset 0 0 0 1px var(--outline-variant);
        padding: 0.95rem;
        display: grid;
        gap: 0.85rem;
      }

      .date-picker-header {
        display: grid;
        grid-template-columns: 2rem minmax(0, 1fr) 2rem;
        align-items: center;
        gap: 0.5rem;
      }

      .date-picker-month {
        text-align: center;
        font-weight: 800;
        color: var(--on-surface);
      }

      .date-picker-nav,
      .date-picker-clear {
        border: 0;
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
      }

      .date-picker-nav {
        width: 2rem;
        height: 2rem;
        border-radius: 0.7rem;
        display: grid;
        place-items: center;
      }

      .date-picker-weekdays,
      .date-picker-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.22rem;
      }

      .date-picker-weekdays span {
        text-align: center;
        font-size: 0.68rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--on-surface-subtle);
        padding-bottom: 0.15rem;
      }

      .date-picker-grid {
        gap: 0.2rem;
      }

      .date-picker-day {
        aspect-ratio: 1;
        min-width: 0;
        border: 0;
        border-radius: 0.78rem;
        background: transparent;
        color: var(--on-surface);
        font-weight: 700;
        display: grid;
        place-items: center;
      }

      .date-picker-day[data-outside] {
        color: var(--on-surface-subtle);
        opacity: 0.7;
      }

      .date-picker-day[data-today]:not([data-selected]) {
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--primary-solid) 35%, var(--outline-variant));
        background: color-mix(in srgb, var(--primary-soft) 58%, transparent);
      }

      .date-picker-day[data-selected] {
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
      }

      .date-picker-day[data-disabled] {
        opacity: 0.35;
      }

      .date-picker-day:not([data-disabled]):hover {
        background: var(--surface-container-high);
      }

      .date-picker-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .date-picker-help {
        min-width: 0;
        color: var(--on-surface-muted);
        font-size: 0.82rem;
      }

      .date-picker-clear {
        min-height: 2rem;
        border-radius: 0.7rem;
        padding: 0 0.75rem;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.84rem;
        font-weight: 700;
      }
    `,
  ],
})
export class DatePickerComponent implements OnChanges {
  @Input() value = '';
  @Input() disabled = false;
  @Input() label = 'Due date';
  @Input() min: string | null = null;
  @Input() max: string | null = null;
  @Output() readonly valueChange = new EventEmitter<string>();

  protected readonly weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faXmark = faXmark;

  private readonly popover = viewChild(BrnPopover);
  private readonly calendar = viewChild(BrnCalendar<Date>);
  protected readonly selectedDate = signal<Date | null>(null);
  protected readonly today = startOfDay(new Date());

  readonly previousMonthLabel = 'Go to previous month';
  readonly nextMonthLabel = 'Go to next month';

  protected readonly days = computed(() => this.calendar()?.days() ?? []);
  protected readonly monthLabel = computed(() => {
    const focused = this.calendar()?.focusedDate() ?? this.selectedDate() ?? this.today;
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(focused);
  });
  protected readonly helpText = computed(() => {
    const date = this.selectedDate();
    return date ? formatCalendarDate(date) : 'Choose a date for the task.';
  });

  private readonly minSignal = signal<string | null>(null);
  private readonly maxSignal = signal<string | null>(null);
  protected readonly minDate = computed(
    () => parseCalendarDate(this.minSignal())?.toJSDate() ?? null,
  );
  protected readonly maxDate = computed(
    () => parseCalendarDate(this.maxSignal())?.toJSDate() ?? null,
  );

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value']) {
      this.selectedDate.set(parseCalendarDate(this.value)?.toJSDate() ?? null);
    }
    if (changes['min']) {
      this.minSignal.set(this.min);
    }
    if (changes['max']) {
      this.maxSignal.set(this.max);
    }
  }

  protected displayValue() {
    const date = this.selectedDate();
    return date ? formatCalendarDate(date) : 'Pick a date';
  }

  protected handleSelection(date?: Date) {
    const normalized = date ? toDateInputValue(date) : '';
    this.selectedDate.set(date ? startOfDay(date) : null);
    this.valueChange.emit(normalized);
    this.popover()?.close();
  }

  protected clearDate() {
    this.selectedDate.set(null);
    this.valueChange.emit('');
    this.popover()?.close();
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCalendarDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
