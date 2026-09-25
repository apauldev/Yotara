import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  inject,
  signal,
  computed,
  viewChild,
  ChangeDetectionStrategy,
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
import { MarkdownEditorComponent } from '../../../shared/ui/markdown-editor/markdown-editor.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { parseCalendarDate } from '../../../shared/utils/timestamps';
import { parseTaskCommand } from '../utils/task-command-parser';
import type { DueDateDraft, DueDateDraftSource } from '../utils/due-date-draft';

type SavePayload =
  | { mode: 'create'; payload: CreateTaskDto }
  | { mode: 'update'; taskId: string; payload: UpdateTaskDto };

@Component({
  selector: 'app-personal-task-modal',
  standalone: true,
  imports: [
    CommonModule,
    DatePickerComponent,
    FormsModule,
    MarkdownEditorComponent,
    ModalComponent,
  ],
  templateUrl: './personal-task-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './personal-task-modal.component.scss',
})
export class PersonalTaskModalComponent {
  private readonly labelService = inject(LabelService);
  private readonly taskService = inject(TaskService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly subtaskInput = viewChild<ElementRef<HTMLInputElement>>('subtaskInput');
  private readonly addSubtaskButton = viewChild<ElementRef<HTMLButtonElement>>('addSubtaskButton');
  private readonly scheduleDatePicker = viewChild<DatePickerComponent>('scheduleDatePicker');
  @Input() open = false;
  @Input() task: Task | null = null;
  @Input() initialTitle = '';
  @Input() initialDueDateDraft: DueDateDraft | null = null;
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
  protected readonly dateDraftSource = signal<DueDateDraftSource>('none');
  protected readonly dateDraftMatchedText = signal<string | null>(null);
  protected readonly dateDraftMatchStart = signal<number | null>(null);
  protected readonly dateDraftMatchEnd = signal<number | null>(null);
  protected readonly dateDraftSuppressed = signal(false);
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

  // Progressive disclosure: advanced metadata is collapsed for quick capture
  // on mobile and auto-expanded when editing a task with meaningful metadata.
  // Drafts live in signals, so collapsing never discards values.
  protected readonly showAdvanced = signal(false);

  protected readonly dueDatePreviewLabel = computed(() => {
    const source = this.dateDraftSource();
    if (source === 'cleared') return 'Due date cleared';

    const value = this.draftDueDate();
    if (!value) return '';

    const date = parseCalendarDate(value);
    if (!date) return '';

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date.toJSDate());

    return source === 'inferred' && this.dateDraftMatchedText()
      ? `${this.dateDraftMatchedText()} resolves to ${formattedDate}`
      : `Due ${formattedDate}`;
  });

  ngOnChanges(changes: SimpleChanges) {
    // Hydrate only when a new editing session starts: the modal opening or a
    // different task being supplied. Late-arriving inputs (projects loading,
    // error updates) must not wipe in-progress drafts.
    const opened = changes['open']?.currentValue === true && !changes['open']?.previousValue;
    const taskChanged =
      'task' in changes && changes['task']?.currentValue !== changes['task']?.previousValue;
    if (opened || taskChanged) {
      this.hydrateDraft();
    }
  }

  protected selectedContextLabel() {
    const projectName = this.projects.find((project) => project.id === this.draftProjectId())?.name;
    return projectName ?? 'Select a project';
  }

