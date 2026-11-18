import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { BatchTaskPatchDto, Priority, ProjectSection, Task } from '@yotara/shared';
import { TaskService } from '../../../core/services/task.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../shared/ui/date-picker/date-picker.component';

export const MAX_BATCH_TASKS = 100;

export interface AddExistingTasksPayload {
  taskIds: string[];
  patch: BatchTaskPatchDto;
}

@Component({
  selector: 'app-add-existing-tasks-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, DatePickerComponent],
  template: `
    <app-modal
      [open]="open"
      [title]="'Add existing tasks to ' + (projectName || 'project')"
      size="lg"
      (close)="close.emit()"
    >
      <div class="picker-content">
        <p class="picker-hint">
          Pick tasks that don't have a project yet. They'll move into this project together.
        </p>

        <div class="metadata-bar">
          <label class="metadata-field">
            <span class="field-copy">
              <span class="field-label">Section</span>
              <select
                class="field-select"
                [ngModel]="sectionId()"
                (ngModelChange)="sectionId.set($event)"
              >
                <option [ngValue]="null">No section</option>
                @for (section of sections; track section.id) {
                  <option [ngValue]="section.id">{{ section.name }}</option>
                }
              </select>
            </span>
          </label>
          <label class="metadata-field">
            <span class="field-copy">
              <span class="field-label">Priority</span>
              <select
                class="field-select"
                [ngModel]="priority()"
                (ngModelChange)="priority.set($event)"
              >
                <option value="">No change</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </span>
          </label>
          <app-date-picker
            class="metadata-date"
            [value]="dueDate()"
            (valueChange)="dueDate.set($event)"
            label="Due date"
          />
        </div>

        @if (loading()) {
          <p class="picker-status">Loading unassigned tasks...</p>
        } @else if (loadError()) {
          <p class="picker-status">{{ loadError() }}</p>
        } @else if (tasks().length === 0) {
          <p class="picker-status">There are no tasks without a project right now.</p>
        } @else {
          <input
            type="search"
            class="task-filter"
            placeholder="Filter tasks..."
            aria-label="Filter unassigned tasks"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />

          <label class="select-all">
            <input type="checkbox" [checked]="allSelected()" (change)="toggleAll()" />
            <span>
              Select all ({{ filteredTasks().length }})
              @if (filteredTasks().length > maxBatchTasks) {
                <span class="cap-note">— first {{ maxBatchTasks }} will be selected</span>
              }
            </span>
          </label>

          @if (selected().size >= maxBatchTasks) {
            <p class="cap-warning" role="status">
              Maximum limit of {{ maxBatchTasks }} tasks reached for this batch.
            </p>
          }

          <ul class="task-list">
            @for (task of filteredTasks(); track task.id) {
              <li>
                <label>
                  <input
                    type="checkbox"
                    [checked]="selected().has(task.id)"
                    [disabled]="selected().size >= maxBatchTasks && !selected().has(task.id)"
                    (change)="toggle(task.id)"
                  />
                  <span class="task-title">{{ task.title }}</span>
                  @if (task.dueDate) {
                    <span class="task-meta">{{ task.dueDate }}</span>
                  }
                </label>
              </li>
            }
          </ul>
        }
      </div>

      <div modal-footer class="picker-actions">
        <button type="button" class="secondary-button" (click)="close.emit()">Cancel</button>
        <button
          type="button"
          class="primary-button"
          [disabled]="selected().size === 0 || selected().size > maxBatchTasks || saving"
          (click)="confirm()"
        >
          {{
            saving
              ? 'Adding...'
              : 'Add ' + selected().size + (selected().size === 1 ? ' task' : ' tasks')
          }}
        </button>
      </div>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: contents;
      }

      .picker-content {
        display: grid;
        gap: 0.85rem;
      }

      .picker-hint,
      .picker-status {
        margin: 0;
        color: var(--on-surface-muted);
        font-size: 0.9rem;
      }

      .metadata-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      /* Mirror the date picker trigger so all three metadata controls match. */
      .metadata-bar .metadata-field {
        box-sizing: border-box;
        flex: 1 1 9rem;
        min-height: 3.05rem;
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.78rem 0.92rem;
        border-radius: 0.95rem;
        background: var(--surface-container-lowest);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .metadata-bar .metadata-date {
        flex: 1 1 11rem;
      }

      .metadata-bar .field-copy {
        min-width: 0;
        display: grid;
        gap: 0.14rem;
      }

      .metadata-bar .field-label {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.68rem;
        font-weight: 800;
        color: var(--on-surface-subtle);
      }

      .metadata-bar .field-select {
        width: 100%;
        min-width: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--on-surface);
        font: inherit;
        font-size: 0.96rem;
        font-weight: 700;
        cursor: pointer;
      }

      .task-filter {
        width: 100%;
        min-height: 2.25rem;
        padding: 0 0.6rem;
        border: 1px solid var(--outline-variant);
        border-radius: 0.6rem;
        background: var(--surface-card);
        color: var(--on-surface);
        font: inherit;
      }

      .select-all {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        font-weight: 700;
      }

      .cap-warning {
        margin: 0;
        padding: 0.45rem 0.75rem;
        border-radius: 0.65rem;
        background: color-mix(in srgb, var(--status-pending) 12%, transparent);
        color: var(--status-pending);
        font-size: 0.82rem;
        font-weight: 600;
      }

      .cap-note {
        color: var(--on-surface-muted);
        font-size: 0.78rem;
        font-weight: 500;
      }

      .task-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.2rem;
        max-height: 18rem;
        overflow-y: auto;
        border: 1px solid var(--outline-variant);
        border-radius: 0.75rem;
      }

      .task-list li label {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.55rem 0.75rem;
        cursor: pointer;
      }

      .task-list li + li label {
        border-top: 1px solid var(--outline-variant);
      }

      .task-title {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .task-meta {
        color: var(--on-surface-muted);
        font-size: 0.78rem;
        white-space: nowrap;
      }

      .picker-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
      }

      .primary-button,
      .secondary-button {
        border: 0;
        border-radius: 0.9rem;
        min-height: 2.5rem;
        padding: 0 1rem;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        transition: all 180ms ease;
      }

      .primary-button:hover:not(:disabled),
      .secondary-button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px var(--surface-dim-strong);
      }

      .primary-button:disabled,
      .secondary-button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .primary-button {
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
      }

      .secondary-button {
        background: var(--surface-container-high);
        color: var(--on-surface-muted);
      }
    `,
  ],
})
export class AddExistingTasksModalComponent implements OnChanges {
  @Input() open = false;
  @Input() projectId = '';
  @Input() projectName = '';
  @Input() sections: ProjectSection[] = [];
  @Input() saving = false;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly add = new EventEmitter<AddExistingTasksPayload>();

