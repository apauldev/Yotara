import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Label } from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { LogService } from '../../../core/services/log.service';
import { existingLabelFromConflict } from '../../../shared/utils/label-conflict';

/** Matches the practical input length the API trims before persisting. */
const LABEL_NAME_MAX_LENGTH = 60;

/**
 * The one create/edit form for a single label. The Labels page owns the
 * directory, delete, and selection — this modal never lists labels (the
 * duplicate manager rail was removed in the Phase 1 redesign).
 */
@Component({
  selector: 'app-label-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
    <app-modal [open]="open" title="Label" size="sm" [showFooter]="false" (close)="close.emit()">
      <form class="label-editor" (ngSubmit)="save()">
        <h3 class="editor-heading">
          {{ label ? 'Edit label' : 'Create label' }}
        </h3>

        <label class="field">
          <span class="field-label">Name</span>
          <input
            #nameInput
            type="text"
            name="labelName"
            autocomplete="off"
            [maxlength]="nameMaxLength"
            [class.field-invalid]="!!nameError()"
            [ngModel]="draftName()"
            (ngModelChange)="
              draftName.set($event);
              nameError.set(null);
              requestError.set(null);
              existingLabel.set(null)
            "
            [attr.aria-invalid]="nameError() ? 'true' : null"
            [attr.aria-describedby]="nameError() ? 'label-name-error' : null"
            placeholder="Errand"
            (keydown.enter)="save(); $event.preventDefault()"
          />
          @if (nameError()) {
            <span id="label-name-error" class="field-error" role="alert">{{ nameError() }}</span>
          }
        </label>

        <div class="field">
          <span class="field-label">Color</span>
          <div class="palette-grid">
            @for (color of palette; track color) {
              <button
                type="button"
                class="palette-tile"
                [class.palette-tile-active]="draftColor() === color"
                [style.background]="color"
                [attr.aria-pressed]="draftColor() === color"
                [attr.aria-label]="'Use color ' + color"
                (click)="draftColor.set(color)"
              >
                @if (draftColor() === color) {
                  <span class="check" aria-hidden="true">✓</span>
                }
              </button>
            }
          </div>
        </div>

        @if (requestError()) {
          <p class="field-error" role="alert">{{ requestError() }}</p>
        }

        @if (existingLabel(); as existing) {
          <button
            type="button"
            class="existing-label-link"
            (click)="openExisting.emit(existing.id)"
          >
            Open “{{ existing.name }}”
          </button>
        }

        <div class="editor-actions">
          <button type="button" class="secondary-button" (click)="close.emit()">Cancel</button>
          <button
            type="submit"
            class="primary-button"
            [disabled]="saveLabelDisabled()"
            [attr.aria-busy]="saving()"
          >
            {{ saving() ? 'Saving…' : label ? 'Save changes' : 'Create label' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: contents;
      }

      .label-editor {
        display: grid;
        gap: 1.05rem;
      }

      .editor-heading {
        margin: 0;
        font-size: 1.02rem;
        color: var(--on-surface-subtle);
      }

      .field {
        display: grid;
        gap: 0.4rem;
      }

      .field-label {
        color: var(--on-surface-subtle);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.72rem;
        font-weight: 800;
      }

      input {
        min-height: 3.05rem;
        border: 0;
        border-radius: 0.95rem;
        background: var(--input);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 0 1rem;
        font: inherit;
        color: var(--on-surface);
      }

      .field-invalid {
        box-shadow: inset 0 0 0 1px var(--status-overdue);
      }

      .field-error {
        color: var(--status-overdue);
        font-size: 0.88rem;
      }

      .existing-label-link {
        justify-self: start;
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--primary-solid);
        font: inherit;
        font-size: 0.88rem;
        font-weight: 700;
        padding: 0;
        text-decoration: underline;
        cursor: pointer;
      }

      .palette-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0.7rem;
      }

      .palette-tile {
        aspect-ratio: 1;
        border-radius: 0.95rem;
        border: 0;
        box-shadow: inset 0 0 0 1px var(--surface-dim);
        display: grid;
        place-items: center;
      }

      .palette-tile-active {
        box-shadow:
          inset 0 0 0 2px color-mix(in srgb, hsl(var(--primary-foreground)) 80%, transparent),
          0 8px 22px var(--surface-dim-strong);
      }

      .check {
        color: white;
        font-weight: 800;
        text-shadow: 0 1px 1px var(--surface-dim-strong);
      }

      .editor-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: auto;
        padding-top: 0.85rem;
      }

      .primary-button,
      .secondary-button {
        min-height: 2.85rem;
        border: 0;
        border-radius: 0.95rem;
        padding: 0 1rem;
        font-weight: 700;
        cursor: pointer;
      }

      .primary-button {
        flex: 1;
        background: var(--primary-action-gradient);
        color: hsl(var(--primary-foreground));
      }

      .primary-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .secondary-button {
        background: var(--surface-container-high);
        color: var(--on-surface-muted);
      }
    `,
  ],
})
export class LabelModalComponent implements OnChanges {
  private readonly labelService = inject(LabelService);
  private readonly logService = inject(LogService);

  /** The label to edit, or null to create one. */
  @Input() label: Label | null = null;
  @Input() open = false;

  @Output() readonly close = new EventEmitter<void>();
  /** Emitted after a successful create or update; the page reflows itself. */
  @Output() readonly saved = new EventEmitter<Label>();
  /** Duplicate-name conflict: the id of the label that already exists. */
  @Output() readonly openExisting = new EventEmitter<string>();

  protected readonly draftName = signal('');
  protected readonly draftColor = signal('');
  protected readonly nameError = signal<string | null>(null);
  protected readonly requestError = signal<string | null>(null);
  protected readonly existingLabel = signal<{ id: string; name: string } | null>(null);
  protected readonly saving = signal(false);
  protected readonly nameMaxLength = LABEL_NAME_MAX_LENGTH;
  protected readonly palette = [
    '#2b7c55',
    '#2c7680',
    '#7b8d73',
    '#d19b92',
    '#86b8ff',
    '#f1c582',
    '#b6c4ae',
    '#dee0d8',
    '#8dd0d6',
    '#b7a3e7',
  ];

  protected saveLabelDisabled() {
    return this.saving() || !this.draftName().trim();
  }

  ngOnChanges() {
    if (!this.open) {
      return;
    }

    this.nameError.set(null);
    this.requestError.set(null);
    this.existingLabel.set(null);
    this.draftName.set(this.label?.name ?? '');
    this.draftColor.set(this.label?.color || this.palette[0]);
  }

  protected async save() {
    const name = this.draftName().trim();
    if (!name) {
      this.nameError.set('A label name is required.');
      return;
    }

    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.requestError.set(null);
    try {
      const saved = this.label
        ? await this.labelService.updateLabel(this.label.id, { name, color: this.draftColor() })
        : await this.labelService.createLabel({ name, color: this.draftColor() });
      this.saved.emit(saved);
      this.close.emit();
    } catch (error) {
      const existing = existingLabelFromConflict(error);
      this.existingLabel.set(existing);
      this.requestError.set(
        existing
          ? `A label named “${existing.name}” already exists.`
          : describeLabelError(error, name),
      );
      this.logService.warn('Label save failed', error);
    } finally {
      this.saving.set(false);
    }
  }
}

/** Inline, human-readable errors for create/update failures (409 etc.). */
function describeLabelError(error: unknown, name: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 409) {
      return `A label named “${name}” already exists.`;
    }
    if (error.status === 400) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'Check the label name and color, then try again.';
    }
    return 'Could not save the label right now. Try again.';
  }
  return 'Could not save the label right now. Try again.';
}
