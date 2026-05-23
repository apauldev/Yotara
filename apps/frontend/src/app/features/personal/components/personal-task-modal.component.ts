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
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateTaskDto,
  Label,
  Priority,
  Project,
  RecurrenceFrequency,
  Task,
  TaskStatus,
  UpdateTaskDto,
} from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';
import { TaskService } from '../../../core/services/task.service';
import { DatePickerComponent } from '../../../shared/ui/date-picker/date-picker.component';
import { parseCalendarDate } from '../../../shared/utils/timestamps';
import { parseTaskCommand } from '../utils/task-command-parser';

type SavePayload =
  | { mode: 'create'; payload: CreateTaskDto }
  | { mode: 'update'; taskId: string; payload: UpdateTaskDto };

@Component({
  selector: 'app-personal-task-modal',
  standalone: true,
  imports: [CommonModule, DatePickerComponent, FormsModule],
  templateUrl: './personal-task-modal.component.html',
  styleUrl: './personal-task-modal.component.scss',
})
export class PersonalTaskModalComponent implements OnDestroy {
  private readonly labelService = inject(LabelService);
  private readonly taskService = inject(TaskService);
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
  protected readonly draftRecurrenceFrequency = signal<RecurrenceFrequency | null>(null);
  protected readonly draftRecurrenceInterval = signal(1);
  protected readonly draftRecurrenceEndDate = signal('');
  protected readonly draftRecurrenceDaysOfWeek = signal<number[]>([]);
  protected readonly weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  protected readonly recurrenceFrequencies: (RecurrenceFrequency | null)[] = [
    null,
    'daily',
    'weekdays',
    'weekly',
    'monthly',
    'yearly',
  ];
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

  // Subtask state
  protected readonly subtasks = signal<Task[]>([]);
  protected readonly subtaskLoading = signal(false);
  protected readonly newSubtaskTitle = signal('');
  protected readonly newSubtaskCreating = signal(false);
  protected readonly subtaskEntryMode = signal(false);
  protected readonly draftSubtasks = signal<{ title: string; completed: boolean }[]>([]);

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

