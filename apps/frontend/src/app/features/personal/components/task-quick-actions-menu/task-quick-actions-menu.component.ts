import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowUpRightFromSquare,
  faCalendarDay,
  faCheck,
  faEllipsis,
  faFlag,
  faMagnifyingGlass,
  faRotateLeft,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { BrnPopover, BrnPopoverImports } from '@spartan-ng/brain/popover';
import type { Priority, ProjectColor, Task, UpdateTaskDto } from '@yotara/shared';
import { LabelService } from '../../../../core/services/label.service';
import { ProjectService } from '../../../../core/services/project.service';
import { TaskQuickActionsCoordinatorService } from '../../../../core/services/task-quick-actions-coordinator.service';
import { LabelIconComponent } from '../../../../shared/ui/label-icon/label-icon.component';
import { PickerFocusTrapDirective } from '../../../../shared/ui/picker/picker-focus-trap.directive';
import { parseCalendarDate, startOfToday } from '../../../../shared/utils/timestamps';
import { projectPaletteFor } from '../../project-presentation';

export interface TaskQuickActionsSaveEvent {
  taskId: string;
  diff: UpdateTaskDto;
  draft: {
    dueDate: string | null;
    priority: Priority;
    labels: string[];
    projectId: string | null;
  };
}

@Component({
  selector: 'app-task-quick-actions-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    BrnPopoverImports,
    LabelIconComponent,
    PickerFocusTrapDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      #triggerButton
      type="button"
      class="quick-action-trigger"
      [class.quick-action-trigger-open]="isOpen()"
      [disabled]="disabled()"
      [attr.aria-label]="triggerAriaLabel()"
      [attr.aria-expanded]="isOpen()"
      [attr.aria-haspopup]="'dialog'"
      brnPopoverTrigger
      [brnPopoverTriggerFor]="popover"
      (click)="$event.stopPropagation()"
      (keydown)="$event.stopPropagation()"
    >
      <fa-icon [icon]="faEllipsis" aria-hidden="true" />
    </button>

    <brn-popover
      #popover="brnPopover"
      [align]="align()"
      [sideOffset]="sideOffset()"
      [aria-label]="'Quick actions for ' + task().title"
      [aria-modal]="false"
      (stateChanged)="onStateChanged($event)"
      class="task-quick-actions-popover"
    >
      <ng-template brnPopoverContent>
        <div
          class="quick-actions-panel"
          appPickerFocusTrap
          (click)="$event.stopPropagation()"
          (keydown.escape)="onEscape($event)"
        >
          <!-- Header Bar with Reset Changes -->
          <div class="panel-header">
            <span class="panel-title">Quick actions</span>
            @if (isDirty()) {
              <button
                type="button"
                class="reset-changes-button"
                (click)="resetDraft($event)"
                aria-label="Reset draft changes"
              >
                <fa-icon [icon]="faRotateLeft" class="reset-icon" aria-hidden="true" />
                <span>Reset changes</span>
              </button>
            }
          </div>

          <div class="panel-scroll-area">
            <!-- 1. Schedule Presets -->
            <section class="section-group" role="group" aria-labelledby="quick-schedule-label">
              <span id="quick-schedule-label" class="section-title">Schedule</span>
              <div class="schedule-presets-grid" role="group" aria-label="Schedule presets">
                <button
                  type="button"
                  class="preset-button"
                  [class.preset-button-active]="isTodaySelected()"
                  [attr.aria-pressed]="isTodaySelected()"
                  (click)="setSchedule(todayDate())"
                >
                  <fa-icon [icon]="faCalendarDay" class="preset-icon" aria-hidden="true" />
                  <span>Today</span>
                  @if (isTodaySelected()) {
                    <fa-icon [icon]="faCheck" class="check-icon" aria-hidden="true" />
                  }
                </button>

                <button
                  type="button"
                  class="preset-button"
                  [class.preset-button-active]="isTomorrowSelected()"
                  [attr.aria-pressed]="isTomorrowSelected()"
                  (click)="setSchedule(tomorrowDate())"
                >
                  <fa-icon [icon]="faCalendarDay" class="preset-icon" aria-hidden="true" />
                  <span>Tomorrow</span>
                  @if (isTomorrowSelected()) {
                    <fa-icon [icon]="faCheck" class="check-icon" aria-hidden="true" />
                  }
                </button>

                <button
                  type="button"
                  class="preset-button"
                  [class.preset-button-active]="isNextWeekSelected()"
                  [attr.aria-pressed]="isNextWeekSelected()"
                  (click)="setSchedule(nextWeekDate())"
                >
                  <fa-icon [icon]="faCalendarDay" class="preset-icon" aria-hidden="true" />
                  <span>Next week</span>
                  @if (isNextWeekSelected()) {
                    <fa-icon [icon]="faCheck" class="check-icon" aria-hidden="true" />
                  }
                </button>

                <button
                  type="button"
                  class="preset-button"
                  [class.preset-button-active]="isNoDateSelected()"
                  [attr.aria-pressed]="isNoDateSelected()"
                  (click)="setSchedule(null)"
                >
                  <fa-icon [icon]="faXmark" class="preset-icon" aria-hidden="true" />
                  <span>No date</span>
                  @if (isNoDateSelected()) {
                    <fa-icon [icon]="faCheck" class="check-icon" aria-hidden="true" />
                  }
                </button>
              </div>

              @if (isCustomDateSelected()) {
                <div class="custom-date-indicator">
                  <span>Custom date: {{ customDateLabel() }}</span>
                </div>
              }
            </section>

            <!-- 2. Priority -->
            <section class="section-group" role="group" aria-labelledby="quick-priority-label">
              <span id="quick-priority-label" class="section-title">Priority</span>
              <div class="priority-options-row" role="group" aria-label="Priority options">
                @for (p of priorities; track p) {
                  <button
                    type="button"
                    class="priority-button"
                    [class.priority-button-active]="draftPriority() === p"
                    [class.priority-button-high]="p === 'high'"
                    [class.priority-button-medium]="p === 'medium'"
                    [class.priority-button-low]="p === 'low'"
                    [attr.aria-pressed]="draftPriority() === p"
                    (click)="setPriority(p)"
                  >
                    <fa-icon [icon]="faFlag" class="priority-flag" aria-hidden="true" />
                    <span>{{ p | titlecase }}</span>
                    @if (draftPriority() === p) {
                      <fa-icon [icon]="faCheck" class="check-icon" aria-hidden="true" />
                    }
                  </button>
                }
              </div>
            </section>

            <!-- 3. Labels -->
            <section class="section-group" role="group" aria-labelledby="quick-labels-label">
              <div class="section-header-row">
                <span id="quick-labels-label" class="section-title">Labels</span>
                @if (draftLabels().length > 0) {
                  <span class="badge-count">{{ draftLabels().length }}</span>
                }
              </div>

              <div class="filter-box">
                <fa-icon [icon]="faMagnifyingGlass" class="filter-search-icon" aria-hidden="true" />
                <input
                  type="text"
                  class="filter-input"
                  placeholder="Filter labels..."
                  aria-label="Filter labels"
                  [ngModel]="labelSearch()"
                  (ngModelChange)="labelSearch.set($event)"
                  (click)="$event.stopPropagation()"
                  (keydown)="onFilterKeydown($event)"
                />
                @if (labelSearch()) {
                  <button
                    type="button"
                    class="filter-clear-button"
                    (click)="labelSearch.set('')"
                    aria-label="Clear label filter"
                  >
                    <fa-icon [icon]="faXmark" aria-hidden="true" />
                  </button>
                }
              </div>

              <div class="options-list" role="group" aria-label="Labels selection">
                @for (label of filteredLabels(); track label.id) {
                  <button
                    type="button"
                    class="option-row"
                    [class.option-row-selected]="isLabelSelected(label.id)"
                    (click)="toggleLabel(label.id)"
                    [attr.aria-pressed]="isLabelSelected(label.id)"
                  >
                    <app-label-icon [icon]="label.icon" [color]="label.color" size="sm" />
                    <span class="option-name">{{ label.name }}</span>
                    @if (isLabelSelected(label.id)) {
                      <fa-icon [icon]="faCheck" class="option-check" aria-hidden="true" />
                    }
                  </button>
                } @empty {
                  <p class="empty-hint">
                    {{ allLabels().length === 0 ? 'No labels created yet' : 'No matching labels' }}
                  </p>
                }
              </div>
            </section>

            <!-- 4. Project -->
            <section class="section-group" role="group" aria-labelledby="quick-project-label">
              <div class="section-header-row">
                <span id="quick-project-label" class="section-title">Project</span>
              </div>

              <div class="filter-box">
                <fa-icon [icon]="faMagnifyingGlass" class="filter-search-icon" aria-hidden="true" />
                <input
                  type="text"
                  class="filter-input"
                  placeholder="Filter projects..."
                  aria-label="Filter projects"
                  [ngModel]="projectSearch()"
                  (ngModelChange)="projectSearch.set($event)"
                  (click)="$event.stopPropagation()"
                  (keydown)="onFilterKeydown($event)"
                />
                @if (projectSearch()) {
                  <button
                    type="button"
                    class="filter-clear-button"
                    (click)="projectSearch.set('')"
                    aria-label="Clear project filter"
                  >
                    <fa-icon [icon]="faXmark" aria-hidden="true" />
                  </button>
                }
              </div>

              <div class="options-list" role="group" aria-label="Project options">
                @if (shouldShowNoProjectOption()) {
                  <button
                    type="button"
                    class="option-row"
                    [class.option-row-selected]="draftProjectId() === null"
                    (click)="setProject(null)"
                    [attr.aria-pressed]="draftProjectId() === null"
                  >
                    <span class="project-dot project-dot-empty" aria-hidden="true"></span>
                    <span class="option-name">No project</span>
                    @if (draftProjectId() === null) {
                      <fa-icon [icon]="faCheck" class="option-check" aria-hidden="true" />
                    }
                  </button>
                }

                @for (project of filteredProjects(); track project.id) {
                  <button
                    type="button"
                    class="option-row"
                    [class.option-row-selected]="draftProjectId() === project.id"
                    (click)="setProject(project.id)"
                    [attr.aria-pressed]="draftProjectId() === project.id"
                  >
                    <span
                      class="project-dot"
                      [style.background]="getProjectAccent(project.color)"
                      aria-hidden="true"
                    ></span>
                    <span class="option-name">{{ project.name }}</span>
                    @if (draftProjectId() === project.id) {
                      <fa-icon [icon]="faCheck" class="option-check" aria-hidden="true" />
                    }
                  </button>
                } @empty {
                  @if (projectSearch().trim() && !shouldShowNoProjectOption()) {
                    <p class="empty-hint">No matching projects</p>
                  }
                }
              </div>
            </section>
          </div>

          <!-- Footer Actions -->
          <div class="panel-footer">
            <button type="button" class="action-row" (click)="handleOpenDetails($event)">
              <fa-icon [icon]="faArrowUpRightFromSquare" class="action-icon" aria-hidden="true" />
              <span>Open details</span>
            </button>

            <button
              type="button"
              class="action-row action-row-danger"
              (click)="handleDeleteTask($event)"
            >
              <fa-icon [icon]="faTrash" class="action-icon" aria-hidden="true" />
              <span>Delete task</span>
            </button>
          </div>
        </div>
      </ng-template>
    </brn-popover>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .quick-action-trigger {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--on-surface-subtle);
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 0.35rem;
        display: grid;
        place-items: center;
        cursor: pointer;
        padding: 0;
        font-size: 0.85rem;
        transition:
          background-color 100ms ease,
          color 100ms ease;
      }

      .quick-action-trigger:hover,
      .quick-action-trigger-open {
        background: var(--surface-container-high);
        color: var(--on-surface);
      }

      .quick-action-trigger:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      .quick-action-trigger:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (max-width: 720px), (pointer: coarse) {
        .quick-action-trigger {
          min-width: 2.75rem;
          min-height: 2.75rem;
          font-size: 1rem;
        }
      }

      .quick-actions-panel {
        display: flex;
        flex-direction: column;
        width: min(
          20rem,
          calc(100vw - 2rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))
        );
        max-height: min(26rem, 80vh);
        max-height: min(26rem, 80dvh);
        background: var(--surface-card);
        border-radius: 0.75rem;
        box-shadow:
          0 10px 30px var(--surface-dim),
          inset 0 0 0 1px var(--outline-variant);
        color: var(--on-surface);
        outline: none;
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.65rem 0.85rem 0.45rem;
        border-bottom: 1px solid var(--outline-variant);
        gap: 0.5rem;
      }

      .panel-title {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--on-surface-subtle);
      }

      .reset-changes-button {
        appearance: none;
        border: 0;
        background: var(--primary-soft);
        color: var(--primary-solid);
        border-radius: 999px;
        padding: 0.18rem 0.5rem;
        font-size: 0.68rem;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        transition: background-color 100ms ease;
      }

      .reset-changes-button:hover {
        background: var(--primary-soft-strong);
      }

      .reset-icon {
        font-size: 0.62rem;
      }

      .panel-scroll-area {
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding: 0.6rem 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .section-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }

      .section-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .section-title {
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--on-surface-subtle);
      }

      .badge-count {
        background: var(--primary-soft);
        color: var(--primary-solid);
        font-size: 0.62rem;
        font-weight: 700;
        padding: 0.05rem 0.35rem;
        border-radius: 999px;
      }

      .schedule-presets-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.35rem;
      }

      .preset-button {
        appearance: none;
        border: 0;
        background: var(--surface-container-low);
        color: var(--on-surface);
        border-radius: 0.45rem;
        padding: 0.35rem 0.5rem;
        font-size: 0.74rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        transition:
          background-color 100ms ease,
          color 100ms ease;
      }

      .preset-button:hover {
        background: var(--surface-container-high);
      }

      .preset-button-active {
        background: var(--primary-soft);
        color: var(--primary-solid);
        font-weight: 700;
      }

      .preset-icon {
        font-size: 0.7rem;
        opacity: 0.8;
      }

      .check-icon {
        margin-left: auto;
        font-size: 0.65rem;
      }

      .custom-date-indicator {
        font-size: 0.68rem;
        color: var(--on-surface-muted);
        padding: 0.1rem 0.2rem;
      }

      .priority-options-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.35rem;
      }

      .priority-button {
        appearance: none;
        border: 0;
        background: var(--surface-container-low);
        color: var(--on-surface);
        border-radius: 0.45rem;
        padding: 0.35rem 0.45rem;
        font-size: 0.74rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        transition: all 100ms ease;
      }

      .priority-button:hover {
        background: var(--surface-container-high);
      }

      .priority-button-active {
        box-shadow: inset 0 0 0 1.5px var(--primary-solid);
        background: var(--surface-container-high);
        font-weight: 700;
      }

      .priority-button-high .priority-flag {
        color: var(--priority-high);
      }

      .priority-button-medium .priority-flag {
        color: var(--priority-medium);
      }

      .priority-button-low .priority-flag {
        color: var(--priority-low);
      }

      .filter-box {
        position: relative;
        display: flex;
        align-items: center;
        background: var(--surface-container-lowest);
        border-radius: 0.45rem;
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 0.25rem 0.5rem;
        gap: 0.35rem;
      }

      .filter-search-icon {
        font-size: 0.68rem;
        color: var(--on-surface-subtle);
      }

      .filter-input {
        appearance: none;
        border: 0;
        background: transparent;
        font-size: 0.75rem;
        color: var(--on-surface);
        width: 100%;
        outline: none;
        padding: 0;
        margin: 0;
      }

      .filter-clear-button {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--on-surface-subtle);
        cursor: pointer;
        padding: 0;
        font-size: 0.7rem;
        display: grid;
        place-items: center;
      }

      .filter-clear-button:hover {
        color: var(--on-surface);
      }

      .options-list {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        max-height: 7.5rem;
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }

      .option-row {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--on-surface);
        border-radius: 0.4rem;
        padding: 0.3rem 0.45rem;
        font-size: 0.75rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.45rem;
        width: 100%;
        text-align: left;
        transition: background-color 100ms ease;
      }

      .option-row:hover {
        background: var(--surface-container-high);
      }

      .option-row-selected {
        background: var(--surface-container-low);
        font-weight: 600;
      }

      .option-name {
        min-width: 0;
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .option-check {
        margin-left: auto;
        color: var(--primary-solid);
        font-size: 0.68rem;
        flex-shrink: 0;
      }

      .project-dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 999px;
        flex-shrink: 0;
      }

      .project-dot-empty {
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        background: transparent;
      }

      .empty-hint {
        margin: 0.35rem 0;
        font-size: 0.72rem;
        color: var(--on-surface-subtle);
        text-align: center;
      }

      .panel-footer {
        border-top: 1px solid var(--outline-variant);
        padding: 0.35rem 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        background: var(--surface-container-lowest);
      }

      .action-row {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--on-surface);
        border-radius: 0.4rem;
        padding: 0.35rem 0.55rem;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        text-align: left;
        transition: background-color 100ms ease;
      }

      .action-row:hover {
        background: var(--surface-container-high);
      }

      .action-row-danger {
        color: var(--status-overdue);
      }

      .action-row-danger:hover {
        background: var(--error-soft);
      }

      .action-icon {
        font-size: 0.72rem;
        width: 0.85rem;
        text-align: center;
      }

      @media (max-width: 720px), (pointer: coarse) {
        .filter-box {
          min-height: 2.75rem;
        }

        .filter-input {
          min-height: 2.75rem;
        }

        .filter-clear-button {
          min-width: 2.75rem;
          min-height: 2.75rem;
        }

        .preset-button,
        .priority-button,
        .option-row,
        .action-row {
          min-height: 2.75rem;
        }

        .reset-changes-button {
          min-height: 2.75rem;
          padding-inline: 0.75rem;
        }
      }
    `,
  ],
})
export class TaskQuickActionsMenuComponent {
  private readonly labelService = inject(LabelService);
  private readonly projectService = inject(ProjectService);
  private readonly coordinator = inject(TaskQuickActionsCoordinatorService);

  readonly task = input.required<Task>();
  readonly disabled = input(false);
  readonly align = input<'start' | 'center' | 'end'>('end');
  readonly sideOffset = input(6);

  readonly saveChanges = output<TaskQuickActionsSaveEvent>();
  readonly discard = output<void>();
  readonly openDetails = output<void>();
  readonly deleteTask = output<void>();

  private readonly popover = viewChild(BrnPopover);

  protected readonly isOpen = signal(false);
  protected discarded = false;

  // Staged local draft
  protected readonly draftDueDate = signal<string | null>(null);
  protected readonly draftPriority = signal<Priority>('medium');
  protected readonly draftLabels = signal<string[]>([]);
  protected readonly draftProjectId = signal<string | null>(null);
  private readonly initialTask = signal<Task | null>(null);

  // Search filters
  protected readonly labelSearch = signal('');
  protected readonly projectSearch = signal('');

  protected readonly priorities: Priority[] = ['high', 'medium', 'low'];
  protected readonly faEllipsis = faEllipsis;
  protected readonly faFlag = faFlag;
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly faCalendarDay = faCalendarDay;
  protected readonly faCheck = faCheck;
  protected readonly faXmark = faXmark;
  protected readonly faMagnifyingGlass = faMagnifyingGlass;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  protected readonly faTrash = faTrash;

  // Schedule dates
  protected readonly todayDate = computed(() => startOfToday().toFormat('yyyy-MM-dd'));
  protected readonly tomorrowDate = computed(() =>
    startOfToday().plus({ days: 1 }).toFormat('yyyy-MM-dd'),
  );
  protected readonly nextWeekDate = computed(() => {
    const today = startOfToday();
    const daysUntilNextMonday = (8 - today.weekday) % 7 || 7;
    return today.plus({ days: daysUntilNextMonday }).toFormat('yyyy-MM-dd');
  });

  protected readonly isTodaySelected = computed(() => this.draftDueDate() === this.todayDate());
  protected readonly isTomorrowSelected = computed(
    () => this.draftDueDate() === this.tomorrowDate(),
  );
  protected readonly isNextWeekSelected = computed(
    () => this.draftDueDate() === this.nextWeekDate(),
  );
  protected readonly isNoDateSelected = computed(() => this.draftDueDate() === null);
  protected readonly isCustomDateSelected = computed(() => {
    const d = this.draftDueDate();
    if (!d) return false;
    return d !== this.todayDate() && d !== this.tomorrowDate() && d !== this.nextWeekDate();
  });
  protected readonly customDateLabel = computed(() => {
    const parsed = parseCalendarDate(this.draftDueDate());
    return parsed ? parsed.toFormat('MMM d, yyyy') : '';
  });

  // Labels and Projects options
  protected readonly allLabels = this.labelService.labels;
  protected readonly allProjects = this.projectService.projects;

  protected readonly filteredLabels = computed(() => {
    const query = this.labelSearch().trim().toLowerCase();
    const labels = this.allLabels();
    if (!query) return labels;
    return labels.filter((label) => label.name.toLowerCase().includes(query));
  });

  protected readonly filteredProjects = computed(() => {
    const query = this.projectSearch().trim().toLowerCase();
    const projects = this.allProjects();
    if (!query) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(query));
  });

  protected readonly shouldShowNoProjectOption = computed(() => {
    const query = this.projectSearch().trim().toLowerCase();
    if (!query) return true;
    return 'no project'.includes(query);
  });

  /**
   * Evaluates if the current local draft differs from the initial task snapshot.
   */
  readonly isDirty = computed(() => {
    const task = this.initialTask();
    if (!task) return false;
    const origDueDate = task.dueDate ?? null;
    const origPriority = task.priority;
    const origLabels = task.labels ?? [];
    const origProjectId = task.projectId ?? null;

    if (this.draftDueDate() !== origDueDate) return true;
    if (this.draftPriority() !== origPriority) return true;
    if (this.draftProjectId() !== origProjectId) return true;

    return !this.sameLabels(this.draftLabels(), origLabels);
  });

  constructor() {
    // Coordinate open menu: if another task's menu opens, automatically close this one.
    effect(() => {
      const activeId = this.coordinator.activeTaskId();
      const currentTaskId = this.task().id;
      if (activeId !== null && activeId !== currentTaskId && untracked(() => this.isOpen())) {
        untracked(() => this.close());
      }
    });
  }

  protected triggerAriaLabel(): string {
    return `Quick actions for ${this.task().title}`;
  }

  protected initializeDraft(): void {
    const task = this.task();
    this.initialTask.set({ ...task, labels: [...(task.labels ?? [])] });
    this.draftDueDate.set(task.dueDate ?? null);
    this.draftPriority.set(task.priority);
    this.draftLabels.set([...(task.labels ?? [])]);
    this.draftProjectId.set(task.projectId ?? null);
    this.labelSearch.set('');
    this.projectSearch.set('');
    this.discarded = false;
  }

  protected resetDraft(event?: MouseEvent): void {
    event?.stopPropagation();
    this.initializeDraft();
  }

  protected setSchedule(date: string | null): void {
    this.draftDueDate.set(date);
  }

  protected setPriority(priority: Priority): void {
    this.draftPriority.set(priority);
  }

  protected isLabelSelected(labelId: string): boolean {
    return this.draftLabels().includes(labelId);
  }

  protected toggleLabel(labelId: string): void {
    const current = this.draftLabels();
    if (current.includes(labelId)) {
      this.draftLabels.set(current.filter((id) => id !== labelId));
    } else {
      this.draftLabels.set([...current, labelId]);
    }
  }

  protected setProject(projectId: string | null): void {
    this.draftProjectId.set(projectId);
  }

  protected getProjectAccent(color?: ProjectColor): string {
    return projectPaletteFor(color).accent;
  }

  protected onEscape(event: Event): void {
    event.stopPropagation();
    this.discarded = true;
    this.popover()?.close();
  }

  protected onFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.onEscape(event);
      return;
    }

    event.stopPropagation();
  }

  protected handleOpenDetails(event: MouseEvent): void {
    event.stopPropagation();
    this.discarded = true;
    this.popover()?.close();
    this.openDetails.emit();
  }

  protected handleDeleteTask(event: MouseEvent): void {
    event.stopPropagation();
    this.discarded = true;
    this.popover()?.close();
    this.deleteTask.emit();
  }

  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'open') {
      this.isOpen.set(true);
      this.initializeDraft();
      this.coordinator.open(this.task().id);
    } else {
      this.isOpen.set(false);
      this.coordinator.close(this.task().id);

      if (this.discarded) {
        this.discarded = false;
        this.discard.emit();
      } else if (this.isDirty()) {
        const diff = this.computeDiff();
        this.saveChanges.emit({
          taskId: this.task().id,
          diff,
          draft: {
            dueDate: this.draftDueDate(),
            priority: this.draftPriority(),
            labels: this.draftLabels(),
            projectId: this.draftProjectId(),
          },
        });
      }
    }
  }

  /**
   * Programmatic open.
   */
  open(): void {
    this.popover()?.open();
  }

  /**
   * Programmatic close.
   */
  close(): void {
    this.popover()?.close();
  }

  private computeDiff(): UpdateTaskDto {
    const task = this.initialTask();
    if (!task) return {};
    const diff: UpdateTaskDto = {};

    const origDueDate = task.dueDate ?? null;
    if (this.draftDueDate() !== origDueDate) {
      diff.dueDate = this.draftDueDate();
    }

    if (this.draftPriority() !== task.priority) {
      diff.priority = this.draftPriority();
    }

    const currentLabels = this.draftLabels();
    if (!this.sameLabels(currentLabels, task.labels ?? [])) {
      diff.labels = currentLabels;
    }

    const origProjectId = task.projectId ?? null;
    if (this.draftProjectId() !== origProjectId) {
      diff.projectId = this.draftProjectId();
    }

    return diff;
  }

  private sameLabels(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    return leftSet.size === rightSet.size && [...leftSet].every((labelId) => rightSet.has(labelId));
  }
}
