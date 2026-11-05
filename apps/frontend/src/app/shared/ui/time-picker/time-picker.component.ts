import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  computed,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faClock, faXmark } from '@fortawesome/free-solid-svg-icons';
import { BrnPopover, BrnPopoverImports } from '@spartan-ng/brain/popover';
import { pickerShellStyles } from '../picker/picker-shell.styles';
import { formatTimeLabel } from '../../utils/timestamps';

export interface TimeSlot {
  value: string; // 'HH:mm' 24-hour format (e.g. '09:15')
  label: string; // Display label (e.g. '9:15 AM')
}

export interface TimePreset {
  label: string;
  value: string; // 'HH:mm'
}

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, BrnPopoverImports],
  template: `
    <div class="time-picker-shell">
      <button
        type="button"
        class="time-picker-trigger picker-trigger"
        [disabled]="disabled"
        [attr.aria-invalid]="invalid ? 'true' : null"
        [attr.aria-describedby]="describedBy || null"
        brnPopoverTrigger
        [brnPopoverTriggerFor]="popover"
        (click)="onTriggerClick()"
      >
        <span class="time-picker-copy picker-copy">
          <span class="time-picker-label picker-label">{{ label }}</span>
          <span class="time-picker-value picker-value" [class.placeholder]="!value">
            {{ displayValue() }}
          </span>
        </span>

        <fa-icon [icon]="faClock"></fa-icon>
      </button>

      <brn-popover
        #popover="brnPopover"
        align="end"
        sideOffset="12"
        class="time-picker-popover"
        [aria-label]="dialogLabel"
      >
        <ng-template brnPopoverContent>
          <div class="time-picker-panel picker-panel">
            <!-- Quick Presets -->
            <div class="time-picker-section">
              <span class="time-picker-section-title">Presets</span>
              <div class="time-picker-presets">
                @for (preset of presets; track preset.value) {
                  <button
                    type="button"
                    class="time-picker-preset-btn"
                    [attr.data-active]="value === preset.value"
                    [attr.aria-pressed]="value === preset.value"
                    (click)="selectTime(preset.value)"
                  >
                    {{ preset.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Exact Time Input -->
            <div class="time-picker-section">
              <span class="time-picker-section-title">Exact Time</span>
              <div class="time-picker-custom-row">
                <input
                  type="text"
                  class="time-picker-custom-input"
                  placeholder="e.g. 9:15 AM or 14:30"
                  autocomplete="off"
                  enterkeyhint="done"
                  [value]="customInputText()"
                  [attr.aria-invalid]="customTimeError() ? 'true' : null"
                  [attr.aria-describedby]="customTimeError() ? errorId : null"
                  (input)="onCustomInputChange($event)"
                  (keydown.enter)="applyCustomTime()"
                  aria-label="Type exact time"
                />
                <button
                  type="button"
                  class="time-picker-set-btn"
                  [disabled]="!customInputText().trim()"
                  (click)="applyCustomTime()"
                >
                  Set
                </button>
              </div>
              @if (customTimeError()) {
                <span [id]="errorId" class="time-picker-error-hint" role="alert">
                  {{ customTimeError() }}
                </span>
              }
            </div>

            <!-- 15-Minute Intervals Grid -->
            <div class="time-picker-section">
              <span class="time-picker-section-title">15-Minute Intervals</span>
              <div #slotsContainer class="time-picker-slots-container">
                <div class="time-picker-slots-grid">
                  @for (slot of timeSlots; track slot.value; let i = $index) {
                    <button
                      type="button"
                      class="time-picker-slot"
                      [attr.data-time]="slot.value"
                      [attr.tabindex]="i === activeSlotIndex() ? 0 : -1"
                      [attr.data-selected]="value === slot.value"
                      [attr.aria-pressed]="value === slot.value"
                      (focus)="activeSlotIndex.set(i)"
                      (keydown)="onSlotKeydown($event, i)"
                      (click)="selectTime(slot.value)"
                    >
                      {{ slot.label }}
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="time-picker-footer picker-footer">
              <span class="time-picker-help">Local time</span>

              @if (value) {
                <button type="button" class="time-picker-clear" (click)="clearTime()">
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    pickerShellStyles,
    `
      :host {
        display: block;
      }

      .time-picker-shell {
        width: 100%;
      }

      .time-picker-value.placeholder {
        color: var(--on-surface-subtle);
        font-weight: 500;
      }

      .time-picker-section {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .time-picker-section-title {
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--on-surface-subtle);
      }

      .time-picker-presets {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.35rem;
      }

      .time-picker-preset-btn {
        border: 0;
        border-radius: 0.65rem;
        padding: 0.45rem 0.2rem;
        background: var(--surface-container-low);
        color: var(--on-surface);
        font-size: 0.74rem;
        font-weight: 600;
        text-align: center;
        cursor: pointer;
        transition:
          background 0.15s ease,
          color 0.15s ease;

        &:hover {
          background: var(--surface-container-high);
        }

        &:focus-visible {
          outline: 2px solid var(--primary-solid);
          outline-offset: 1px;
        }

        &[data-active='true'] {
          background: var(--primary-gradient);
          color: hsl(var(--primary-foreground));
          font-weight: 700;
        }
      }

      .time-picker-custom-row {
        display: flex;
        gap: 0.4rem;
      }

      .time-picker-custom-input {
        flex: 1;
        min-width: 0;
        border: 1px solid var(--outline-variant);
        border-radius: 0.65rem;
        padding: 0.45rem 0.65rem;
        background: var(--surface-container-low);
        color: var(--on-surface);
        font-size: 0.82rem;
        font-weight: 600;
        outline: none;
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;

        &::placeholder {
          color: var(--on-surface-subtle);
          font-weight: 400;
        }

        &:focus {
          border-color: var(--primary-solid);
          box-shadow: 0 0 0 1px var(--primary-solid);
        }
      }

      .time-picker-set-btn {
        border: 0;
        border-radius: 0.65rem;
        padding: 0.45rem 0.85rem;
        background: var(--surface-container-high);
        color: var(--on-surface);
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
        transition:
          background 0.15s ease,
          color 0.15s ease;

        &:hover:not(:disabled) {
          background: var(--primary-solid);
          color: hsl(var(--primary-foreground));
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        &:focus-visible {
          outline: 2px solid var(--primary-solid);
          outline-offset: 1px;
        }
      }

      .time-picker-error-hint {
        font-size: 0.72rem;
        color: var(--status-urgent, #e53e3e);
        font-weight: 500;
      }

      .time-picker-slots-container {
        overflow-y: auto;
        max-height: 10.5rem;
        border-radius: 0.75rem;
        background: var(--surface-container-low);
        padding: 0.35rem;
        scrollbar-width: thin;
        scrollbar-color: var(--outline-variant) transparent;
      }

      .time-picker-slots-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.25rem;
      }

      .time-picker-slot {
        border: 0;
        border-radius: 0.55rem;
        padding: 0.48rem 0.2rem;
        background: transparent;
        color: var(--on-surface);
        font-size: 0.78rem;
        font-weight: 600;
        text-align: center;
        cursor: pointer;
        transition: background 0.12s ease;

        &:hover:not([data-selected='true']) {
          background: var(--surface-container-high);
        }

        &:focus-visible {
          outline: 2px solid var(--primary-solid);
          outline-offset: 1px;
        }

        &[data-selected='true'] {
          background: var(--primary-gradient);
          color: hsl(var(--primary-foreground));
          box-shadow: inset 0 0 0 1px
            color-mix(in srgb, hsl(var(--primary-foreground)) 18%, transparent);
          font-weight: 700;
        }
      }

      .time-picker-footer {
        padding-top: 0.35rem;
        border-top: 1px solid var(--outline-variant);
      }

      .time-picker-help {
        min-width: 0;
        color: var(--on-surface-muted);
        font-size: 0.78rem;
      }

      .time-picker-clear {
        border: 0;
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
        border-radius: 0.7rem;
        min-height: 2.25rem;
        padding: 0 0.75rem;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        transition:
          background 0.15s ease,
          color 0.15s ease;

        &:hover {
          background: var(--surface-container-high);
          color: var(--on-surface);
        }

        &:focus-visible {
          outline: 2px solid var(--primary-solid);
          outline-offset: 2px;
        }
      }
    `,
  ],
})
export class TimePickerComponent implements OnChanges, OnDestroy {
  private readonly _value = signal('');

  @Input()
  set value(val: string) {
    this._value.set(val || '');
  }
  get value(): string {
    return this._value();
  }

  @Input() disabled = false;
  @Input() label = 'Due time';
  @Input() invalid = false;
  @Input() describedBy: string | null = null;
  @Input() presets: readonly TimePreset[] = DEFAULT_PRESETS;
  @Output() readonly valueChange = new EventEmitter<string>();

  protected readonly faClock = faClock;
  protected readonly faXmark = faXmark;

  private readonly popover = viewChild(BrnPopover);
  private readonly slotsContainer = viewChild<ElementRef<HTMLDivElement>>('slotsContainer');

  private readonly instanceId = `time-picker-${++nextTimePickerId}`;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly errorId = `${this.instanceId}-error`;

  protected readonly customInputText = signal('');
  protected readonly customTimeError = signal<string | null>(null);
  protected readonly activeSlotIndex = signal(DEFAULT_SLOT_INDEX);

  protected readonly timeSlots: readonly TimeSlot[] = TIME_SLOTS;

  protected get dialogLabel(): string {
    return `Choose ${this.label.toLowerCase()}`;
  }

  protected readonly displayValue = computed(() => {
    const v = this._value();
    if (!v) return 'No time set';
    return formatTimeLabel(v) || v;
  });

  protected readonly parsedCustomTime = computed(() => {
    return parseExactTime(this.customInputText());
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      if (this.value) {
        this.customInputText.set(formatTimeLabel(this.value));
      } else {
        this.customInputText.set('');
      }
      this.customTimeError.set(null);
    }
  }

  ngOnDestroy(): void {
    if (this.scrollTimer !== null) {
      clearTimeout(this.scrollTimer);
      this.scrollTimer = null;
    }
  }

  protected onTriggerClick(): void {
    this.customTimeError.set(null);
    this.customInputText.set(this.value ? formatTimeLabel(this.value) : '');
    this.activeSlotIndex.set(this.slotIndexForValue(this.value));
    // Auto-scroll to the selected or default 9:00 AM slot after the panel renders.
    if (this.scrollTimer !== null) {
      clearTimeout(this.scrollTimer);
    }
    this.scrollTimer = setTimeout(() => {
      this.scrollTimer = null;
      this.scrollToActiveSlot();
    }, 50);
  }

  protected onCustomInputChange(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    this.customInputText.set(input.value);
    this.customTimeError.set(null);
  }

  protected applyCustomTime(): void {
    const parsed = this.parsedCustomTime();
    if (!parsed) {
      this.customTimeError.set('Enter a valid time (e.g. 9:15 AM or 14:30)');
      return;
    }

    this.selectTime(parsed);
  }

  protected selectTime(time: string): void {
    this._value.set(time);
    this.customInputText.set(formatTimeLabel(time));
    this.customTimeError.set(null);
    this.valueChange.emit(time);
    this.popover()?.close();
  }

  protected clearTime(): void {
    this._value.set('');
    this.customInputText.set('');
    this.customTimeError.set(null);
    this.valueChange.emit('');
    this.popover()?.close();
  }

  /** Arrow-key navigation across the 15-minute grid, with one roving tab stop. */
  protected onSlotKeydown(event: KeyboardEvent, index: number): void {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(index + 1, this.timeSlots.length - 1);
        break;
      case 'ArrowLeft':
        next = Math.max(index - 1, 0);
        break;
      case 'ArrowDown':
        next = Math.min(index + SLOT_COLUMNS, this.timeSlots.length - 1);
        break;
      case 'ArrowUp':
        next = Math.max(index - SLOT_COLUMNS, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.timeSlots.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.activeSlotIndex.set(next);
    const target = event.currentTarget;
    const grid = target instanceof HTMLElement ? target.parentElement : null;
    const buttons = grid?.querySelectorAll<HTMLButtonElement>('.time-picker-slot');
    buttons?.[next]?.focus();
  }

  private slotIndexForValue(value: string): number {
    const exact = this.timeSlots.findIndex((slot) => slot.value === value);
    if (exact >= 0) return exact;

    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) return DEFAULT_SLOT_INDEX;

    const minutes = Number(match[1]) * 60 + Number(match[2]);
    return Math.min(Math.round(minutes / 15), this.timeSlots.length - 1);
  }

  private scrollToActiveSlot(): void {
    const container = this.slotsContainer()?.nativeElement;
    if (!container) return;

    const slotEl =
      container.querySelectorAll<HTMLElement>('.time-picker-slot')[this.activeSlotIndex()];
    if (!slotEl) return;
    const offsetTop = slotEl.offsetTop - container.offsetTop;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({
      top: Math.max(0, offsetTop - container.clientHeight / 2 + slotEl.clientHeight / 2),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }
}

const SLOT_COLUMNS = 3;
const DEFAULT_SLOT_INDEX = 36; // 9:00 AM
const DEFAULT_PRESETS: readonly TimePreset[] = [
  { label: '9:00 AM', value: '09:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '5:00 PM', value: '17:00' },
  { label: '8:00 PM', value: '20:00' },
];
let nextTimePickerId = 0;

/** Pre-generates 96 slots for every 15-minute interval in a 24-hour day. */
function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      const value = `${hh}:${mm}`;
      slots.push({
        value,
        label: formatTimeLabel(value) || value,
      });
    }
  }
  return slots;
}

/** Built once per module load instead of once per picker instance. */
const TIME_SLOTS = generateTimeSlots();

/** Parses natural user inputs like "14:35", "2:35 PM", "9:12am", "5p" into "HH:mm". */
export function parseExactTime(input: string): string | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();

  // 1. Matches "HH:mm" 24h format (e.g. "14:35", "09:05", "9:05")
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // 2. Matches "H:mm am/pm/a/p" (e.g. "2:35pm", "2:35 pm", "2:35p", "10:15 am")
  const m12 = /^(\d{1,2}):(\d{2})\s*([ap])m?$/.exec(raw);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    const meridiem = m12[3];
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      if (meridiem === 'p' && h < 12) h += 12;
      if (meridiem === 'a' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // 3. Matches "H am/pm/a/p" (e.g. "2pm", "2 pm", "2p", "9am")
  const mHourOnly = /^(\d{1,2})\s*([ap])m?$/.exec(raw);
  if (mHourOnly) {
    let h = parseInt(mHourOnly[1], 10);
    const meridiem = mHourOnly[2];
    if (h >= 1 && h <= 12) {
      if (meridiem === 'p' && h < 12) h += 12;
      if (meridiem === 'a' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:00`;
    }
  }

  return null;
}
