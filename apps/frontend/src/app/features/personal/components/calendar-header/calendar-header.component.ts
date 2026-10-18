import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronLeft, faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-calendar-header',
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="cal-toolbar">
      <div class="cal-nav">
        <button
          type="button"
          class="cal-nav-btn"
          aria-label="Previous month"
          (click)="previous.emit()"
        >
          <fa-icon [icon]="faChevronLeft" aria-hidden="true" />
        </button>
        <span class="cal-month" aria-live="polite">{{ monthLabel }}</span>
        <button type="button" class="cal-nav-btn" aria-label="Next month" (click)="next.emit()">
          <fa-icon [icon]="faChevronRight" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="cal-done-btn"
          [class.cal-done-btn-active]="showDone"
          [attr.aria-pressed]="showDone"
          (click)="toggleShowDone.emit()"
        >
          Show done
        </button>
        <button
          type="button"
          class="cal-meta-btn"
          [class.cal-meta-btn-active]="showMetadata"
          [attr.aria-pressed]="showMetadata"
          (click)="toggleShowMetadata.emit()"
        >
          Show task details
        </button>
      </div>

      <div class="cal-actions">
        <button
          type="button"
          class="cal-nodate-btn"
          [class.cal-nodate-btn-active]="noDateActive"
          [attr.aria-pressed]="noDateActive"
          (click)="toggleNoDate.emit()"
        >
          No date
          @if (noDateCount > 0) {
            <span class="cal-badge">{{ noDateCount }}</span>
          }
        </button>
        <button type="button" class="cal-new-btn" (click)="newTask.emit()">
          <fa-icon [icon]="faPlus" aria-hidden="true" />
          New task
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .cal-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 0.85rem;
      }

      .cal-nav {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .cal-month {
        min-width: 9rem;
        text-align: center;
        font-weight: 800;
        font-size: 1.05rem;
        color: var(--on-surface);
      }

      .cal-nav-btn {
        display: grid;
        place-items: center;
        width: 2.25rem;
        height: 2.25rem;
        border: 0;
        border-radius: 0.7rem;
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
        cursor: pointer;
      }

      .cal-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .cal-nodate-btn,
      .cal-done-btn,
      .cal-meta-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        min-height: 2.25rem;
        padding: 0 0.85rem;
        border: 0;
        border-radius: 0.7rem;
        background: var(--surface-container-low);
        color: var(--on-surface);
        font-weight: 700;
        cursor: pointer;
      }

      .cal-nodate-btn-active,
      .cal-done-btn-active,
      .cal-meta-btn-active {
        background: var(--primary-soft);
        color: var(--on-surface);
        box-shadow: inset 0 0 0 1px var(--primary-solid);
      }

      .cal-badge {
        display: inline-grid;
        place-items: center;
        min-width: 1.35rem;
        height: 1.35rem;
        padding: 0 0.35rem;
        border-radius: 999px;
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
        font-size: 0.72rem;
        font-weight: 800;
      }

      .cal-new-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        min-height: 2.25rem;
        padding: 0 0.95rem;
        border: 0;
        border-radius: 0.7rem;
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
        font-weight: 700;
        cursor: pointer;
      }

      .cal-nav-btn:focus-visible,
      .cal-nodate-btn:focus-visible,
      .cal-done-btn:focus-visible,
      .cal-meta-btn:focus-visible,
      .cal-new-btn:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 2px;
      }

      @media (pointer: coarse) {
        .cal-nav-btn {
          width: 2.75rem;
          height: 2.75rem;
        }

        .cal-nodate-btn,
        .cal-done-btn,
        .cal-meta-btn,
        .cal-new-btn {
          min-height: 2.75rem;
        }
      }
    `,
  ],
})
export class CalendarHeaderComponent {
  @Input() monthLabel = '';
  @Input() noDateCount = 0;
  @Input() noDateActive = false;
  @Input() showDone = false;
  @Input() showMetadata = false;
  @Output() readonly previous = new EventEmitter<void>();
  @Output() readonly next = new EventEmitter<void>();
  @Output() readonly newTask = new EventEmitter<void>();
  @Output() readonly toggleNoDate = new EventEmitter<void>();
  @Output() readonly toggleShowDone = new EventEmitter<void>();
  @Output() readonly toggleShowMetadata = new EventEmitter<void>();

  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faPlus = faPlus;
}
