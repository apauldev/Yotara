import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateLabelDto, Label, UpdateLabelDto } from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';

type LabelModalMode = 'create' | 'edit';

@Component({
  selector: 'app-label-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ConfirmDialogComponent],
  template: `
    <app-modal
      [open]="open"
      [title]="mode === 'create' ? 'Create Label' : 'Edit Label'"
      size="lg"
      (close)="close.emit()"
    >
      <div class="label-modal-shell">
        <aside class="label-list">
          <div class="label-list-header">
            <h3>Manage Labels</h3>
            <p>Organize your flow with custom tags.</p>
          </div>

          <button type="button" class="create-card" (click)="startCreate()">
            <span class="plus">+</span>
            <span>Create New Label</span>
          </button>

          <div class="label-rail">
            @for (label of labels; track label.id) {
              <button
                type="button"
                class="label-rail-item"
                [class.label-rail-item-active]="selectedLabelId === label.id"
                (click)="selectLabel(label)"
              >
                <span class="label-rail-dot" [style.background]="label.color"></span>
                <span class="label-rail-name">{{ label.name }}</span>
                <span class="label-rail-count">{{ label.taskCount ?? 0 }}</span>
              </button>
            }
          </div>
        </aside>

        <section class="label-editor">
          <div class="editor-header">
            <div>
              <h3>{{ mode === 'create' ? 'Add Label' : 'Edit Label' }}</h3>
              <p>{{ mode === 'create' ? 'Create a new label and save it immediately.' : 'Refine how you identify your focus areas.' }}</p>
            </div>

            @if (mode === 'edit') {
              <button type="button" class="icon-button" aria-label="Delete label" (click)="askDelete()">
                ×
              </button>
            }
          </div>

          <label class="field">
            <span class="field-label">Label Name</span>
            <input
              type="text"
              [ngModel]="draftName()"
              (ngModelChange)="draftName.set($event)"
              placeholder="Creative"
            />
          </label>

          <div class="field">
            <span class="field-label">Color Theme</span>
            <div class="palette-grid">
              @for (color of palette; track color) {
                <button
                  type="button"
                  class="palette-tile"
                  [class.palette-tile-active]="draftColor() === color"
                  [style.background]="color"
                  (click)="draftColor.set(color)"
                >
                  @if (draftColor() === color) {
                    <span class="check">✓</span>
                  }
                </button>
              }
            </div>
          </div>

          <div class="editor-actions">
            <button type="button" class="secondary-button" (click)="close.emit()">Cancel</button>
            <button type="button" class="primary-button" (click)="save()">
              {{ mode === 'create' ? 'Create Label' : 'Save Changes' }}
            </button>
          </div>

          <button
            type="button"
            class="text-action"
            (click)="mode === 'create' ? saveAndContinue() : startCreate()"
          >
            {{ mode === 'create' ? 'Create and keep editing' : 'Add another label' }}
          </button>
        </section>
      </div>
    </app-modal>

    <app-confirm-dialog
      [open]="deleteConfirmOpen()"
      [title]="'Delete label ' + (draftName() || 'this label') + '?'"
      description="This will remove it from all tasks. This action is permanent and cannot be undone."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      [danger]="true"
      (confirm)="deleteLabel()"
      (cancel)="deleteConfirmOpen.set(false)"
      (close)="deleteConfirmOpen.set(false)"
    />
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .label-modal-shell {
        display: grid;
        grid-template-columns: minmax(15rem, 19rem) minmax(0, 1fr);
        min-height: 31rem;
        background: linear-gradient(90deg, #f3efe3 0%, #fbf8f1 100%);
        border-radius: 1.35rem;
        overflow: hidden;
      }

      .label-list {
        padding: 1.2rem 1.05rem;
        background: rgba(255, 255, 255, 0.28);
        box-shadow: inset -1px 0 0 rgba(115, 115, 96, 0.1);
      }

      .label-list-header h3,
      .editor-header h3 {
        margin: 0;
        font-size: 1.55rem;
        letter-spacing: -0.04em;
      }

      .label-list-header p,
      .editor-header p {
        margin: 0.45rem 0 0;
        color: var(--on-surface-muted);
      }

      .create-card {
        width: 100%;
        min-height: 4rem;
        margin-top: 0.85rem;
        border-radius: 0.95rem;
        border: 1px dashed rgba(115, 115, 96, 0.25);
        background: rgba(255, 255, 255, 0.4);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0 1rem;
        color: var(--on-surface-muted);
        font-weight: 700;
      }

      .plus {
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.9);
      }

      .label-rail {
        display: grid;
        gap: 0.55rem;
        margin-top: 0.85rem;
      }

      .label-rail-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.6rem;
        min-height: 3.15rem;
        border-radius: 0.95rem;
        padding: 0 0.8rem;
        background: transparent;
        color: var(--on-surface-muted);
        text-align: left;
      }

      .label-rail-item-active {
        background: rgba(255, 255, 255, 0.72);
        color: #123b2e;
      }

      .label-rail-dot {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 999px;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
      }

      .label-rail-name {
        font-weight: 700;
      }

      .label-rail-count {
        min-width: 1.75rem;
        text-align: right;
        font-size: 0.8rem;
        color: var(--on-surface-subtle);
      }

      .label-editor {
        padding: 1.6rem 1.6rem 1.25rem;
        background: rgba(255, 255, 255, 0.86);
        display: grid;
        align-content: start;
        gap: 1rem;
      }

      .editor-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.85rem;
      }

      .icon-button {
        border: 0;
        background: transparent;
        font-size: 1.8rem;
        color: var(--on-surface-muted);
        line-height: 1;
      }

      .field {
        display: grid;
        gap: 0.4rem;
      }

      .field-label {
        color: var(--on-surface-subtle);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.75rem;
        font-weight: 800;
      }

      input {
        min-height: 3.05rem;
        border: 0;
        border-radius: 0.95rem;
        background: rgba(245, 242, 231, 0.9);
        box-shadow: inset 0 0 0 1px rgba(115, 115, 96, 0.12);
        padding: 0 1rem;
        font: inherit;
        color: var(--on-surface);
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
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
        display: grid;
        place-items: center;
      }

      .palette-tile-active {
        box-shadow:
          inset 0 0 0 2px rgba(255, 255, 255, 0.8),
          0 8px 22px rgba(0, 0, 0, 0.12);
      }

      .check {
        color: #fff;
        font-weight: 800;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
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
      }

      .primary-button {
        flex: 1;
        background: linear-gradient(135deg, #2b7c55 0%, #1c5f42 100%);
        color: #fff;
      }

      .secondary-button {
        background: rgba(236, 231, 218, 0.9);
        color: var(--on-surface-muted);
      }

      .text-action {
        justify-self: start;
        border: 0;
        background: transparent;
        color: #2b7c55;
        font-weight: 700;
        padding: 0;
        font-size: 0.95rem;
      }

      @media (max-width: 900px) {
        .label-modal-shell {
          grid-template-columns: 1fr;
        }

        .label-list {
          box-shadow: inset 0 -1px 0 rgba(115, 115, 96, 0.1);
        }
      }
    `,
  ],
})
export class LabelModalComponent {
  private readonly labelService = inject(LabelService);

