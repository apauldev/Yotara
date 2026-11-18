import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Project, ProjectColor, ProjectFormPayload, ProjectKind } from '@yotara/shared';
import { PROJECT_PALETTE } from '../project-presentation';
import { DatePickerComponent } from '../../../shared/ui/date-picker/date-picker.component';
import { MarkdownEditorComponent } from '../../../shared/ui/markdown-editor/markdown-editor.component';

@Component({
  selector: 'app-personal-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, MarkdownEditorComponent],
  template: `
    @if (open) {
      <div class="modal-shell">
        <button
          type="button"
          class="backdrop"
          aria-label="Close project modal"
          (click)="close.emit()"
        ></button>

        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="project-title">
          <header class="modal-header">
            <div>
              <h2 id="project-title">{{ mode === 'edit' ? 'Edit Project' : 'New Project' }}</h2>
              <p>
                {{
                  mode === 'edit'
                    ? 'Adjust the name, type, description, or color of this project space.'
                    : 'A project is a home for related tasks and progress.'
                }}
              </p>
            </div>

            <button type="button" class="close-button" aria-label="Close" (click)="close.emit()">
              ×
            </button>
          </header>

          <label class="field">
            <span class="field-label">Project name</span>
            <input
              type="text"
              name="projectName"
              [ngModel]="draftName()"
              (ngModelChange)="draftName.set($event)"
              [class.field-error]="nameError()"
              placeholder="e.g. Launch website"
            />
            @if (nameError()) {
              <p class="field-error-message">{{ nameError() }}</p>
            }
          </label>

          <div class="field">
            <span class="field-label">Type</span>
            <div class="kind-cards" role="radiogroup" aria-label="Project Type">
              <button
                type="button"
                role="radio"
                class="kind-card"
                [class.kind-card-active]="draftKind() === 'project'"
                [attr.aria-checked]="draftKind() === 'project'"
                (click)="setKind('project')"
              >
                <strong>Project</strong>
                <span>A finite outcome with progress and an optional target date.</span>
              </button>

              <button
                type="button"
                role="radio"
                class="kind-card"
                [class.kind-card-active]="draftKind() === 'ongoing'"
                [attr.aria-checked]="draftKind() === 'ongoing'"
                (click)="setKind('ongoing')"
              >
                <strong>Ongoing area</strong>
                <span>A continuing part of life or work, such as Home or Health.</span>
              </button>
            </div>
          </div>

          <div class="field">
            <span class="field-label">Description</span>
            <app-markdown-editor
              [value]="draftDescription()"
              (valueChange)="draftDescription.set($event)"
              placeholder="What is this project for? Add useful context or links."
              [rows]="4"
            />
          </div>

          @if (draftKind() === 'project') {
            <div class="field">
              <span class="field-label">Target date (optional)</span>
              <app-date-picker
                label="Target date"
                [value]="draftTargetDate()"
                (valueChange)="draftTargetDate.set($event)"
              />
            </div>
          } @else if (draftTargetDate()) {
            <div class="field warning-box" role="alert">
              <p class="warning-text">
                Ongoing areas cannot have a target date. Clear the target date to continue saving as
                an Ongoing area.
              </p>
              <button
                type="button"
                class="secondary-button clear-date-button"
                (click)="clearTargetDate()"
              >
                Clear Target Date
              </button>
            </div>
          }

          @if (targetDateError()) {
            <p class="field-error-message">{{ targetDateError() }}</p>
          }

          <div class="field">
            <span class="field-label">Color identity</span>
            <div class="color-row">
              @for (option of palette; track option.value) {
                <button
                  type="button"
                  class="color-chip"
                  [class.color-chip-active]="draftColor() === option.value"
                  [style.--chip-color]="option.accent"
                  [attr.aria-label]="option.label"
                  (click)="draftColor.set(option.value)"
                ></button>
              }
            </div>
          </div>

          <label class="field pinned-field">
            <input
              type="checkbox"
              name="projectPinned"
              [ngModel]="draftPinned()"
              (ngModelChange)="draftPinned.set($event)"
            />
            <span>
              <strong>Pin to sidebar</strong>
              <small>Keep this project close at hand in the pinned group.</small>
            </span>
          </label>

          @if (error) {
            <p class="error-copy">{{ error }}</p>
          }

          <div class="actions">
            <button type="button" class="secondary-button" (click)="close.emit()">Cancel</button>
            <button type="button" class="primary-button" [disabled]="saving" (click)="submit()">
              {{
                saving
                  ? mode === 'edit'
                    ? 'Saving...'
                    : 'Creating...'
                  : mode === 'edit'
                    ? 'Save Changes'
                    : 'Create Project'
              }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: contents;
      }

      .modal-shell {
        position: fixed;
        inset: 0;
        z-index: var(--z-modal);
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }

      .backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        background: var(--backdrop-overlay);
        backdrop-filter: blur(10px);
      }

      .modal-card {
        position: relative;
        z-index: 1;
        width: min(100%, 34rem);
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 1.7rem;
        background: var(--surface-container-lowest);
        box-shadow:
          0 28px 60px var(--surface-dim-strong),
          inset 0 0 0 1px var(--outline-variant);
        padding: 1.5rem;
      }

      .modal-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      h2 {
        margin: 0;
        font-size: 2rem;
        letter-spacing: -0.05em;
      }

      .modal-header p {
        margin: 0.35rem 0 0;
        color: var(--on-surface-muted);
      }

      .close-button {
        border: 0;
        background: transparent;
        color: var(--on-surface-muted);
        font-size: 2rem;
        line-height: 1;
        display: inline-grid;
        place-items: center;
        cursor: pointer;
      }

      @media (pointer: coarse) {
        .close-button {
          min-width: 2.75rem;
          min-height: 2.75rem;
        }
      }

      .field {
        display: grid;
        gap: 0.55rem;
        margin-top: 1.25rem;
      }

      .field-label {
        color: var(--on-surface-subtle);
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.76rem;
        font-weight: 800;
      }

      .kind-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      .kind-card {
        display: flex;
        flex-direction: column;
        text-align: left;
        border: 1px solid var(--outline-variant);
        border-radius: 1rem;
        background: var(--surface-container-low);
        padding: 0.9rem 1rem;
        cursor: pointer;
        transition: all 150ms ease;

        &:hover {
          background: var(--surface-container-high);
        }

        &.kind-card-active {
          border-color: var(--primary-solid);
          background: color-mix(in srgb, var(--primary-soft) 40%, var(--surface-container-low));
          box-shadow: 0 0 0 1px var(--primary-solid);
        }

        strong {
          font-size: 0.92rem;
          color: var(--on-surface);
        }

        span {
          margin-top: 0.25rem;
          font-size: 0.78rem;
          color: var(--on-surface-muted);
          line-height: 1.4;
        }
      }

      .warning-box {
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        background: color-mix(in srgb, var(--status-overdue) 10%, var(--surface-container-low));
        border: 1px solid color-mix(in srgb, var(--status-overdue) 30%, var(--outline-variant));
      }

      .warning-text {
        margin: 0;
        font-size: 0.85rem;
        color: var(--status-overdue);
        line-height: 1.45;
      }

      .clear-date-button {
        justify-self: start;
        margin-top: 0.5rem;
        font-size: 0.82rem;
        min-height: 2.2rem;
      }

      input {
        width: 100%;
        border-radius: 1rem;
        background: var(--surface-container-lowest);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        color: var(--on-surface);
        font: inherit;
        padding: 0.95rem 1rem;
        box-sizing: border-box;
        border: 0;
      }

      input.field-error {
        box-shadow: inset 0 0 0 1px var(--status-overdue);
        background: color-mix(in srgb, var(--surface-container-lowest) 88%, var(--danger-soft));
      }

      .field-error-message,
      .error-copy {
        margin: 0.25rem 0 0;
        color: var(--status-overdue);
        font-size: 0.88rem;
      }

      .color-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.7rem;
      }

      .color-chip {
        --chip-color: var(--primary-solid);
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        border: 0;
        background: var(--chip-color);
        box-shadow:
          inset 0 0 0 3px color-mix(in srgb, hsl(var(--primary-foreground)) 90%, transparent),
          0 0 0 1px var(--project-dot-ring);
        cursor: pointer;
      }

      .color-chip-active {
        outline: 2px solid var(--chip-color);
        outline-offset: 3px;
      }

      .pinned-field {
        display: flex;
        align-items: flex-start;
        gap: 0.7rem;
        cursor: pointer;

        input {
          width: 1.05rem;
          height: 1.05rem;
          margin: 0.15rem 0 0;
          padding: 0;
          border: 0;
          border-radius: 0.25rem;
          background: transparent;
          accent-color: var(--primary-solid);
          flex: 0 0 auto;
        }

        strong {
          display: block;
          font-size: 0.9rem;
          color: var(--on-surface);
        }

        small {
          display: block;
          margin-top: 0.15rem;
          font-size: 0.78rem;
          color: var(--on-surface-muted);
        }
      }

      .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1.5rem;
      }

      .primary-button,
      .secondary-button {
        border: 0;
        border-radius: 1rem;
        min-height: 3rem;
        padding: 0 1.1rem;
        font-weight: 700;
        cursor: pointer;
      }

      .primary-button {
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
      }

      .secondary-button {
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
      }

      @media (max-width: 640px) {
        .modal-shell {
          padding: 0;
          padding-top: env(safe-area-inset-top, 0px);
          place-items: end center;
        }

        .modal-card {
          width: 100%;
          max-height: 92dvh;
          border-radius: 1.4rem 1.4rem 0 0;
          padding: 1.25rem;
          padding-left: calc(1.25rem + env(safe-area-inset-left, 0px));
          padding-right: calc(1.25rem + env(safe-area-inset-right, 0px));
          padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
        }

        .kind-cards {
          grid-template-columns: 1fr;
        }

        .actions {
          flex-direction: column;
          align-items: stretch;
        }

        .primary-button,
        .secondary-button {
          width: 100%;
        }
      }
    `,
  ],
})
export class PersonalProjectModalComponent implements OnChanges {
  @Input() open = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() project: Project | null = null;
  @Input() saving = false;
  @Input() error: string | null = null;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<ProjectFormPayload>();

