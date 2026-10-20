import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  DEFAULT_LABEL_ICON,
  LABEL_COLORS,
  isLabelIcon,
  pickLabelColorForName,
  type Label,
  type LabelColor,
  type LabelIcon,
} from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';
import { LogService } from '../../../core/services/log.service';
import { LabelChipComponent } from '../../../shared/ui/label-chip/label-chip.component';
import { LabelIconPickerComponent } from '../../../shared/ui/label-icon-picker/label-icon-picker.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { existingLabelFromConflict } from '../../../shared/utils/label-conflict';
import { suggestLabelIcon } from '../../../shared/utils/label-icons';

/** Matches the practical input length the API trims before persisting. */
const LABEL_NAME_MAX_LENGTH = 60;

/**
 * The one label create/edit surface. It opens as a right-side drawer on
 * desktop and a full-height sheet on mobile, shows a live chip preview, and
 * owns name, color, icon, validation, and the duplicate-name path. Delete is a
 * labeled danger action here and in the directory menu; the page owns the
 * confirmation dialog.
 */
@Component({
  selector: 'app-label-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LabelChipComponent,
    LabelIconPickerComponent,
    ModalComponent,
  ],
  template: `
    <app-modal
      [open]="open"
      [title]="label ? 'Edit label' : 'New label'"
      size="md"
      layout="drawer"
      [showFooter]="false"
      (close)="close.emit()"
    >
      <form class="label-editor" (ngSubmit)="save()">
        <section class="preview" aria-label="Label preview">
          <span class="field-label">Preview</span>
          <app-label-chip [label]="previewLabel()" />
        </section>

        <label class="field">
          <span class="field-label">Name</span>
          <input
            type="text"
            name="labelName"
            autocomplete="off"
            autofocus
            [maxlength]="nameMaxLength"
            [class.field-invalid]="!!nameError()"
            [ngModel]="draftName()"
            (ngModelChange)="onNameChange($event)"
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
          <div class="palette-grid" role="group" aria-label="Label color">
            @if (customSwatch(); as custom) {
              <button
                type="button"
                class="palette-tile palette-tile-active"
                [style.background]="custom"
                [attr.aria-pressed]="true"
                [attr.aria-label]="'Current color ' + custom"
                [title]="custom"
              >
                <span class="check" aria-hidden="true">✓</span>
              </button>
            }
            @for (color of palette; track color) {
              <button
                type="button"
                class="palette-tile"
                [class.palette-tile-active]="draftColor() === color"
                [style.background]="color"
                [attr.aria-pressed]="draftColor() === color"
                [attr.aria-label]="'Use color ' + color"
                (click)="chooseColor(color)"
              >
                @if (draftColor() === color) {
                  <span class="check" aria-hidden="true">✓</span>
                }
              </button>
            }
          </div>
        </div>

        <div class="field">
          <span class="field-label">Icon</span>
          <app-label-icon-picker
            [icon]="draftIcon()"
            [color]="draftColor()"
            [suggested]="suggestedIcon()"
            (iconChange)="chooseIcon($event)"
          />
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

        @if (label; as editing) {
          <section class="danger-zone" aria-label="Delete label">
            <strong>Delete {{ editing.name }}</strong>
            <p>
              It is on {{ editing.openTaskCount ?? 0 }} open and
              {{ editing.completedTaskCount ?? 0 }} completed tasks. The tasks will stay; the label
              will be removed.
            </p>
            <button type="button" class="danger-button" (click)="deleteRequest.emit(editing)">
              Delete label
            </button>
          </section>
        }

        <div class="editor-actions">
          <button type="button" class="secondary-button" (click)="close.emit()">Cancel</button>
          <button
            type="submit"
            class="primary-button"
            [disabled]="saveDisabled()"
            [attr.aria-busy]="saving()"
          >
            {{ saving() ? 'Saving…' : label ? 'Save changes' : 'Create label' }}
          </button>
        </div>
      </form>
    </app-modal>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .label-editor {
        display: grid;
        gap: 1.05rem;
      }

      .preview {
        display: grid;
        gap: 0.4rem;
        padding: 0.85rem;
        border-radius: 0.9rem;
        background: var(--surface-container-low);
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

      .palette-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(2.2rem, 1fr));
        gap: 0.65rem;
      }

      .palette-tile {
        aspect-ratio: 1;
        border: 0;
        border-radius: 0.85rem;
        box-shadow: inset 0 0 0 1px var(--surface-dim);
        display: grid;
        place-items: center;
        cursor: pointer;
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

      .danger-zone {
        display: grid;
        gap: 0.4rem;
        padding: 0.85rem;
        border-radius: 0.9rem;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-overdue) 35%, transparent);
      }

      .danger-zone strong {
        color: var(--on-surface);
        font-size: 0.92rem;
      }

      .danger-zone p {
        margin: 0;
        color: var(--on-surface-muted);
        font-size: 0.82rem;
        line-height: 1.4;
      }

      .danger-button {
        justify-self: start;
        min-height: 2.6rem;
        border: 0;
        border-radius: 0.8rem;
        padding: 0 0.9rem;
        background: var(--error-soft);
        color: var(--status-overdue);
        font: inherit;
        font-weight: 750;
        cursor: pointer;
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
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class LabelEditorComponent implements OnChanges {
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
  /** The page owns the confirmation dialog for this request. */
  @Output() readonly deleteRequest = new EventEmitter<Label>();

  protected readonly draftName = signal('');
  protected readonly draftColor = signal<string>(LABEL_COLORS[0]);
  protected readonly draftIcon = signal<LabelIcon>(DEFAULT_LABEL_ICON);
  protected readonly nameError = signal<string | null>(null);
  protected readonly requestError = signal<string | null>(null);
  protected readonly existingLabel = signal<{ id: string; name: string } | null>(null);
  protected readonly saving = signal(false);
  protected readonly nameMaxLength = LABEL_NAME_MAX_LENGTH;
  protected readonly palette = LABEL_COLORS;
  private readonly iconTouched = signal(false);
  private readonly colorTouched = signal(false);

  protected readonly suggestedIcon = computed(() => suggestLabelIcon(this.draftName()));

  /** A legacy color outside the palette stays visible so saving never recolors it. */
  protected readonly customSwatch = computed(() => {
    const color = this.draftColor();
    return color && !(LABEL_COLORS as readonly string[]).includes(color) ? color : null;
  });

  protected readonly previewLabel = computed<Label>(() => ({
    id: this.label?.id ?? 'preview',
    userId: this.label?.userId ?? '',
    name: this.draftName().trim() || 'Label name',
    color: this.draftColor(),
    icon: this.draftIcon(),
    pinned: this.label?.pinned ?? false,
  }));

  protected readonly saveDisabled = computed(() => this.saving() || !this.draftName().trim());

  ngOnChanges() {
    if (!this.open) {
      return;
    }

    this.nameError.set(null);
    this.requestError.set(null);
    this.existingLabel.set(null);
    this.draftName.set(this.label?.name ?? '');
    this.draftColor.set(this.label?.color || pickLabelColorForName(this.label?.name ?? ''));
    this.draftIcon.set(
      this.label && isLabelIcon(this.label.icon) ? this.label.icon : suggestLabelIcon(''),
    );
    // Editing keeps the label's identity; creating follows suggestions until
    // the user makes an explicit choice.
    this.iconTouched.set(this.label !== null);
    this.colorTouched.set(this.label !== null);
  }

  protected onNameChange(value: string) {
    this.draftName.set(value);
    this.nameError.set(null);
    this.requestError.set(null);
    this.existingLabel.set(null);

    if (!this.iconTouched()) {
      this.draftIcon.set(suggestLabelIcon(value));
    }
    if (!this.colorTouched()) {
      this.draftColor.set(pickLabelColorForName(value));
    }
  }

  protected chooseIcon(icon: LabelIcon) {
    this.iconTouched.set(true);
    this.draftIcon.set(icon);
  }

  protected chooseColor(color: LabelColor) {
    this.colorTouched.set(true);
    this.draftColor.set(color);
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
    this.existingLabel.set(null);
    try {
      const payload = { name, color: this.draftColor(), icon: this.draftIcon() };
      const saved = this.label
        ? await this.labelService.updateLabel(this.label.id, payload)
        : await this.labelService.createLabel(payload);
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
