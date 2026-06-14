import {
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
  computed,
  ElementRef,
  viewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { LabelService } from '../../../core/services/label.service';
import { highlightInlineCommands } from '../../../shared/utils/html-helpers';

@Component({
  selector: 'app-capture-bar',
  standalone: true,
  imports: [FormsModule, FontAwesomeModule],
  template: `
    <form id="capture" class="capture-bar" (ngSubmit)="submit.emit()">
      <div class="capture-input-container">
        <div class="capture-highlighter" aria-hidden="true" [innerHTML]="highlightedTitle()"></div>
        <input
          #captureInput
          type="text"
          name="captureTitle"
          [ngModel]="title()"
          (ngModelChange)="title.set($event)"
          (input)="onCaptureInput()"
          (keydown)="onCaptureKeyDown($event)"
          placeholder="What's on your mind today?"
          autocomplete="off"
          [attr.aria-invalid]="error() ? 'true' : 'false'"
          [attr.aria-describedby]="error() ? 'capture-error' : null"
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
          inset 0 0 0 1px var(--primary-soft),
          0 12px 24px var(--surface-dim);
      }
    }

    .capture-input-container {
      position: relative;
      flex: 1;
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
      display: flex;
      align-items: center;
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
        color: var(--status-overdue);
        font-weight: 800;
      }

      .hl-label {
        color: var(--primary-solid);
        font-weight: 800;
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
export class CaptureBarComponent {
  @Input({ required: true }) projects: { id: string; name: string }[] = [];
  @Input({ required: true }) creating = false;
  @Input({ required: true }) defaultProjectId = '';
  @Output() readonly submit = new EventEmitter<void>();

  protected readonly title = signal('');
  protected readonly error = signal('');
  protected readonly projectId = signal('');
  protected lastSubmissionType: 'quick' | 'capture' | 'default' = 'default';

  protected readonly activeTagSearch = signal<string | null>(null);
  protected readonly selectedSuggestionIndex = signal(0);

  private readonly labelService = inject(LabelService);
  private readonly captureInput = viewChild<ElementRef<HTMLInputElement>>('captureInput');

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
    return highlightInlineCommands(text);
  });

  /** Expose for parent to set initial title */
  setTitle(value: string) {
    this.title.set(value);
  }

  clearTitle() {
    this.title.set('');
    this.activeTagSearch.set(null);
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

  getLastSubmissionType(): 'quick' | 'capture' | 'default' {
    return this.lastSubmissionType;
  }

  setSubmissionType(type: 'quick' | 'capture' | 'default') {
    this.lastSubmissionType = type;
  }

  resetSubmissionType() {
    this.lastSubmissionType = 'default';
  }

  protected onCaptureInput() {
    const input = this.captureInput()?.nativeElement;
    if (!input) return;

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
      this.title.set(newValue);
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
