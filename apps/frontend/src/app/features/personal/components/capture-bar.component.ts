import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  NgZone,
  Output,
  signal,
  computed,
  ElementRef,
  viewChild,
  inject,
  ChangeDetectionStrategy,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateTime } from 'luxon';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { DatePickerComponent } from '../../../shared/ui/date-picker/date-picker.component';
import { parseCalendarDate, startOfToday } from '../../../shared/utils/timestamps';
import { LabelService } from '../../../core/services/label.service';
import { highlightInlineCommands } from '../../../shared/utils/html-helpers';
import {
  createClearedDueDateDraft,
  createEmptyDueDateDraft,
  type DueDateDraft,
} from '../utils/due-date-draft';
import { parseTaskDueDate, type TaskDueDateParseResult } from '../utils/task-due-date-parser';

@Component({
  selector: 'app-capture-bar',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule, DatePickerComponent],
  template: `
    <form id="capture" class="capture-bar" (ngSubmit)="onFormSubmit($event)">
      <div class="capture-input-container">
        <div class="capture-input-row">
          <div
            #highlighter
            class="capture-highlighter"
            aria-hidden="true"
            [innerHTML]="highlightedTitle()"
          ></div>
          <input
            #captureInput
            type="text"
            name="captureTitle"
            [ngModel]="title()"
            (ngModelChange)="onTitleInput($event)"
            (input)="onCaptureInput()"
            (keydown)="onCaptureKeyDown($event)"
            placeholder="What's on your mind today?"
            autocomplete="off"
            [attr.aria-invalid]="error() ? 'true' : 'false'"
            [attr.aria-describedby]="captureInputDescribedBy()"
            (keydown.enter)="lastSubmissionType = 'default'"
          />

          @if (activeTagSearch() !== null && tagSuggestions().length > 0) {
            <ul class="tag-suggestions" role="listbox">
              @for (suggestion of tagSuggestions(); track suggestion.id; let i = $index) {
                <li
                  [class.suggestion-active]="i === selectedSuggestionIndex()"
                  (click)="selectSuggestion(suggestion.name)"
                  role="option"
                >
                  <span class="suggestion-hash">#</span>{{ suggestion.name }}
                </li>
              }
            </ul>
          }
        </div>

        @if (dueDateDraft().source !== 'none') {
          <div
            id="capture-date-preview"
            class="capture-date-preview"
            role="group"
            aria-live="polite"
            aria-labelledby="capture-date-preview-label"
          >
            <app-date-picker
              #captureDatePicker
              class="capture-date-picker"
              [value]="dueDateDraft().value"
              [disabled]="creating"
              label="Due date"
              [describedBy]="'capture-date-preview-label'"
              (valueChange)="onDueDateChange($event)"
            />

            <div class="capture-date-copy">
              <span id="capture-date-preview-label" class="capture-date-label">
                {{ dueDatePreviewLabel() }}
              </span>
              <div class="capture-date-actions">
                @if (dueDateDraft().source !== 'none') {
                  <button
                    type="button"
                    class="capture-date-action"
                    [disabled]="creating"
                    aria-label="Change due date"
                    (click)="openDueDatePicker()"
                  >
                    Change
                  </button>
                }
                @if (dueDateDraft().source !== 'cleared') {
                  <button
                    type="button"
                    class="capture-date-action"
                    [disabled]="creating"
                    aria-label="Clear due date"
                    (click)="clearDueDate()"
                  >
                    Clear
                  </button>
                }
              </div>
            </div>
          </div>
        }
      </div>

      <div class="capture-actions">
        <label class="capture-project">
          <span class="sr-only">Project</span>
          <select
            [ngModel]="projectId() || defaultProjectId"
            (ngModelChange)="projectId.set($event)"
            name="captureProjectId"
            aria-label="Choose project"
          >
            @for (project of projects; track project.id) {
              <option [value]="project.id">{{ project.name }}</option>
            }
          </select>
        </label>
      </div>

      <div class="capture-button-group">
        <button
          type="submit"
          class="capture-submit capture-submit-quick"
          [disabled]="creating"
          (click)="lastSubmissionType = 'quick'"
        >
          Add Task
        </button>
        <button
          type="submit"
          class="capture-submit capture-submit-details"
          [disabled]="creating"
          (click)="lastSubmissionType = 'capture'"
        >
          Add task with details
        </button>
      </div>
    </form>

    @if (error()) {
      <p id="capture-error" class="capture-error" role="alert">{{ error() }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: `
    :host {
      display: block;
    }

    .capture-bar {
      --capture-gap: 1.25rem;
      --capture-padding-x: 1.25rem;
      --capture-padding-y: 0.6rem;
      --capture-radius: 1.2rem;
      --input-font-size: 1.06rem;
      --input-line-height: 1.5;
      --input-font-weight: 500;

      margin-top: 2rem;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: center;
      gap: var(--capture-gap);
      background: var(--surface-card);
      border-radius: var(--capture-radius);
      box-shadow:
        inset 0 0 0 1px var(--outline-variant),
        0 18px 32px var(--surface-dim);
      padding: var(--capture-padding-y) var(--capture-padding-y) var(--capture-padding-y)
        var(--capture-padding-x);
      position: relative;
      transition: box-shadow 0.2s ease;

      &:focus-within {
        box-shadow:
          inset 0 0 0 1px color-mix(in srgb, var(--on-surface) 25%, transparent),
          0 12px 24px var(--surface-dim);
      }
    }

    .capture-input-container {
      flex: 1;
      min-width: 0;
      display: grid;
      align-content: center;
      gap: 0.45rem;
    }

    .capture-input-row {
      position: relative;
      min-width: 0;
      display: flex;
      align-items: center;
    }

    .capture-highlighter,
    .capture-bar input {
      font-size: var(--input-font-size);
      font-weight: var(--input-font-weight);
      line-height: var(--input-line-height);
      padding: 0.4rem 0;
    }

    .capture-highlighter {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      white-space: pre;
      overflow: hidden;
      pointer-events: none;
      color: var(--on-surface);
    }

    .capture-bar input {
      width: 100%;
      border: 0;
      outline: none;
      background: transparent;
      color: transparent;
      caret-color: var(--on-surface);
      position: relative;
      z-index: 1;

      &::placeholder {
        color: var(--on-surface-subtle);
      }

      &:focus-visible {
        outline: none;
      }
    }

    :host ::ng-deep {
      .hl-priority {
        color: var(--priority-high);
        font-weight: inherit;
      }

      .hl-label {
        color: var(--accent-strong);
        font-weight: inherit;
      }
    }

    .tag-suggestions {
      --suggestion-radius: 0.9rem;
      --suggestion-padding: 0.4rem;

      position: absolute;
      top: calc(100% + 1rem);
      left: -0.5rem;
      width: calc(100% + 1rem);
      min-width: 14rem;
      max-width: 22rem;
      background: var(--surface-overlay);
      border-radius: var(--suggestion-radius);
      box-shadow:
        0 12px 32px var(--surface-dim),
        inset 0 0 0 1px var(--outline-variant);
      z-index: 100;
      padding: var(--suggestion-padding);
      list-style: none;
      margin: 0;
      overflow: hidden;

      li {
        padding: 0.65rem 0.85rem;
        border-radius: 0.6rem;
        cursor: pointer;
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--on-surface);
        display: flex;
        align-items: center;
        gap: 0.4rem;
        transition: all 0.15s ease;

        &:hover,
        &.suggestion-active {
          background: var(--primary-soft);
          color: var(--primary-solid);
        }

        .suggestion-hash {
          opacity: 0.6;
        }
      }
    }

    .capture-date-preview {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.45rem 0.55rem;
      border-radius: 0.85rem;
      background: var(--surface-container-low);
      box-shadow: inset 0 0 0 1px var(--outline-variant);
    }

    .capture-date-picker {
      flex: 0 1 12rem;
      min-width: 9.5rem;
    }

    .capture-date-copy {
      min-width: 0;
      display: grid;
      gap: 0.3rem;
      flex: 1;
    }

    .capture-date-label {
      min-width: 0;
      color: var(--on-surface);
      font-size: 0.82rem;
      font-weight: 700;
      line-height: 1.3;
    }

    .capture-date-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .capture-date-action {
      min-height: 2.75rem;
      border: 0;
      border-radius: 0.65rem;
      padding: 0 0.7rem;
      background: var(--surface-container-high);
      color: var(--on-surface);
      cursor: pointer;
      font-size: 0.78rem;
      font-weight: 800;

      &:hover:not(:disabled) {
        background: var(--surface-container-highest);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 2px;
      }
    }

    .capture-actions {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .capture-project select {
      --select-radius: 0.75rem;

      border: 0;
      border-radius: var(--select-radius);
      background: var(--surface-container-highest);
      color: var(--on-surface);
      font-size: 0.9rem;
      font-weight: 600;
      padding: 0.5rem 0.75rem;
      min-width: 8rem;
      box-shadow: inset 0 0 0 1px var(--outline-variant);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background-color: var(--surface-container-high);
      }

      &:focus-visible {
        outline: none;
        box-shadow:
          inset 0 0 0 1px var(--primary-solid),
          0 0 0 3px var(--primary-soft);
      }
    }

    .capture-button-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .capture-submit {
      --button-radius: 0.75rem;

      border: 0;
      border-radius: var(--button-radius);
      font-size: 0.9rem;
      font-weight: 700;
      min-height: 2.75rem;
      padding: 0 1.25rem;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &.capture-submit-quick {
        background: var(--surface-container-high);
        color: var(--on-surface);
        box-shadow: inset 0 0 0 1px var(--outline-variant);

        &:hover:not(:disabled) {
          background: var(--surface-container-highest);
        }
      }

      &.capture-submit-details {
        background: var(--primary-action-gradient);
        color: hsl(var(--primary-foreground));

        &:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px var(--surface-dim);
        }

        &:active:not(:disabled) {
          transform: translateY(0);
        }
      }
    }

    .capture-error {
      margin: 0.7rem 0 0;
      color: var(--status-overdue);
    }

    @media (max-width: 720px) {
      .capture-bar {
        grid-template-columns: 1fr;
        align-items: stretch;
        gap: 0.85rem;
        padding: 1rem;
        --input-font-size: 1rem;
      }

      .capture-date-preview {
        align-items: stretch;
        flex-direction: column;
      }

      .capture-date-picker {
        width: 100%;
        min-width: 0;
      }

      .capture-date-actions {
        justify-content: flex-end;
      }

      .capture-actions {
        display: grid;
        grid-template-columns: 1fr;
        align-items: center;
        gap: 0.55rem;
      }

      .capture-project select {
        width: 100%;
      }

      .capture-button-group {
        flex-direction: column;
        align-items: stretch;
        gap: 0.6rem;
      }

      .capture-submit {
        width: 100%;
      }
    }
  `,
})
export class CaptureBarComponent implements OnChanges, OnDestroy, OnInit {
  @Input({ required: true }) projects: { id: string; name: string }[] = [];
  @Input({ required: true }) creating = false;
  @Input({ required: true }) defaultProjectId = '';
  @Input() referenceDate: DateTime | null = null;
  @Output() readonly submit = new EventEmitter<void>();
  private submitEmissionPending = false;

  protected readonly title = signal('');
  protected readonly error = signal('');
  protected readonly projectId = signal('');
  protected readonly dueDateDraft = signal<DueDateDraft>(createEmptyDueDateDraft());
  protected readonly parserResult = signal<TaskDueDateParseResult | null>(null);
  protected lastSubmissionType: 'quick' | 'capture' | 'default' = 'default';

  protected readonly activeTagSearch = signal<string | null>(null);
  protected readonly selectedSuggestionIndex = signal(0);

  private readonly labelService = inject(LabelService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly currentReferenceDate = signal<DateTime>(DateTime.now().startOf('day'));
  private referenceDateTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly captureInput = viewChild<ElementRef<HTMLInputElement>>('captureInput');
  private readonly highlighter = viewChild<ElementRef<HTMLElement>>('highlighter');
  private readonly captureDatePicker = viewChild(DatePickerComponent);

  protected readonly tagSuggestions = computed(() => {
    const search = this.activeTagSearch();
    if (search === null) return [];
    return this.labelService
      .labels()
      .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 5);
  });

  protected readonly highlightedTitle = computed(() => {
    const text = this.title();
    if (!text) return '';
    const labels = this.labelService.labels().map((l) => l.name);
    return highlightInlineCommands(text, labels);
  });

  protected readonly captureInputDescribedBy = computed(() => {
    const ids: string[] = [];
    if (this.error()) ids.push('capture-error');
    if (this.dueDateDraft().source !== 'none') ids.push('capture-date-preview');
    return ids.length > 0 ? ids.join(' ') : null;
  });

  protected readonly dueDatePreviewLabel = computed(() => {
    const draft = this.dueDateDraft();
    if (draft.source === 'cleared') return 'Due date cleared';
    if (!draft.value) return '';

    const date = parseCalendarDate(draft.value);
    if (!date) return '';

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date.toJSDate());

    return draft.source === 'inferred' && draft.matchedText
      ? `${draft.matchedText} resolves to ${formattedDate}`
      : `Due ${formattedDate}`;
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['referenceDate']) {
      this.reparseDueDate(this.title());
    }
  }

  ngOnInit() {
    this.scheduleReferenceDateRefresh();
  }

  ngOnDestroy() {
    if (this.referenceDateTimer !== null) {
      clearTimeout(this.referenceDateTimer);
      this.referenceDateTimer = null;
    }
  }

  /** Expose for parent to set initial title */
  setTitle(value: string) {
    this.updateTitle(value);
  }

  clearTitle() {
    this.updateTitle('');
    this.activeTagSearch.set(null);
    this.selectedSuggestionIndex.set(0);
    this.parserResult.set(null);
    this.dueDateDraft.set(createEmptyDueDateDraft());
  }

  resetCapture() {
    this.clearTitle();
    this.clearError();
    this.resetSubmissionType();
  }

  setError(value: string) {
    this.error.set(value);
  }

  clearError() {
    this.error.set('');
  }

  getTitle(): string {
    return this.title();
  }

  getError(): string {
    return this.error();
  }

  getProjectId(): string {
    return this.projectId();
  }

  getDueDateDraft(): DueDateDraft {
    return { ...this.dueDateDraft() };
  }

  getParserResult(): TaskDueDateParseResult | null {
    return this.parserResult();
  }

  getLastSubmissionType(): 'quick' | 'capture' | 'default' {
    return this.lastSubmissionType;
  }

  setSubmissionType(type: 'quick' | 'capture' | 'default') {
    this.lastSubmissionType = type;
  }

  resetSubmissionType() {
    this.lastSubmissionType = 'default';
  }

  protected onFormSubmit(event?: unknown) {
    // The output is named `submit`; stop the native form event from also
    // reaching the parent binding, otherwise one click can create twice.
    if (event && typeof (event as { stopPropagation?: unknown }).stopPropagation === 'function') {
      (event as Event).stopPropagation();
    }
    if (this.submitEmissionPending) return;
    this.submitEmissionPending = true;
    this.submit.emit();
    queueMicrotask(() => {
      this.submitEmissionPending = false;
    });
  }

  protected onTitleInput(value: string) {
    this.updateTitle(value);
  }

  protected openDueDatePicker() {
    this.captureDatePicker()?.open();
  }

  protected onDueDateChange(value: string) {
    const date = parseCalendarDate(value);
    if (!date) {
      this.clearDueDate();
      return;
    }

    const currentDraft = this.dueDateDraft();
    const parserResult = this.parserResult();
    const matchedText = currentDraft.matchedText ?? parserResult?.matchedText ?? null;
    const matchStart = currentDraft.matchStart ?? parserResult?.matchStart ?? null;
    const matchEnd = currentDraft.matchEnd ?? parserResult?.matchEnd ?? null;

    this.dueDateDraft.set({
      value: date.toFormat('yyyy-MM-dd'),
      source: 'manual',
      matchedText,
      matchStart,
      matchEnd,
    });
  }

  protected clearDueDate() {
    this.dueDateDraft.set(createClearedDueDateDraft(this.dueDateDraft()));
  }

  private updateTitle(value: string) {
    if (value === this.title()) return;
    this.title.set(value);

    if (this.dueDateDraft().source === 'manual' && value.trim() === '') {
      this.parserResult.set(null);
      this.dueDateDraft.set(createEmptyDueDateDraft());
      return;
    }

    this.reparseDueDate(value);
  }

  private reparseDueDate(value: string) {
    const result = parseTaskDueDate(value, this.referenceForParsing());
    this.parserResult.set(result);

    const currentDraft = this.dueDateDraft();
    if (currentDraft.source === 'manual') {
      return;
    }

    if (currentDraft.source === 'cleared') {
      const preservedDraft = this.findUnchangedClearedPhrase(value, currentDraft, result);
      if (preservedDraft) {
        this.dueDateDraft.set(preservedDraft);
        return;
      }
    }

    if (result.status === 'date' && result.dueDate) {
      this.dueDateDraft.set({
        value: result.dueDate,
        source: 'inferred',
        matchedText: result.matchedText,
        matchStart: result.matchStart,
        matchEnd: result.matchEnd,
      });
      return;
    }

    this.dueDateDraft.set(createEmptyDueDateDraft());
  }

  private findUnchangedClearedPhrase(
    value: string,
    draft: DueDateDraft,
    result: TaskDueDateParseResult,
  ): DueDateDraft | null {
    if (!draft.matchedText || result.status === 'multiple' || result.status === 'range') {
      return null;
    }

    if (result.status === 'date') {
      if (
        !result.matchedText ||
        result.matchStart === null ||
        result.matchEnd === null ||
        result.matchedText.toLowerCase() !== draft.matchedText.toLowerCase()
      ) {
        return null;
      }

      return {
        ...draft,
        matchStart: result.matchStart,
        matchEnd: result.matchEnd,
      };
    }

    const phrase = draft.matchedText.toLowerCase();
    const normalizedValue = value.toLowerCase();
    const matches: Array<{ start: number; end: number }> = [];
    let searchStart = 0;

    while (searchStart < value.length) {
      const start = normalizedValue.indexOf(phrase, searchStart);
      if (start < 0) break;
      const end = start + phrase.length;
      if (this.isStandaloneClearedPhrase(value, start, end)) {
        matches.push({ start, end });
      }
      searchStart = end;
    }

    if (matches.length !== 1) return null;
    return {
      ...draft,
      matchStart: matches[0].start,
      matchEnd: matches[0].end,
    };
  }

  private isStandaloneClearedPhrase(value: string, start: number, end: number): boolean {
    const before = value.slice(0, start);
    const after = value.slice(end);
    const previousCharacter = before.slice(-1);
    const nextCharacter = after[0] ?? '';

    if (/[A-Za-z0-9]/.test(previousCharacter) || /[A-Za-z0-9]/.test(nextCharacter)) {
      return false;
    }
    if ('#@/\\-–—'.includes(previousCharacter) || /['’@]/.test(nextCharacter)) {
      return false;
    }
    if (/(?:https?:\/\/|www\.)$/i.test(before.slice(-100)) || /[A-Za-z0-9]['’]\s*$/.test(before)) {
      return false;
    }

    const previousWord = before.trimEnd().split(/\s+/).pop()?.toLowerCase();
    return !previousWord || !['on', 'next', 'in', 'last', 'this'].includes(previousWord);
  }

  private referenceForParsing(): DateTime {
    return this.referenceDate ?? this.currentReferenceDate();
  }

  private scheduleReferenceDateRefresh() {
    if (this.referenceDateTimer !== null) {
      clearTimeout(this.referenceDateTimer);
    }

    const now = DateTime.now();
    const nextMidnight = now.plus({ days: 1 }).startOf('day');
    const delay = Math.max(1_000, Math.ceil(nextMidnight.diff(now, 'milliseconds').milliseconds));

    this.ngZone.runOutsideAngular(() => {
      this.referenceDateTimer = setTimeout(() => {
        this.referenceDateTimer = null;
        this.ngZone.run(() => {
          if (this.referenceDate === null) {
            this.currentReferenceDate.set(startOfToday());
            this.reparseDueDate(this.title());
            this.cdr.detectChanges();
          }
        });
        this.scheduleReferenceDateRefresh();
      }, delay);
    });
  }

  protected onCaptureInput() {
    const input = this.captureInput()?.nativeElement;
    if (!input) return;

    const hl = this.highlighter()?.nativeElement;
    if (hl) hl.scrollLeft = input.scrollLeft;

    const value = input.value;
    const pos = input.selectionStart || 0;

    const lastHash = value.lastIndexOf('#', pos - 1);
    if (lastHash !== -1) {
      const textSinceHash = value.substring(lastHash + 1, pos);
      if (!textSinceHash.includes(' ')) {
        this.activeTagSearch.set(textSinceHash);
        this.selectedSuggestionIndex.set(0);
        return;
      }
    }

    this.activeTagSearch.set(null);
  }

  protected onCaptureKeyDown(event: KeyboardEvent) {
    if (this.activeTagSearch() !== null && this.tagSuggestions().length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectedSuggestionIndex.update((i) => (i + 1) % this.tagSuggestions().length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectedSuggestionIndex.update(
          (i) => (i - 1 + this.tagSuggestions().length) % this.tagSuggestions().length,
        );
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        this.selectSuggestion(this.tagSuggestions()[this.selectedSuggestionIndex()].name);
      } else if (event.key === 'Escape') {
        this.activeTagSearch.set(null);
      }
    }
  }

  protected selectSuggestion(labelName: string) {
    const input = this.captureInput()?.nativeElement;
    if (!input) return;

    const value = input.value;
    const pos = input.selectionStart || 0;
    const lastHash = value.lastIndexOf('#', pos - 1);

    if (lastHash !== -1) {
      const newValue = value.substring(0, lastHash) + '#' + labelName + ' ' + value.substring(pos);
      const newPos = lastHash + labelName.length + 2;
      this.updateTitle(newValue);
      this.activeTagSearch.set(null);

      requestAnimationFrame(() => {
        const el = this.captureInput()?.nativeElement;
        if (!el) return;
        el.setSelectionRange(newPos, newPos);
        el.focus();
      });
    }
  }
}
