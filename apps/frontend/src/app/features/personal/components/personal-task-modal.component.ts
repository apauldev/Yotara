import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateTaskDto,
  Priority,
  Task,
  TaskBucket,
  TaskStatus,
  UpdateTaskDto,
} from '@yotara/shared';

interface BucketOption {
  value: TaskBucket;
  label: string;
}

type SavePayload =
  | { mode: 'create'; payload: CreateTaskDto }
  | { mode: 'update'; taskId: string; payload: UpdateTaskDto };

@Component({
  selector: 'app-personal-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div class="modal-shell">
        <button
          type="button"
          class="backdrop"
          aria-label="Close task modal"
          (click)="close.emit()"
        ></button>

        <section
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
        >
          <div class="modal-main">
            <header class="modal-header">
              <div class="title-row">
                <div class="completion-dot" [class.completion-dot-complete]="draftCompleted()">
                  @if (draftCompleted()) {
                    ✓
                  }
                </div>
                <div>
                  <h2 id="task-modal-title">
                    {{ task ? 'Refine task details' : 'Capture a new task' }}
                  </h2>
                  <p>{{ selectedBucketLabel() }}</p>
                </div>
              </div>

              <button
                type="button"
                class="close-button"
                aria-label="Close task modal"
                (click)="close.emit()"
              >
                ×
              </button>
            </header>

            <label class="field">
              <span class="field-label">Title</span>
              <input
                type="text"
                name="taskTitle"
                [ngModel]="draftTitle()"
                (ngModelChange)="draftTitle.set($event)"
                [class.field-error]="titleError()"
                placeholder="Redesign sanctuary garden layout"
              />
              @if (titleError()) {
                <p class="field-error-message">{{ titleError() }}</p>
              }
            </label>

            <label class="field">
              <span class="field-label">Description</span>
              <textarea
                name="taskDescription"
                rows="7"
                [ngModel]="draftDescription()"
                (ngModelChange)="draftDescription.set($event)"
                [class.field-error]="descriptionError()"
                placeholder="Capture extra context, constraints, or subtasks here."
              ></textarea>
              @if (descriptionError()) {
                <p class="field-error-message">{{ descriptionError() }}</p>
              }
            </label>

            <div class="field">
              <span class="field-label">Bucket</span>
              <div class="bucket-grid">
                @for (bucket of buckets; track bucket.value) {
                  <button
                    type="button"
                    class="bucket-chip"
                    [class.bucket-chip-active]="draftBucket() === bucket.value"
                    (click)="draftBucket.set(bucket.value)"
                  >
                    {{ bucket.label }}
                  </button>
                }
              </div>
            </div>
          </div>

          <aside class="modal-sidebar">
            <div class="sidebar-section">
              <span class="field-label">Simple mode</span>
              <label class="toggle-row">
                <span>Keep it lightweight with no date metadata</span>
                <input
                  type="checkbox"
                  [ngModel]="draftSimpleMode()"
                  (ngModelChange)="onSimpleModeChange($event)"
                />
              </label>
            </div>

            <div class="sidebar-section">
              <span class="field-label">Schedule</span>
              <label class="field compact-field">
                <input
                  type="date"
                  name="taskDueDate"
                  [ngModel]="draftDueDate()"
                  (ngModelChange)="draftDueDate.set($event)"
                  [class.field-error]="dueDateError()"
                  [disabled]="draftSimpleMode()"
                />
              </label>
              @if (dueDateError()) {
                <p class="field-error-message">{{ dueDateError() }}</p>
              }
            </div>

            <div class="sidebar-section">
              <span class="field-label">Priority</span>
              <div class="priority-dots">
                @for (option of priorities; track option) {
                  <button
                    type="button"
                    class="priority-dot"
                    [class.priority-dot-active]="draftPriority() === option"
                    [class.priority-dot-high]="option === 'high'"
                    [class.priority-dot-medium]="option === 'medium'"
                    [class.priority-dot-low]="option === 'low'"
                    (click)="draftPriority.set(option)"
                    [attr.aria-label]="option + ' priority'"
                  ></button>
                }
              </div>
            </div>

            <div class="sidebar-section">
              <span class="field-label">Status</span>
              <select
                class="status-select"
                [ngModel]="draftStatus()"
                (ngModelChange)="draftStatus.set($event)"
              >
                <option value="inbox">Inbox</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>

            <div class="sidebar-section">
              <span class="field-label">Completion</span>
              <label class="toggle-row">
                <span>Mark as completed</span>
                <input
                  type="checkbox"
                  [ngModel]="draftCompleted()"
                  (ngModelChange)="draftCompleted.set($event)"
                />
              </label>
            </div>

            @if (error) {
              <p class="error-copy">{{ error }}</p>
            }

            <div class="actions">
              <button type="button" class="secondary-button" (click)="close.emit()">Cancel</button>
              <button type="button" class="primary-button" (click)="submit()">
                {{ task ? 'Save Task' : 'Create Task' }}
              </button>
            </div>
          </aside>
        </section>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .modal-shell {
        position: fixed;
        inset: 0;
        z-index: 50;
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }

      .backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        background: rgba(47, 46, 39, 0.2);
        backdrop-filter: blur(6px);
      }

      .modal-card {
        position: relative;
        z-index: 1;
        width: min(100%, 64rem);
        max-height: min(90dvh, 46rem);
        overflow: auto;
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(16rem, 18rem);
        border-radius: 2rem;
        background: #f8f4e8;
        border: 1px solid rgba(229, 220, 200, 0.95);
        box-shadow: 0 30px 60px rgba(88, 79, 59, 0.15);
      }

      .modal-main {
        padding: 1.8rem 1.8rem 1.6rem;
      }

      .modal-sidebar {
        padding: 1.8rem 1.4rem 1.6rem;
        background: rgba(250, 246, 236, 0.7);
        border-left: 1px solid rgba(229, 220, 200, 0.95);
      }

      .modal-header,
      .title-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .title-row {
        justify-content: flex-start;
      }

      .completion-dot {
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 999px;
        border: 2px solid #4d966b;
        color: #f6fbf7;
        display: grid;
        place-items: center;
        font-size: 0.82rem;
        background: transparent;
      }

      .completion-dot-complete {
        background: #4d966b;
      }

      h2 {
        margin: 0;
        font-size: 2rem;
        line-height: 1.1;
        letter-spacing: -0.05em;
      }

      .title-row p {
        margin: 0.35rem 0 0;
        color: #4e8a67;
        font-size: 0.94rem;
      }

      .close-button {
        border: 0;
        background: transparent;
        color: #7d776b;
        font-size: 2rem;
        line-height: 1;
      }

      .field,
      .sidebar-section {
        display: grid;
        gap: 0.55rem;
        margin-top: 1.3rem;
      }

      .field-label {
        color: #9c957f;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.76rem;
        font-weight: 800;
      }

      input,
      textarea,
      select {
        width: 100%;
        border: 1px solid rgba(231, 222, 204, 0.95);
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.92);
        color: #2f302b;
        font: inherit;
        padding: 0.95rem 1rem;
        box-sizing: border-box;
      }

      input.field-error,
      textarea.field-error,
      select.field-error {
        border-color: #ba6d57;
        background-color: rgba(255, 245, 242, 0.92);
      }

      .field-error-message {
        color: #ba6d57;
        font-size: 0.875rem;
        margin: 0.35rem 0 0;
      }

      textarea {
        min-height: 11rem;
        resize: vertical;
        line-height: 1.6;
      }

      .compact-field {
        margin-top: 0;
      }

      .bucket-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }

      .bucket-chip {
        border: 1px solid rgba(221, 228, 213, 0.95);
        border-radius: 999px;
        background: #eef7f0;
        color: #497a60;
        padding: 0.5rem 0.8rem;
        font-weight: 700;
      }

      .bucket-chip-active {
        background: #d7f0de;
        border-color: #7db18f;
      }

      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.9rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(231, 222, 204, 0.95);
        padding: 0.85rem 1rem;
        color: #666156;
      }

      .toggle-row input {
        width: 1.1rem;
        height: 1.1rem;
        padding: 0;
      }

      .priority-dots {
        display: flex;
        gap: 0.65rem;
      }

      .priority-dot {
        width: 1.15rem;
        height: 1.15rem;
        border-radius: 999px;
        border: 0;
        background: #d9ddd4;
        box-shadow: inset 0 0 0 6px transparent;
      }

      .priority-dot-high.priority-dot-active {
        background: #d44d3c;
      }

      .priority-dot-medium.priority-dot-active {
        background: #d9a13d;
      }

      .priority-dot-low.priority-dot-active {
        background: #5a9a6d;
      }

      .priority-dot:not(.priority-dot-active) {
        opacity: 0.5;
      }

      .status-select {
        appearance: none;
      }

      .actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.7rem;
        margin-top: 1.4rem;
      }

      .primary-button,
      .secondary-button {
        border: 0;
        border-radius: 1rem;
        min-height: 3rem;
        font-weight: 700;
      }

      .primary-button {
        background: #256c47;
        color: #f7fbf6;
      }

      .secondary-button {
        background: #ece7d9;
        color: #5e5a50;
      }

      .error-copy {
        color: #ba6d57;
        font-size: 0.9rem;
        margin: 1rem 0 0;
      }

      @media (max-width: 880px) {
        .modal-card {
          grid-template-columns: 1fr;
        }

        .modal-sidebar {
          border-left: 0;
          border-top: 1px solid rgba(229, 220, 200, 0.95);
        }
      }
    `,
  ],
})
export class PersonalTaskModalComponent {
  @Input() open = false;
  @Input() task: Task | null = null;
  @Input() initialTitle = '';
  @Input() error: string | null = null;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<SavePayload>();

  protected readonly buckets: BucketOption[] = [
    { value: 'personal-sanctuary', label: 'Personal Sanctuary' },
    { value: 'deep-work', label: 'Deep Work' },
    { value: 'home', label: 'Home' },
    { value: 'health', label: 'Health' },
  ];
  protected readonly priorities: Priority[] = ['high', 'medium', 'low'];
  protected readonly draftTitle = signal('');
  protected readonly draftDescription = signal('');
  protected readonly draftStatus = signal<TaskStatus>('inbox');
  protected readonly draftPriority = signal<Priority>('medium');
  protected readonly draftDueDate = signal('');
  protected readonly draftSimpleMode = signal(true);
  protected readonly draftBucket = signal<TaskBucket>('personal-sanctuary');
  protected readonly draftCompleted = signal(false);

  // Validation state
  protected readonly titleError = signal<string | null>(null);
  protected readonly dueDateError = signal<string | null>(null);
  protected readonly descriptionError = signal<string | null>(null);

  ngOnChanges() {
    this.hydrateDraft();
  }

  protected selectedBucketLabel() {
    return this.buckets.find((bucket) => bucket.value === this.draftBucket())?.label ?? 'Bucket';
  }

  protected onSimpleModeChange(value: boolean) {
    this.draftSimpleMode.set(value);

    if (value) {
      this.draftDueDate.set('');
    }
  }

  protected validateTitle(): boolean {
    const title = this.draftTitle().trim();

    if (!title) {
      this.titleError.set('Title is required');
      return false;
    }

    if (title.length > 200) {
      this.titleError.set('Title must be less than 200 characters');
      return false;
    }

    this.titleError.set(null);
    return true;
  }

  protected validateDueDate(): boolean {
    if (this.draftSimpleMode()) {
      this.dueDateError.set(null);
      return true;
    }

    const dueDate = this.draftDueDate().trim();

    if (!dueDate) {
      this.dueDateError.set(null);
      return true;
    }

    // Basic date validation: check if it's a valid date format
    const dateObj = new Date(dueDate);
    if (isNaN(dateObj.getTime())) {
      this.dueDateError.set('Please enter a valid date');
      return false;
    }

    this.dueDateError.set(null);
    return true;
  }

  protected validateDescription(): boolean {
    // Description is optional by default; extend this if requirements change
    this.descriptionError.set(null);
    return true;
  }

  protected validateForm(): boolean {
    const titleValid = this.validateTitle();
    const dueDateValid = this.validateDueDate();
    const descriptionValid = this.validateDescription();

    return titleValid && dueDateValid && descriptionValid;
  }

  protected submit() {
    if (!this.validateForm()) {
      return;
    }

    const payload = {
      title,
      description: this.draftDescription().trim() || undefined,
      status: this.draftStatus(),
      priority: this.draftPriority(),
      dueDate: this.draftSimpleMode() ? undefined : this.draftDueDate() || undefined,
      simpleMode: this.draftSimpleMode(),
      bucket: this.draftBucket(),
    };

    if (this.task) {
      this.save.emit({
        mode: 'update',
        taskId: this.task.id,
        payload: {
          ...payload,
          completed: this.draftCompleted(),
        },
      });
      return;
    }

    this.save.emit({
      mode: 'create',
      payload,
    });
  }

  private hydrateDraft() {
    this.draftTitle.set(this.task?.title ?? this.initialTitle);
    this.draftDescription.set(this.task?.description ?? '');
    this.draftStatus.set(this.task?.status ?? 'inbox');
    this.draftPriority.set(this.task?.priority ?? 'medium');
    this.draftDueDate.set(this.task?.dueDate ?? '');
    this.draftSimpleMode.set(this.task?.simpleMode ?? !this.task?.dueDate);
    this.draftBucket.set(this.task?.bucket ?? 'personal-sanctuary');
    this.draftCompleted.set(this.task?.completed ?? false);

    // Clear validation errors when modal opens
    this.clearValidationErrors();
  }

  private clearValidationErrors() {
    this.titleError.set(null);
    this.dueDateError.set(null);
    this.descriptionError.set(null);
  }
}
