import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateTaskDto,
  Label,
  Priority,
  Project,
  Task,
  TaskStatus,
  UpdateTaskDto,
} from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';

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
export class PersonalTaskModalComponent implements OnDestroy {
  private readonly labelService = inject(LabelService);
  private readonly platformId = inject(PLATFORM_ID);
  private bodyScrollLocked = false;
  private previousBodyOverflow = '';
  private previousHtmlOverflow = '';
  private previousBodyTouchAction = '';
  @Input() open = false;
  @Input() task: Task | null = null;
  @Input() initialTitle = '';
  @Input() initialProjectId: string | null = null;
  @Input() projects: Project[] = [];
  @Input() error: string | null = null;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<SavePayload>();

  protected readonly priorities: Priority[] = ['high', 'medium', 'low'];
  protected readonly draftTitle = signal('');
  protected readonly draftDescription = signal('');
  protected readonly draftStatus = signal<TaskStatus>('inbox');
  protected readonly draftPriority = signal<Priority>('medium');
  protected readonly draftDueDate = signal('');
  protected readonly draftSimpleMode = signal(true);
  protected readonly draftProjectId = signal('');
  protected readonly draftCompleted = signal(false);
  protected readonly draftLabels = signal<string[]>([]);
  protected readonly newLabelName = signal('');
  protected readonly labels = this.labelService.labels;
  protected readonly palette = [
    '#82d7a9',
    '#81d7e8',
    '#f1c582',
    '#c7e9b3',
    '#a5d3e1',
    '#bcd0fb',
    '#d9a13d',
    '#d44d3c',
    '#9fb18c',
    '#b9a3f4',
  ];
  protected readonly newLabelColor = signal(this.palette[0]);

  // Validation state
  protected readonly titleError = signal<string | null>(null);
  protected readonly dueDateError = signal<string | null>(null);
  protected readonly descriptionError = signal<string | null>(null);

  ngOnChanges() {
    this.syncBodyScrollLock();
    this.hydrateDraft();
  }

  ngOnDestroy() {
    this.releaseBodyScrollLock();
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
    return projectName ?? 'Select a project';
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
      projectId: this.draftProjectId() || undefined,
      labels: this.draftLabels(),
    };

    if (this.task) {
      this.save.emit({
        mode: 'update',
        taskId: this.task.id,
        payload: {
          ...payload,
          projectId: this.draftProjectId() || null,
          completed: this.draftCompleted(),
          labels: this.draftLabels(),
        },
      });
      return;
    }

    this.save.emit({
      mode: 'create',
      payload,
    });
  }

  protected labelSelected(label: Label) {
    return this.draftLabels().includes(label.id);
  }

  protected toggleLabel(label: Label) {
    const current = this.draftLabels();
    this.draftLabels.set(
      current.includes(label.id) ? current.filter((id) => id !== label.id) : [...current, label.id],
    );
  }

  protected async createInlineLabel() {
    const name = this.newLabelName().trim();
    if (!name) {
      return;
    }

    const created = await this.labelService.createLabel({
      name,
      color: this.newLabelColor(),
    });
    this.draftLabels.set([...this.draftLabels(), created.id]);
    this.newLabelName.set('');
    this.newLabelColor.set(this.palette[0]);
  }

  private hydrateDraft() {
    this.draftTitle.set(this.task?.title ?? this.initialTitle);
    this.draftDescription.set(this.task?.description ?? '');
    this.draftStatus.set(this.task?.status ?? 'inbox');
    this.draftPriority.set(this.task?.priority ?? 'medium');
    this.draftDueDate.set(this.task?.dueDate ?? '');
    this.draftSimpleMode.set(this.task?.simpleMode ?? !this.task?.dueDate);
    this.draftProjectId.set(
      this.task?.projectId ?? this.initialProjectId ?? this.projects[0]?.id ?? '',
    );
    this.draftCompleted.set(this.task?.completed ?? false);
    this.draftLabels.set(this.task?.labels ?? []);
    this.newLabelName.set('');
    this.newLabelColor.set(this.palette[0]);

    // Clear validation errors when modal opens
    this.clearValidationErrors();
  }

  private clearValidationErrors() {
    this.titleError.set(null);
    this.dueDateError.set(null);
    this.descriptionError.set(null);
  }

  private syncBodyScrollLock() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.open) {
      if (this.bodyScrollLocked) {
        return;
      }

      this.previousBodyOverflow = document.body.style.overflow;
      this.previousHtmlOverflow = document.documentElement.style.overflow;
      this.previousBodyTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      this.bodyScrollLocked = true;
      return;
    }

    this.releaseBodyScrollLock();
  }

  private releaseBodyScrollLock() {
    if (!isPlatformBrowser(this.platformId) || !this.bodyScrollLocked) {
      return;
    }

    document.body.style.overflow = this.previousBodyOverflow;
    document.documentElement.style.overflow = this.previousHtmlOverflow;
    document.body.style.touchAction = this.previousBodyTouchAction;
    this.bodyScrollLocked = false;
  }
}