  @Input() open = false;
  @Input() labels: Label[] = [];
  @Input() selectedLabelId: string | null = null;
  @Input() mode: LabelModalMode = 'create';
  @Input() taskCountForSelected = 0;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<void>();
  @Output() readonly deleted = new EventEmitter<void>();
  @Output() readonly selectedLabelIdChange = new EventEmitter<string | null>();

  protected readonly draftName = signal('');
  protected readonly draftColor = signal('');
  protected readonly deleteConfirmOpen = signal(false);
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

  ngOnChanges() {
    const selected = this.labels.find((label) => label.id === this.selectedLabelId) ?? null;
    if (this.mode === 'edit' && selected) {
      this.hydrate(selected);
      return;
    }

    if (this.mode === 'create') {
      this.draftName.set('');
      this.draftColor.set(this.palette[0]);
      return;
    }

    if (!selected && this.labels.length > 0) {
      this.selectLabel(this.labels[0]);
    }
  }

  protected selectLabel(label: Label) {
    this.selectedLabelIdChange.emit(label.id);
    this.hydrate(label);
    this.mode = 'edit';
  }

  protected startCreate() {
    this.mode = 'create';
    this.selectedLabelIdChange.emit(null);
    this.draftName.set('');
    this.draftColor.set(this.palette[0]);
  }

  protected async save() {
    const name = this.draftName().trim();
    if (!name) {
      return;
    }

    if (this.mode === 'create') {
      const created = await this.labelService.createLabel({
        name,
        color: this.draftColor(),
      });
      this.selectedLabelIdChange.emit(created.id);
      this.saved.emit();
      this.mode = 'edit';
      return;
    }

    if (!this.selectedLabelId) {
      return;
    }

    await this.labelService.updateLabel(this.selectedLabelId, {
      name,
      color: this.draftColor(),
    });
    this.saved.emit();
    this.close.emit();
  }

  protected async saveAndContinue() {
    await this.save();
    this.startCreate();
  }

  protected askDelete() {
    this.deleteConfirmOpen.set(true);
  }

  protected async deleteLabel() {
    if (!this.selectedLabelId) {
      return;
    }

    await this.labelService.deleteLabel(this.selectedLabelId);
    this.deleteConfirmOpen.set(false);
    this.deleted.emit();
    this.startCreate();
  }

  private hydrate(label: Label) {
    this.draftName.set(label.name);
    this.draftColor.set(label.color);
  }
}
