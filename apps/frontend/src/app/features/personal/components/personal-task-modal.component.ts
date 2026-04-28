import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateTaskDto,
  Priority,
  Project,
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
  templateUrl: './personal-task-modal.component.html',
  styleUrl: './personal-task-modal.component.scss',
})
export class PersonalTaskModalComponent {
  @Input() open = false;
  @Input() task: Task | null = null;
  @Input() initialTitle = '';
  @Input() initialProjectId: string | null = null;
  @Input() projects: Project[] = [];
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
  protected readonly draftProjectId = signal('');
  protected readonly draftCompleted = signal(false);

  // Validation state
  protected readonly titleError = signal<string | null>(null);
  protected readonly dueDateError = signal<string | null>(null);
  protected readonly descriptionError = signal<string | null>(null);

  ngOnChanges() {
    this.hydrateDraft();
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent) {
    if (!this.open || event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    this.close.emit();
  }

  protected selectedContextLabel() {
    const projectName = this.projects.find((project) => project.id === this.draftProjectId())?.name;

    if (projectName) {
      return projectName;
    }

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
      title: this.draftTitle(),
      description: this.draftDescription().trim() || undefined,
      status: this.draftStatus(),
      priority: this.draftPriority(),
      dueDate: this.draftSimpleMode() ? undefined : this.draftDueDate() || undefined,
      simpleMode: this.draftSimpleMode(),
      bucket: this.draftBucket(),
      projectId: this.draftProjectId() || undefined,
    };

    if (this.task) {
      this.save.emit({
        mode: 'update',
        taskId: this.task.id,
        payload: {
          ...payload,
          projectId: this.draftProjectId() || null,
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
    this.draftProjectId.set(this.task?.projectId ?? this.initialProjectId ?? '');
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