  protected toggleDay(day: number) {
    this.draftRecurrenceDaysOfWeek.update((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort(),
    );
  }

  protected recurrenceFrequencyLabel() {
    const freq = this.draftRecurrenceFrequency();
    if (!freq) return 'None';
    if (freq === 'weekdays') return 'Weekdays';
    const label = freq.charAt(0).toUpperCase() + freq.slice(1);
    const interval = this.draftRecurrenceInterval();
    return interval > 1 ? `Every ${interval} ${freq}` : label;
  }

  protected subtaskCount = computed(() => this.subtasks().length + this.draftSubtasks().length);

  protected isRecurrenceDisabled() {
    return !!this.task?.parentId;
  }

  protected doneSubtaskCount = computed(() => {
    return (
      this.subtasks().filter((s) => s.completed).length +
      this.draftSubtasks().filter((s) => s.completed).length
    );
  });

  protected allSubtasksDone = computed(() => {
    const total = this.subtaskCount();
    return total > 0 && this.doneSubtaskCount() === total;
  });

  protected async loadSubtasks(taskId: string) {
    this.subtaskLoading.set(true);
    try {
      const tasks = await this.taskService.fetchSubtasks(taskId);
      this.subtasks.set(tasks);
    } finally {
      this.subtaskLoading.set(false);
    }
  }

  protected async toggleSubtask(subtask: Task) {
    if (!this.task) return;
    await this.taskService.updateTask(subtask.id, { completed: !subtask.completed });
    this.loadSubtasks(this.task.id);
  }

  protected toggleDraftSubtask(index: number) {
    this.draftSubtasks.update((subs) => {
      const next = [...subs];
      if (next[index]) {
        next[index] = { ...next[index], completed: !next[index].completed };
      }
      return next;
    });
  }

  protected toggleSubtaskEntry() {
    this.subtaskEntryMode.update((m) => !m);
    if (!this.subtaskEntryMode()) {
      this.newSubtaskTitle.set('');
    }
  }

  protected quickAddSubtask() {
    const title = this.newSubtaskTitle().trim();
    if (!title) {
      this.subtaskEntryMode.set(false);
      return;
    }

    this.draftSubtasks.update((subs) => [...subs, { title, completed: false }]);
    this.newSubtaskTitle.set('');
  }

  protected removeDraftSubtask(index: number) {
    this.draftSubtasks.update((subs) => subs.filter((_, i) => i !== index));
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

    const dateObj = parseCalendarDate(dueDate);
    if (!dateObj) {
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

    const freq = this.draftRecurrenceFrequency();
    const daysOfWeek =
      freq === 'weekdays'
        ? [1, 2, 3, 4, 5]
        : freq === 'weekly' && this.draftRecurrenceDaysOfWeek().length > 0
          ? this.draftRecurrenceDaysOfWeek()
          : undefined;

    const recurrenceRule =
      freq && !this.isRecurrenceDisabled()
        ? {
            frequency: freq,
            interval: this.draftRecurrenceInterval(),
            endDate: this.draftRecurrenceEndDate() || undefined,
            daysOfWeek,
          }
        : null;

    const payload: CreateTaskDto = {
      title: this.draftTitle(),
      description: this.draftDescription().trim() || undefined,
      status: this.draftStatus(),
      priority: this.draftPriority(),
      dueDate: this.draftSimpleMode() ? undefined : normalizeDateInputValue(this.draftDueDate()),
      simpleMode: this.draftSimpleMode(),
      projectId: this.draftProjectId() || undefined,
      labels: this.draftLabels(),
      recurrenceRule: recurrenceRule ?? undefined,
      subtasks: this.draftSubtasks().length > 0 ? this.draftSubtasks() : undefined,
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
          recurrenceRule: this.isRecurrenceDisabled() ? undefined : recurrenceRule,
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
    const rawTitle = this.task?.title ?? this.initialTitle;
    const { title, priority, labelNames } = parseTaskCommand(rawTitle);

    // If editing, use raw title. If creating from initialTitle, use cleaned title.
    this.draftTitle.set(this.task ? rawTitle : title);
    this.draftDescription.set(this.task?.description ?? '');
    this.draftStatus.set(this.task?.status ?? 'inbox');

    if (!this.task && this.initialTitle) {
      this.draftPriority.set(priority ?? 'medium');

      const parsedLabelIds = this.labelService
        .labels()
        .filter((l) => labelNames.some((name) => name.toLowerCase() === l.name.toLowerCase()))
        .map((l) => l.id);

      if (parsedLabelIds.length > 0) {
        this.draftLabels.set(parsedLabelIds);
      }
    } else {
      this.draftPriority.set(this.task?.priority ?? 'medium');
      this.draftLabels.set(this.task?.labels ?? []);
    }

    this.draftDueDate.set(toDateInputValue(this.task?.dueDate));
    this.draftSimpleMode.set(this.task?.simpleMode ?? !this.task?.dueDate);
    this.draftProjectId.set(
      this.task?.projectId ?? this.initialProjectId ?? this.projects[0]?.id ?? '',
    );
    this.draftCompleted.set(this.task?.completed ?? false);
    this.draftRecurrenceFrequency.set(this.task?.recurrenceRule?.frequency ?? null);
    this.draftRecurrenceInterval.set(this.task?.recurrenceRule?.interval ?? 1);
    this.draftRecurrenceEndDate.set(this.task?.recurrenceRule?.endDate ?? '');
    this.draftRecurrenceDaysOfWeek.set(this.task?.recurrenceRule?.daysOfWeek ?? []);
    this.newLabelName.set('');
    this.newLabelColor.set(this.palette[0]);
    this.subtaskEntryMode.set(false);
    this.draftSubtasks.set([]);
    // Clear validation errors when modal opens
    this.clearValidationErrors();

    // Load subtasks when editing an existing task
    if (this.task) {
      this.loadSubtasks(this.task.id);
    } else {
      this.subtasks.set([]);
    }
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

function toDateInputValue(value?: string | null) {
  const date = parseCalendarDate(value);
  if (!date) {
    return '';
  }

  return date.toFormat('yyyy-MM-dd');
}

function normalizeDateInputValue(value: string) {
  const date = parseCalendarDate(value);
  return date ? date.toFormat('yyyy-MM-dd') : undefined;
}
