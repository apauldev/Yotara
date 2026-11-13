import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import {
  PROJECT_COLORS,
  type CalendarSource,
  type CreateCalendarSourceDto,
  type ProjectColor,
} from '@yotara/shared';
import { CalendarService } from '../../../../core/services/calendar.service';

@Component({
  selector: 'app-calendar-source-form',
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <form class="source-form" (submit)="connect($event)">
      <label>
        <span>Calendar URL</span>
        <input
          type="url"
          autocomplete="url"
          required
          [value]="url()"
          (input)="url.set(valueOf($event))"
          placeholder="https://…/calendar.ics"
        />
      </label>
      <div class="source-form-row">
        <label class="source-name">
          <span>Name <small>optional</small></span>
          <input
            type="text"
            maxlength="120"
            [value]="name()"
            (input)="name.set(valueOf($event))"
            placeholder="Defaults to the calendar host"
          />
        </label>
        <label class="source-color">
          <span>Colour</span>
          <select [value]="color()" (change)="setColor($event)">
            @for (option of colors; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>
      </div>
      <details class="provider-help">
        <summary>
          <fa-icon [icon]="faCircleInfo" aria-hidden="true" /> Where to find a calendar link
        </summary>
        <ul>
          <li>
            <strong>Google Calendar:</strong> Settings → select a calendar → Integrate calendar →
            copy “Secret address in iCal format”.
          </li>
          <li>
            <strong>Outlook / Microsoft 365:</strong> Settings → Calendar → Shared calendars →
            Publish a calendar → copy the ICS link.
          </li>
          <li>
            <strong>Apple iCloud:</strong> Share Calendar → Public Calendar → copy the link. Change
            <code>webcal://</code> to <code>https://</code>.
          </li>
          <li><strong>Other providers:</strong> use a URL that returns an iCalendar feed.</li>
        </ul>
      </details>
      <p class="source-privacy">
        The URL is a secret. Yotara encrypts it at rest and never shows it again. Events are
        read-only; tasks remain yours to complete.
      </p>
      @if (error()) {
        <p class="source-error" role="alert">{{ error() }}</p>
      }
      @if (success()) {
        <p class="source-success" role="status">{{ success() }}</p>
      }
      <button type="submit" class="source-submit" [disabled]="saving()">
        {{ saving() ? 'Connecting…' : 'Connect calendar' }}
      </button>
    </form>
  `,
  styles: [
    `
      .source-form {
        display: grid;
        gap: 0.85rem;
      }
      .source-form label {
        display: grid;
        gap: 0.35rem;
        color: var(--on-surface);
        font-size: 0.84rem;
        font-weight: 700;
      }
      .source-form input,
      .source-form select {
        width: 100%;
        min-height: 2.65rem;
        box-sizing: border-box;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--outline-variant);
        border-radius: 0.65rem;
        background: var(--surface-container-lowest);
        color: var(--on-surface);
        font: inherit;
      }
      .source-form-row {
        display: flex;
        gap: 0.75rem;
      }
      .source-name {
        flex: 1 1 auto;
        min-width: 0;
      }
      .source-color {
        flex: 0 0 9rem;
      }
      .source-form small {
        color: var(--on-surface-subtle);
        font-weight: 400;
      }
      .provider-help {
        color: var(--on-surface-muted);
        font-size: 0.82rem;
      }
      .provider-help summary {
        cursor: pointer;
      }
      .provider-help ul {
        display: grid;
        gap: 0.5rem;
        padding-left: 1.25rem;
        line-height: 1.45;
      }
      .source-privacy {
        margin: 0;
        color: var(--on-surface-subtle);
        font-size: 0.8rem;
        line-height: 1.45;
      }
      .source-error,
      .source-success {
        margin: 0;
        font-size: 0.85rem;
      }
      .source-error {
        color: var(--status-overdue);
      }
      .source-success {
        color: var(--primary-solid);
      }
      .source-submit {
        justify-self: start;
        min-height: 2.5rem;
        padding: 0 1rem;
        border: 0;
        border-radius: 0.7rem;
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
        font-weight: 800;
        cursor: pointer;
      }
      .source-submit:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      @media (max-width: 540px) {
        .source-form-row {
          flex-direction: column;
        }
        .source-color {
          flex-basis: auto;
        }
      }
    `,
  ],
})
export class CalendarSourceFormComponent {
  private readonly calendarService = inject(CalendarService);
  @Output() readonly connected = new EventEmitter<CalendarSource>();
  protected readonly colors = PROJECT_COLORS;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly url = signal('');
  protected readonly name = signal('');
  protected readonly color = signal<ProjectColor>('teal');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');

  constructor() {}

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected setColor(event: Event): void {
    const value = this.valueOf(event);
    if ((PROJECT_COLORS as readonly string[]).includes(value))
      this.color.set(value as ProjectColor);
  }

  protected async connect(event: Event): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;
    this.error.set('');
    this.success.set('');
    const body: CreateCalendarSourceDto = {
      url: this.url().trim(),
      ...(this.name().trim() ? { name: this.name().trim() } : {}),
      color: this.color(),
    };
    this.saving.set(true);
    try {
      const source = await this.calendarService.createSource(body);
      this.success.set(`Connected — ${source.eventCount} events found.`);
      this.url.set('');
      this.name.set('');
      this.connected.emit(source);
    } catch (error) {
      this.error.set(
        error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
          ? error.error.message
          : 'Could not connect this calendar. Check the URL and try again.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