  protected titleDescribedBy(): string | null {
    const ids: string[] = [];
    if (this.titleError()) ids.push('task-title-error');
    if (!this.task && this.dateDraftSource() !== 'none') ids.push('task-date-preview');
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected toggleDay(day: number) {
    this.draftRecurrenceDaysOfWeek.update((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort(),
    );
  }

  protected toggleAdvanced() {
    this.showAdvanced.update((v) => !v);
  }

  protected onTitleInput(value: string) {
    this.draftTitle.set(value);

    if (this.task || this.dateDraftSource() === 'manual') {
      return;
    }

    if (this.dateDraftSource() === 'inferred') {
      const match = this.findInferredDatePhrase(value);
      if (!match) {
        this.clearDraftDueDate();
        return;
      }

      this.dateDraftMatchStart.set(match.start);
      this.dateDraftMatchEnd.set(match.end);
      return;
    }

    if (this.dateDraftSuppressed() && this.dateDraftSource() !== 'none') {
      this.draftDueDate.set('');
      this.dateDraftSource.set('cleared');
      this.dateDraftMatchStart.set(null);
      this.dateDraftMatchEnd.set(null);
    }
  }

  private findInferredDatePhrase(value: string): { start: number; end: number } | null {
    const phrase = this.dateDraftMatchedText();
    if (!phrase) return null;

    const normalizedValue = value.toLowerCase();
    const normalizedPhrase = phrase.toLowerCase();
    const matches: Array<{ start: number; end: number }> = [];
    let searchStart = 0;

    while (searchStart < value.length) {
      const start = normalizedValue.indexOf(normalizedPhrase, searchStart);
      if (start < 0) break;
      const end = start + phrase.length;
      if (this.isStandaloneDatePhrase(value, start, end)) {
        matches.push({ start, end });
      }
      searchStart = end;
    }

    return matches.length === 1 ? matches[0] : null;
  }

  private isStandaloneDatePhrase(value: string, start: number, end: number): boolean {
    const before = value.slice(0, start);
    const after = value.slice(end);
    const previousCharacter = before.slice(-1);
    const nextCharacter = after[0] ?? '';

    if (/[A-Za-z0-9]/.test(previousCharacter) || /[A-Za-z0-9]/.test(nextCharacter)) {
      return false;
    }
    if (previousCharacter && '#@/\\-–—?&=:;'.includes(previousCharacter)) {
      return false;
    }
    if (/['’@]/.test(nextCharacter) || /[A-Za-z0-9]['’]\s*$/.test(before)) {
      return false;
    }
    if (/(?:https?:\/\/|www\.)\S*$/i.test(before.slice(-100))) {
      return false;
    }

    const previousWord = before.trimEnd().split(/\s+/).pop()?.toLowerCase();
    if (previousWord && ['on', 'next', 'in', 'last', 'this'].includes(previousWord)) {
      return false;
    }

    const nextWord = after.trimStart().split(/\s+/)[0]?.toLowerCase();
    return (
      !nextWord || !['at', 'morning', 'afternoon', 'evening', 'tonight', 'utc'].includes(nextWord)
    );
  }

  protected openDueDatePicker() {
    if (!this.task && this.draftSimpleMode()) {
      this.draftSimpleMode.set(false);
    }

    const detailsToggle = this.host.nativeElement.querySelector('.details-toggle');
    if (detailsToggle instanceof HTMLButtonElement) {
      detailsToggle.focus();
    }
    this.showAdvanced.set(true);
    this.cdr.detectChanges();
    this.scheduleDatePicker()?.open();
  }

  protected onDraftDueDateChange(value: string) {
    if (this.task) {
      this.draftDueDate.set(value);
      return;
    }

    if (!value) {
      this.clearDraftDueDate();
      return;
    }

    this.draftDueDate.set(value);
    this.draftSimpleMode.set(false);
    this.dateDraftSource.set('manual');
    this.dateDraftMatchedText.set(null);
    this.dateDraftMatchStart.set(null);
    this.dateDraftMatchEnd.set(null);
    this.dateDraftSuppressed.set(false);
  }

  protected clearDraftDueDate() {
    this.draftDueDate.set('');

    if (!this.task) {
      this.dateDraftSource.set('cleared');
      this.dateDraftMatchedText.set(null);
      this.dateDraftMatchStart.set(null);
      this.dateDraftMatchEnd.set(null);
      this.dateDraftSuppressed.set(true);
    }
  }

  protected hasMeaningfulMetadata() {
    return (
      this.draftDueDate().trim() !== '' ||
      this.draftRecurrenceFrequency() !== null ||
      this.draftLabels().length > 0 ||
      this.draftStatus() !== 'inbox' ||
      this.draftPriority() !== 'medium' ||
      this.draftCompleted() ||
      // A project assignment only counts as meaningful when editing: new
      // tasks default into the first project, which should not force expansion.
      (this.task !== null && this.draftProjectId() !== '')
    );
  }

  protected advancedSummary() {
    const parts: string[] = [];
    const projectName = this.projects.find((project) => project.id === this.draftProjectId())?.name;
    if (projectName) {
      parts.push(projectName);
    }
    if (this.draftPriority() !== 'medium') {
      parts.push(`${this.draftPriority()} priority`);
    }
    if (this.draftDueDate().trim() !== '') {
      parts.push(this.draftDueDate().trim());
    }
    return parts.join(' · ');
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
    const opening = !this.subtaskEntryMode();
    this.subtaskEntryMode.update((m) => !m);
    if (!this.subtaskEntryMode()) {
      this.newSubtaskTitle.set('');
      // Return focus to Add subtask after cancellation.
      this.cdr.detectChanges();
      this.addSubtaskButton()?.nativeElement.focus();
      return;
    }
    // Focus the newly shown subtask input for immediate typing.
    if (opening) {
      this.cdr.detectChanges();
      this.subtaskInput()?.nativeElement.focus();
    }
  }

  protected quickAddSubtask() {
    const title = this.newSubtaskTitle().trim();
    if (!title) {
      this.subtaskEntryMode.set(false);
      this.cdr.detectChanges();
      this.addSubtaskButton()?.nativeElement.focus();
      return;
    }

    this.draftSubtasks.update((subs) => [...subs, { title, completed: false }]);
    this.newSubtaskTitle.set('');
    this.cdr.detectChanges();
    this.subtaskInput()?.nativeElement.focus();
  }

  protected removeDraftSubtask(index: number) {
    this.draftSubtasks.update((subs) => subs.filter((_, i) => i !== index));
  }

  protected onSimpleModeChange(value: boolean) {
    this.draftSimpleMode.set(value);

    if (value) {
      this.draftDueDate.set('');
      if (!this.task) {
        if (this.dateDraftSource() !== 'none') {
          this.dateDraftSource.set('cleared');
          this.dateDraftMatchedText.set(null);
          this.dateDraftMatchStart.set(null);
          this.dateDraftMatchEnd.set(null);
        }
        this.dateDraftSuppressed.set(true);
      }
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
      this.focusFirstInvalid();
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

    const dueDate = this.draftSimpleMode()
      ? undefined
      : normalizeDateInputValue(this.draftDueDate());
    const payload: CreateTaskDto = {
      title: this.draftTitle(),
      description: this.draftDescription().trim() || undefined,
      status: this.draftStatus(),
      priority: this.draftPriority(),
      ...(dueDate ? { dueDate } : {}),
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

  protected onModalOpened() {
    this.titleInput()?.nativeElement.focus();
  }

  private focusFirstInvalid() {
    // The due-date control lives in the collapsible advanced section;
    // expand it before focusing so the target is visible and tabbable.
    if (this.dueDateError() && !this.titleError()) {
      this.showAdvanced.set(true);
    }
    this.cdr.detectChanges();

    const titleEl = this.titleInput()?.nativeElement;
    if (this.titleError() && titleEl) {
      titleEl.focus();
      titleEl.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (this.dueDateError()) {
      // The schedule trigger lives inside app-date-picker; scope the query
      // to the Schedule control (the popover directive owns the trigger id).
      const trigger = this.host.nativeElement.querySelector(
        '.schedule-picker .date-picker-trigger',
      );
      if (trigger instanceof HTMLElement) {
        trigger.focus();
        trigger.scrollIntoView({ block: 'nearest' });
      }
    }
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

      this.draftLabels.set(parsedLabelIds);
    } else {
      this.draftPriority.set(this.task?.priority ?? 'medium');
      this.draftLabels.set(this.task?.labels ?? []);
    }

    const initialDraft = this.task ? null : this.initialDueDateDraft;
    const initialDueDate = this.task
      ? this.task.dueDate
      : initialDraft?.source === 'cleared'
        ? undefined
        : initialDraft?.value;
    const initialDateSource =
      initialDraft?.source === 'cleared' || initialDraft?.value
        ? (initialDraft.source ?? 'none')
        : 'none';
    this.draftDueDate.set(toDateInputValue(initialDueDate));
    this.draftSimpleMode.set(this.task?.simpleMode ?? !initialDueDate);
    this.dateDraftSource.set(initialDateSource);
    this.dateDraftMatchedText.set(
      initialDateSource === 'inferred' ? (initialDraft?.matchedText ?? null) : null,
    );
    this.dateDraftMatchStart.set(
      initialDateSource === 'inferred' ? (initialDraft?.matchStart ?? null) : null,
    );
    this.dateDraftMatchEnd.set(
      initialDateSource === 'inferred' ? (initialDraft?.matchEnd ?? null) : null,
    );
    this.dateDraftSuppressed.set(initialDateSource === 'cleared');
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
    // Collapse advanced metadata for quick capture; auto-expand when the
    // edited task already carries meaningful metadata.
    this.showAdvanced.set(this.hasMeaningfulMetadata());

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