  private readonly taskService = inject(TaskService);

  protected readonly tasks = signal<Task[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly query = signal('');
  protected readonly sectionId = signal<string | null>(null);
  protected readonly priority = signal<Priority | ''>('');
  protected readonly dueDate = signal('');
  protected readonly maxBatchTasks = MAX_BATCH_TASKS;

  protected readonly filteredTasks = computed(() => {
    const query = this.query().trim().toLowerCase();
    const tasks = this.tasks();
    return query ? tasks.filter((task) => task.title.toLowerCase().includes(query)) : tasks;
  });

  protected readonly allSelected = computed(() => {
    const visible = this.filteredTasks();
    if (visible.length === 0) {
      return false;
    }
    const targetCount = Math.min(visible.length, this.maxBatchTasks);
    const selectedVisibleCount = visible.filter((task) => this.selected().has(task.id)).length;
    return selectedVisibleCount >= targetCount;
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['open']?.currentValue === true) {
      this.load();
    }
  }

  private load() {
    this.selected.set(new Set());
    this.query.set('');
    this.sectionId.set(null);
    this.priority.set('');
    this.dueDate.set('');
    this.loading.set(true);
    this.loadError.set(null);
    // Subtasks are excluded from the unassigned picker by default; they belong to
    // their parent task and inherit its project assignment automatically.
    this.taskService.getUnassignedTasks().subscribe({
      next: (response) => {
        this.tasks.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load unassigned tasks right now.');
        this.loading.set(false);
      },
    });
  }

  protected toggle(taskId: string) {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else if (next.size < this.maxBatchTasks) {
        next.add(taskId);
      }
      return next;
    });
  }

  protected toggleAll() {
    const ids = this.filteredTasks().map((task) => task.id);
    this.selected.update((current) => {
      const next = new Set(current);
      const targetCount = Math.min(ids.length, this.maxBatchTasks);
      const selectedVisibleCount = ids.filter((id) => next.has(id)).length;
      const allVisibleSelected = selectedVisibleCount >= targetCount && targetCount > 0;

      if (allVisibleSelected) {
        for (const id of ids) {
          next.delete(id);
        }
      } else {
        for (const id of ids) {
          if (next.size >= this.maxBatchTasks) {
            break;
          }
          next.add(id);
        }
      }
      return next;
    });
  }

  protected confirm() {
    if (
      this.selected().size === 0 ||
      this.selected().size > this.maxBatchTasks ||
      !this.projectId
    ) {
      return;
    }

    const patch: BatchTaskPatchDto = {
      projectId: this.projectId,
      sectionId: this.sectionId(),
    };
    if (this.priority()) {
      patch.priority = this.priority() as Priority;
    }
    if (this.dueDate()) {
      patch.dueDate = this.dueDate();
    }

    this.add.emit({ taskIds: [...this.selected()], patch });
  }
}
