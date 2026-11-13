import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCircleInfo, faXmark } from '@fortawesome/free-solid-svg-icons';
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
  imports: [FontAwesomeModule, CdkTrapFocus],
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
      <button type="button" class="provider-help-button" (click)="openHelp()">
        <fa-icon [icon]="faCircleInfo" aria-hidden="true" /> Where to find an ICS link
      </button>
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
    @if (helpOpen()) {
      <div class="provider-backdrop" role="presentation" (click)="closeHelp()">
        <section
          class="provider-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="provider-dialog-title"
          tabindex="-1"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="$event.stopPropagation()"
          (keydown.escape)="closeHelp()"
        >
          <header class="provider-dialog-head">
            <div>
              <p>Calendar setup</p>
              <h2 id="provider-dialog-title">Find your ICS link</h2>
            </div>
            <button
              type="button"
              class="provider-dialog-close"
              aria-label="Close instructions"
              (click)="closeHelp()"
            >
              <fa-icon [icon]="faXmark" aria-hidden="true" />
            </button>
          </header>
          <nav class="provider-tabs" aria-label="Calendar provider">
            @for (provider of providers; track provider.id) {
              <button
                type="button"
                [class.provider-tab-active]="selectedProvider() === provider.id"
                [attr.aria-pressed]="selectedProvider() === provider.id"
                (click)="selectedProvider.set(provider.id)"
              >
                {{ provider.label }}
              </button>
            }
          </nav>
          <div class="provider-instructions" aria-live="polite">
            @switch (selectedProvider()) {
              @case ('google') {
                <h3>Google Calendar</h3>
                <ol>
                  <li>Open Google Calendar on the web and select <strong>Settings</strong>.</li>
                  <li>Under <strong>Settings for my calendars</strong>, choose your calendar.</li>
                  <li>Open <strong>Integrate calendar</strong>.</li>
                  <li>
                    Copy <strong>Secret address in iCal format</strong> and paste it into Yotara.
                  </li>
                </ol>
                <p class="provider-note provider-note-warning">
                  The secret address grants access to this feed. Keep it private. If you cannot find
                  it, your work or school administrator may have disabled it.
                </p>
                <a
                  href="https://support.google.com/calendar/answer/37648"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Google's setup guide</a
                >
              }
              @case ('outlook') {
                <h3>Outlook.com or Microsoft 365</h3>
                <ol>
                  <li>
                    Open Outlook on the web, switch to <strong>Calendar</strong>, then open
                    <strong>Settings</strong>.
                  </li>
                  <li>Go to <strong>Calendar → Shared calendars</strong>.</li>
                  <li>
                    Under <strong>Publish a calendar</strong>, choose your calendar and the detail
                    level, then select <strong>Publish</strong>.
                  </li>
                  <li>
                    Copy the <strong>ICS</strong> link (not the HTML link) and paste it into Yotara.
                  </li>
                </ol>
                <p class="provider-note provider-note-warning">
                  A published link can be viewed by anyone who has it. Your organization may disable
                  calendar publishing.
                </p>
                <a
                  href="https://support.microsoft.com/en-us/outlook/share-your-calendar-in-outlook-on-the-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Microsoft's setup guide</a
                >
              }
              @case ('icloud') {
                <h3>Apple iCloud Calendar</h3>
                <ol>
                  <li>In Calendar on iPhone, iPad, or Mac, open the calendar list.</li>
                  <li>
                    Tap or click the info button beside the iCloud calendar you want to share.
                  </li>
                  <li>
                    Turn on <strong>Public Calendar</strong>, then choose
                    <strong>Share Link</strong>.
                  </li>
                  <li>
                    Paste the link into Yotara. If it starts with <code>webcal://</code>, change
                    that prefix to <code>https://</code>.
                  </li>
                </ol>
                <p class="provider-note provider-note-warning">
                  A public calendar link can be opened by anyone who has it. Turn off Public
                  Calendar when you no longer need the feed.
                </p>
                <a
                  href="https://support.apple.com/en-gb/guide/icloud/mm6b1a9479/icloud"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Apple's setup guide</a
                >
              }
              @case ('fastmail') {
                <h3>Fastmail</h3>
                <ol>
                  <li>Open <strong>Settings → Calendars</strong>.</li>
                  <li>
                    Select the calendar to edit and find its <strong>Publish</strong> section.
                  </li>
                  <li>
                    Enable <strong>Full event details</strong>, save, then copy the public calendar
                    URL.
                  </li>
                  <li>Paste that URL into Yotara.</li>
                </ol>
                <p class="provider-note provider-note-warning">
                  The public URL can be viewed by anyone who has it. Fastmail's free/busy link does
                  not include event details.
                </p>
                <a
                  href="https://www.fastmail.help/hc/en-us/articles/360060590793-Calendar-sharing-via-public-URL"
                  target="_blank"
                  rel="noopener noreferrer"
                  >Fastmail's setup guide</a
                >
              }
              @default {
                <h3>Another calendar app</h3>
                <ol>
                  <li>
                    Look in the calendar's sharing or publishing settings for an
                    <strong>ICS</strong> or <strong>iCalendar</strong> address.
                  </li>
                  <li>Copy the full web address that downloads or displays an iCalendar feed.</li>
                  <li>
                    Paste it into Yotara. The address must use <code>https://</code> and be
                    reachable without signing in.
                  </li>
                </ol>
                <p class="provider-note">
                  A calendar webpage, a Google <code>?cid=</code> link, a local
                  <code>.ics</code> file, or an account sign-in URL is not an ICS feed URL.
                </p>
              }
            }
          </div>
          <p class="provider-dialog-footnote">
            Calendar feeds are read-only in Yotara. Feed links work like credentials; only connect a
            calendar you are comfortable sharing with this Yotara account.
          </p>
        </section>
      </div>
    }
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
      .provider-help-button {
        display: inline-flex;
        align-items: center;
        justify-self: start;
        gap: 0.4rem;
        min-height: 2.75rem;
        padding: 0.25rem 0;
        border: 0;
        background: transparent;
        color: var(--primary-solid);
        font: inherit;
        font-size: 0.84rem;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
      }
      .provider-backdrop {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
          max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
        background: var(--backdrop-overlay);
      }
      .provider-dialog {
        display: grid;
        gap: 1rem;
        width: min(100%, 38rem);
        max-height: 90vh;
        max-height: 90dvh;
        overflow: auto;
        padding: 1.2rem;
        border-radius: 1rem;
        background: var(--surface-card);
        color: var(--on-surface);
        box-shadow: 0 1.5rem 4rem var(--surface-dim-strong);
      }
      .provider-dialog-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }
      .provider-dialog-head p,
      .provider-dialog-head h2,
      .provider-instructions h3 {
        margin: 0;
      }
      .provider-dialog-head p {
        margin-bottom: 0.25rem;
        color: var(--on-surface-subtle);
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .provider-dialog-head h2 {
        font-size: 1.2rem;
      }
      .provider-dialog-close {
        flex: 0 0 2.75rem;
        width: 2.75rem;
        height: 2.75rem;
        border: 0;
        border-radius: 0.7rem;
        background: var(--surface-container-low);
        color: var(--on-surface);
        cursor: pointer;
      }
      .provider-tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        border-bottom: 1px solid var(--outline-variant);
        padding-bottom: 0.7rem;
      }
      .provider-tabs button {
        min-height: 2.6rem;
        padding: 0 0.8rem;
        border: 1px solid var(--outline-variant);
        border-radius: 999px;
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
        font: inherit;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
      }
      .provider-tabs .provider-tab-active {
        border-color: var(--primary-solid);
        background: var(--primary-soft);
        color: var(--on-surface);
      }
      .provider-instructions {
        display: grid;
        gap: 0.65rem;
        line-height: 1.5;
      }
      .provider-instructions h3 {
        font-size: 1rem;
      }
      .provider-instructions ol {
        display: grid;
        gap: 0.55rem;
        margin: 0;
        padding-left: 1.35rem;
      }
      .provider-instructions a {
        color: var(--primary-solid);
        font-weight: 700;
        text-underline-offset: 0.15em;
      }
      .provider-note,
      .provider-dialog-footnote {
        margin: 0;
        color: var(--on-surface-muted);
        font-size: 0.8rem;
      }
      .provider-note-warning {
        padding: 0.7rem;
        border-radius: 0.7rem;
        background: var(--warning-soft);
        color: var(--on-surface);
      }
      .provider-dialog-footnote {
        padding-top: 0.75rem;
        border-top: 1px solid var(--outline-variant);
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
        .provider-dialog {
          padding: 1rem;
        }
        .provider-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .provider-tabs button {
          padding-inline: 0.45rem;
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
  protected readonly faXmark = faXmark;
  protected readonly providers = [
    { id: 'google', label: 'Google Calendar' },
    { id: 'outlook', label: 'Outlook' },
    { id: 'icloud', label: 'Apple iCloud' },
    { id: 'fastmail', label: 'Fastmail' },
    { id: 'other', label: 'Other app' },
  ] as const;
  protected readonly helpOpen = signal(false);
  protected readonly selectedProvider = signal<
    'google' | 'outlook' | 'icloud' | 'fastmail' | 'other'
  >('google');
  protected readonly url = signal('');
  protected readonly name = signal('');
  protected readonly color = signal<ProjectColor>('teal');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');

  constructor() {}

  protected openHelp(): void {
    this.selectedProvider.set('google');
    this.helpOpen.set(true);
  }

  protected closeHelp(): void {
    this.helpOpen.set(false);
  }

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
