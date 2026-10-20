import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import type { Label } from '@yotara/shared';
import { LabelIconComponent } from '../../ui/label-icon/label-icon.component';

/**
 * The task-list label filter. A trigger opens a searchable multi-select of
 * labels; selecting emits the full id list so the page can persist it in the
 * URL and let the task API do the filtering. Any/All only appears once more
 * than one label is selected, so the default OR behavior stays implicit.
 */
@Component({
  selector: 'app-task-label-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, LabelIconComponent],
  host: {
    '(document:click)': 'closeFromOutside()',
  },
  template: `
    <div class="label-filter" (click)="$event.stopPropagation()">
      <button
        #trigger
        type="button"
        class="filter-trigger"
        [class.filter-trigger-active]="selectedIds.length > 0"
        [attr.aria-expanded]="open()"
        aria-haspopup="dialog"
        aria-controls="task-label-filter-panel"
        (click)="toggle()"
      >
        <fa-icon [icon]="faFilter" aria-hidden="true"></fa-icon>
        <span>{{ selectedIds.length ? selectedIds.length + ' labels' : 'Labels' }}</span>
      </button>

      @if (open()) {
        <div
          id="task-label-filter-panel"
          class="filter-panel"
          role="dialog"
          aria-label="Filter by labels"
          (keydown.escape)="done()"
        >
          <input
            #filterSearch
            type="search"
            class="filter-search"
            placeholder="Search labels"
            autocomplete="off"
            aria-label="Search labels"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
          />

          <div class="filter-options" role="group" aria-label="Labels">
            @for (label of filteredLabels(); track label.id) {
              <button
                type="button"
                class="filter-option"
                [class.filter-option-selected]="isSelected(label.id)"
                [attr.aria-pressed]="isSelected(label.id)"
                (click)="toggleLabel(label)"
              >
                <app-label-icon [icon]="label.icon" [color]="label.color" size="sm" />
                <span class="filter-option-name">{{ label.name }}</span>
                @if (isSelected(label.id)) {
                  <span class="filter-option-check" aria-hidden="true">✓</span>
                }
              </button>
            }
            @if (filteredLabels().length === 0) {
              <p class="filter-empty">No labels match.</p>
            }
          </div>

          @if (selectedIds.length > 1) {
            <div class="filter-mode" role="group" aria-label="Match mode">
              <button
                type="button"
                class="mode-pill"
                [class.mode-pill-active]="mode === 'any'"
                [attr.aria-pressed]="mode === 'any'"
                (click)="modeChange.emit('any')"
              >
                Any
              </button>
              <button
                type="button"
                class="mode-pill"
                [class.mode-pill-active]="mode === 'all'"
                [attr.aria-pressed]="mode === 'all'"
                (click)="modeChange.emit('all')"
              >
                All
              </button>
            </div>
          }

          <div class="filter-actions">
            <button type="button" class="filter-action" (click)="clear()">Clear</button>
            <button type="button" class="filter-action filter-action-primary" (click)="done()">
              Done
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }

      .label-filter {
        position: relative;
      }

      .filter-trigger {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        min-height: 2.5rem;
        padding: 0 0.85rem;
        border: 1px solid var(--outline-variant);
        border-radius: 0.75rem;
        background: var(--surface-card);
        color: var(--on-surface);
        font: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
      }

      .filter-trigger:hover,
      .filter-trigger-active {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      .filter-trigger:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      .filter-panel {
        position: absolute;
        top: calc(100% + 0.4rem);
        right: 0;
        z-index: 45;
        width: min(19rem, 88vw);
        display: grid;
        gap: 0.55rem;
        padding: 0.7rem;
        border-radius: 0.85rem;
        background: var(--surface-card);
        box-shadow:
          0 14px 34px var(--surface-dim-strong),
          inset 0 0 0 1px var(--outline-variant);
      }

      .filter-search {
        min-height: 2.4rem;
        border: 0;
        border-radius: 0.7rem;
        background: var(--input);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 0 0.7rem;
        font: inherit;
        font-size: 0.84rem;
        color: var(--on-surface);
      }

      .filter-search:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      .filter-options {
        display: grid;
        gap: 0.15rem;
        max-height: 14rem;
        overflow-y: auto;
      }

      .filter-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        min-height: 2.35rem;
        padding: 0.25rem 0.4rem;
        border: 0;
        border-radius: 0.55rem;
        background: transparent;
        color: var(--on-surface);
        font: inherit;
        font-size: 0.85rem;
        text-align: left;
        cursor: pointer;
      }

      .filter-option:hover {
        background: var(--surface-container-high);
      }

      .filter-option:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: -1px;
      }

      .filter-option-selected {
        color: var(--primary-solid);
        font-weight: 700;
      }

      .filter-option-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .filter-option-check {
        margin-left: auto;
        font-weight: 800;
      }

      .filter-empty {
        margin: 0.4rem 0;
        color: var(--on-surface-muted);
        font-size: 0.82rem;
      }

      .filter-mode {
        display: flex;
        gap: 0.25rem;
        padding: 0.2rem;
        border-radius: 0.6rem;
        background: var(--surface-container-low);
      }

      .mode-pill {
        flex: 1;
        border: 0;
        border-radius: 0.45rem;
        background: transparent;
        color: var(--on-surface-muted);
        font: inherit;
        font-size: 0.78rem;
        font-weight: 700;
        padding: 0.3rem;
        cursor: pointer;
      }

      .mode-pill-active {
        background: var(--surface-container-lowest);
        color: var(--primary-solid);
      }

      .filter-actions {
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .filter-action {
        border: 0;
        border-radius: 0.55rem;
        background: transparent;
        color: var(--on-surface-muted);
        font: inherit;
        font-size: 0.8rem;
        font-weight: 700;
        padding: 0.35rem 0.6rem;
        cursor: pointer;
      }

      .filter-action:hover {
        background: var(--surface-container-high);
      }

      .filter-action-primary {
        color: var(--primary-solid);
      }

      @media (pointer: coarse) {
        .filter-option {
          min-height: 2.75rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TaskLabelFilterComponent {
  protected readonly faFilter = faFilter;

  @Input() labels: Label[] = [];
  @Input() selectedIds: string[] = [];
  @Input() mode: 'any' | 'all' = 'any';

  @Output() readonly selectionChange = new EventEmitter<string[]>();
  @Output() readonly modeChange = new EventEmitter<'any' | 'all'>();

  protected readonly open = signal(false);
  protected readonly search = signal('');
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly filterSearch = viewChild<ElementRef<HTMLInputElement>>('filterSearch');

  protected readonly filteredLabels = computed(() => {
    const query = this.search().trim().toLowerCase();
    return query
      ? this.labels.filter((label) => label.name.toLowerCase().includes(query))
      : this.labels;
  });

  protected toggle() {
    this.open.update((value) => !value);
    if (this.open()) {
      // The panel is a dialog; move focus into its search field so keyboard
      // users are not left behind on the trigger. Focus after the next render,
      // once the input exists in the DOM.
      setTimeout(() => this.filterSearch()?.nativeElement.focus(), 0);
    } else {
      this.search.set('');
    }
  }

  protected closeFromOutside() {
    if (this.open()) {
      this.open.set(false);
      this.search.set('');
    }
  }

  protected done() {
    this.open.set(false);
    this.search.set('');
    this.trigger()?.nativeElement.focus();
  }

  protected isSelected(labelId: string) {
    return this.selectedIds.includes(labelId);
  }

  protected toggleLabel(label: Label) {
    const next = this.isSelected(label.id)
      ? this.selectedIds.filter((id) => id !== label.id)
      : [...this.selectedIds, label.id];
    this.selectionChange.emit(next);
  }

  protected clear() {
    this.selectionChange.emit([]);
  }
}
