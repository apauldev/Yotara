import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import type { Label, Priority, Project } from '@yotara/shared';
import { LabelIconComponent } from '../../ui/label-icon/label-icon.component';

export interface TaskFilterSelection {
  labelIds: string[];
  labelMode: 'any' | 'all';
  projectId: string | null;
  priority: Priority | null;
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

/**
 * The task-list filter control. One trigger opens a panel where labels,
 * project, and priority compose into a single filter. The trigger badge shows
 * how many filter values are active so the filtered list always has a visible
 * cause; clearing any section leaves the others untouched.
 */
@Component({
  selector: 'app-task-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, LabelIconComponent],
  host: {
    '(document:click)': 'closeFromOutside()',
  },
  template: `
    <div class="filter-bar" (click)="$event.stopPropagation()">
      <button
        #trigger
        type="button"
        class="filter-trigger"
        [class.filter-trigger-active]="activeCount() > 0"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="activeCount() > 0 ? 'Filters, ' + activeCount() + ' active' : 'Filters'"
        aria-haspopup="dialog"
        aria-controls="task-filter-panel"
        (click)="toggle()"
      >
        <fa-icon [icon]="faFilter" aria-hidden="true"></fa-icon>
        <span>Filters</span>
        @if (activeCount() > 0) {
          <span class="filter-badge">{{ activeCount() }}</span>
        }
      </button>

      @if (open()) {
        <div
          id="task-filter-panel"
          class="filter-panel"
          role="dialog"
          aria-label="Filter tasks"
          (keydown.escape)="done()"
        >
          <section class="filter-section" aria-label="Filter by label">
            <div class="filter-section-head">
              <span>Labels</span>
              @if (selectedLabelIds().length > 0) {
                <button type="button" class="filter-clear" (click)="clearLabels()">Clear</button>
              }
            </div>

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
                  [class.filter-option-selected]="isLabelSelected(label.id)"
                  [attr.aria-pressed]="isLabelSelected(label.id)"
                  (click)="toggleLabel(label)"
                >
                  <app-label-icon [icon]="label.icon" [color]="label.color" size="sm" />
                  <span class="filter-option-name">{{ label.name }}</span>
                  @if (isLabelSelected(label.id)) {
                    <span class="filter-option-check" aria-hidden="true">✓</span>
                  }
                </button>
              }
              @if (filteredLabels().length === 0) {
                <p class="filter-empty">No labels match.</p>
              }
            </div>

            @if (selectedLabelIds().length > 1) {
              <div class="filter-mode" role="group" aria-label="Label match mode">
                <button
                  type="button"
                  class="mode-pill"
                  [class.mode-pill-active]="labelMode() === 'any'"
                  [attr.aria-pressed]="labelMode() === 'any'"
                  (click)="onLabelModeChange('any')"
                >
                  Any label
                </button>
                <button
                  type="button"
                  class="mode-pill"
                  [class.mode-pill-active]="labelMode() === 'all'"
                  [attr.aria-pressed]="labelMode() === 'all'"
                  (click)="onLabelModeChange('all')"
                >
                  All labels
                </button>
              </div>
            }
          </section>

          <section class="filter-section" aria-label="Filter by project">
            <div class="filter-section-head">
              <span>Project</span>
              @if (selectedProjectId()) {
                <button type="button" class="filter-clear" (click)="onProjectChange('')">
                  Clear
                </button>
              }
            </div>

            <select
              class="filter-select"
              aria-label="Filter by project"
              [value]="selectedProjectId() ?? ''"
              (change)="onProjectChange($any($event.target).value)"
            >
              <option value="">All projects</option>
              @for (project of projects(); track project.id) {
                <option [value]="project.id">{{ project.name }}</option>
              }
            </select>
          </section>

          <section class="filter-section" aria-label="Filter by priority">
            <div class="filter-section-head">
              <span>Priority</span>
              @if (selectedPriority()) {
                <button type="button" class="filter-clear" (click)="onPriorityChange(null)">
                  Clear
                </button>
              }
            </div>

            <div class="priority-options" role="group" aria-label="Filter by priority">
              <button
                type="button"
                class="priority-pill"
                [class.priority-pill-active]="selectedPriority() === null"
                [attr.aria-pressed]="selectedPriority() === null"
                (click)="onPriorityChange(null)"
              >
                Any
              </button>
              @for (priority of priorities; track priority) {
                <button
                  type="button"
                  class="priority-pill"
                  [class.priority-pill-active]="selectedPriority() === priority"
                  [attr.aria-pressed]="selectedPriority() === priority"
                  (click)="onPriorityChange(priority)"
                >
                  {{ priority | titlecase }}
                </button>
              }
            </div>
          </section>

          <div class="filter-actions">
            <button type="button" class="filter-action" (click)="clearAll()">Clear all</button>
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

      .filter-bar {
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

      .filter-badge {
        display: grid;
        place-items: center;
        min-width: 1.25rem;
        height: 1.25rem;
        padding: 0 0.3rem;
        border-radius: 999px;
        background: var(--primary-solid);
        color: hsl(var(--primary-foreground));
        font-size: 0.68rem;
        font-weight: 800;
        line-height: 1;
      }

      .filter-panel {
        position: absolute;
        top: calc(100% + 0.4rem);
        right: 0;
        z-index: 80;
        width: min(21rem, calc(100vw - 2rem));
        max-height: min(70vh, 34rem);
        overflow-y: auto;
        overscroll-behavior: contain;
        display: grid;
        gap: 0.85rem;
        padding: 0.8rem;
        border-radius: 0.85rem;
        background: var(--surface-container-lowest);
        box-shadow:
          0 14px 34px var(--surface-dim-strong),
          inset 0 0 0 1px var(--outline-variant);
      }

      .filter-section {
        display: grid;
        gap: 0.45rem;
      }

      .filter-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--on-surface-subtle);
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .filter-clear {
        border: 0;
        background: transparent;
        color: var(--primary-solid);
        font: inherit;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0;
        text-transform: none;
        cursor: pointer;
      }

      .filter-search,
      .filter-select {
        width: 100%;
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

      .filter-search:focus-visible,
      .filter-select:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      .filter-options {
        display: grid;
        gap: 0.15rem;
        max-height: 11rem;
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

      .filter-mode,
      .priority-options {
        display: flex;
        gap: 0.25rem;
        padding: 0.2rem;
        border-radius: 0.6rem;
        background: var(--surface-container-low);
      }

      .mode-pill,
      .priority-pill {
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

      .mode-pill-active,
      .priority-pill-active {
        background: var(--surface-container-lowest);
        color: var(--primary-solid);
      }

      .filter-actions {
        position: sticky;
        bottom: 0;
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        padding-top: 0.4rem;
        background: var(--surface-container-lowest);
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

      @media (max-width: 600px) {
        .filter-panel {
          position: fixed;
          top: auto;
          right: 0.75rem;
          bottom: 0.75rem;
          left: 0.75rem;
          z-index: 100;
          width: auto;
          max-height: calc(100dvh - 1.5rem);
          border-radius: 1rem;
          box-shadow:
            0 20px 48px var(--surface-dim-strong),
            inset 0 0 0 1px var(--outline-variant);
        }
      }

      @media (pointer: coarse) {
        .filter-trigger {
          min-height: 2.75rem;
        }

        .filter-option {
          min-height: 2.75rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TaskFilterBarComponent {
  protected readonly faFilter = faFilter;
  protected readonly priorities = PRIORITIES;

  readonly labels = input<Label[]>([]);
  readonly projects = input<Project[]>([]);
  readonly selectedLabelIds = input<string[]>([]);
  readonly labelMode = input<'any' | 'all'>('any');
  readonly selectedProjectId = input<string | null>(null);
  readonly selectedPriority = input<Priority | null>(null);

  @Output() readonly filtersChange = new EventEmitter<TaskFilterSelection>();

  protected readonly open = signal(false);
  protected readonly search = signal('');
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly filterSearch = viewChild<ElementRef<HTMLInputElement>>('filterSearch');

  protected readonly activeCount = computed(
    () =>
      this.selectedLabelIds().length +
      (this.selectedProjectId() ? 1 : 0) +
      (this.selectedPriority() ? 1 : 0),
  );

  protected readonly filteredLabels = computed(() => {
    const query = this.search().trim().toLowerCase();
    const list = this.labels();
    return query ? list.filter((label) => label.name.toLowerCase().includes(query)) : list;
  });

  protected toggle() {
    this.open.update((value) => !value);
    if (this.open()) {
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

  protected isLabelSelected(labelId: string) {
    return this.selectedLabelIds().includes(labelId);
  }

  protected toggleLabel(label: Label) {
    const nextIds = this.isLabelSelected(label.id)
      ? this.selectedLabelIds().filter((id) => id !== label.id)
      : [...this.selectedLabelIds(), label.id];
    this.emit({
      labelIds: nextIds,
      labelMode: nextIds.length > 1 ? this.labelMode() : 'any',
    });
  }

  protected onLabelModeChange(mode: 'any' | 'all') {
    this.emit({ labelMode: mode });
  }

  protected onProjectChange(projectId: string) {
    this.emit({ projectId: projectId || null });
  }

  protected onPriorityChange(priority: Priority | null) {
    this.emit({ priority });
  }

  protected clearLabels() {
    this.emit({ labelIds: [], labelMode: 'any' });
  }

  protected clearAll() {
    this.filtersChange.emit({
      labelIds: [],
      labelMode: 'any',
      projectId: null,
      priority: null,
    });
  }

  private emit(change: Partial<TaskFilterSelection>) {
    this.filtersChange.emit({
      labelIds: change.labelIds ?? this.selectedLabelIds(),
      labelMode: change.labelMode ?? this.labelMode(),
      projectId: change.projectId === undefined ? this.selectedProjectId() : change.projectId,
      priority: change.priority === undefined ? this.selectedPriority() : change.priority,
    });
  }
}