  protected readonly palette = PROJECT_PALETTE;
  protected readonly draftName = signal('');
  protected readonly draftDescription = signal('');
  protected readonly draftColor = signal<ProjectColor>('sage');
  protected readonly draftKind = signal<ProjectKind>('project');
  protected readonly draftTargetDate = signal('');
  protected readonly draftPinned = signal(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly targetDateError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges) {
    if (this.open && (changes['open'] || changes['mode'] || changes['project'])) {
      this.hydrateDrafts();
    }

    if (changes['open'] && !this.open) {
      this.nameError.set(null);
      this.targetDateError.set(null);
    }
  }

  protected setKind(kind: ProjectKind) {
    this.draftKind.set(kind);
    if (kind === 'ongoing' && this.draftTargetDate()) {
      this.targetDateError.set(
        'Ongoing areas cannot have a target date. Clear the target date to continue.',
      );
    } else {
      this.targetDateError.set(null);
    }
  }

  protected clearTargetDate() {
    this.draftTargetDate.set('');
    this.targetDateError.set(null);
  }

  protected submit() {
    const name = this.draftName().trim();

    if (!name) {
      this.nameError.set('Project name is required');
      return;
    }

    if (this.draftKind() === 'ongoing' && this.draftTargetDate()) {
      this.targetDateError.set(
        'Ongoing areas cannot have a target date. Clear the target date before saving.',
      );
      return;
    }

    this.nameError.set(null);
    this.targetDateError.set(null);
    this.save.emit({
      name,
      description: this.draftDescription().trim() || null,
      color: this.draftColor(),
      kind: this.draftKind(),
      targetDate: this.draftKind() === 'project' ? this.draftTargetDate() || null : null,
      pinned: this.draftPinned(),
    });
  }

  private hydrateDrafts() {
    if (this.mode === 'edit' && this.project) {
      this.draftName.set(this.project.name);
      this.draftDescription.set(this.project.description ?? '');
      this.draftColor.set(this.project.color ?? 'sage');
      this.draftKind.set(this.project.kind ?? 'project');
      this.draftTargetDate.set(this.project.targetDate ?? '');
      this.draftPinned.set(this.project.pinned);
    } else {
      this.draftName.set('');
      this.draftDescription.set('');
      this.draftColor.set('sage');
      this.draftKind.set('project');
      this.draftTargetDate.set('');
      this.draftPinned.set(false);
    }

    this.nameError.set(null);
    this.targetDateError.set(null);
  }
}
