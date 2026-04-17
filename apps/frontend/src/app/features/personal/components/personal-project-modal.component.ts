import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { CreateProjectDto, ProjectColor } from '@yotara/shared';
import { PROJECT_PALETTE } from '../project-presentation';

@Component({
  selector: 'app-personal-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
              <h2 id="project-title">New Project</h2>
              <p>A project is a home for related tasks and progress.</p>
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
              placeholder="e.g. Morning Rituals"
            />
            @if (nameError()) {
              <p class="field-error-message">{{ nameError() }}</p>
            }
          </label>

          <label class="field">
            <span class="field-label">Description</span>
            <textarea
              name="projectDescription"
              rows="4"
              [ngModel]="draftDescription()"
              (ngModelChange)="draftDescription.set($event)"
              placeholder="Describe the sanctuary of this project..."
            ></textarea>
          </label>

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

          @if (error) {
            <p class="error-copy">{{ error }}</p>
          }

          <div class="actions">
            <button type="button" class="secondary-button" (click)="close.emit()">Cancel</button>
            <button type="button" class="primary-button" [disabled]="saving" (click)="submit()">
              {{ saving ? 'Creating...' : 'Create Project' }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .modal-shell {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }

      .backdrop {
        position: absolute;
        inset: 0;
        border: 0;
        background: rgba(41, 39, 31, 0.18);
        backdrop-filter: blur(10px);
      }

      .modal-card {
        position: relative;
        z-index: 1;
        width: min(100%, 32rem);
        border-radius: 1.7rem;
        background: rgba(255, 255, 255, 0.94);
        border: 1px solid rgba(235, 227, 208, 0.95);
        box-shadow: 0 28px 60px rgba(88, 79, 59, 0.18);
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
        color: #7e786d;
      }

      .close-button {
        border: 0;
        background: transparent;
        color: #6f6a5e;
        font-size: 2rem;
        line-height: 1;
      }

      .field {
        display: grid;
        gap: 0.55rem;
        margin-top: 1.25rem;
      }

      .field-label {
        color: #9c957f;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.76rem;
        font-weight: 800;
      }

      input,
      textarea {
        width: 100%;
        border: 1px solid rgba(231, 222, 204, 0.95);
        border-radius: 1rem;
        background: #f6f2e7;
        color: #2f302b;
        font: inherit;
        padding: 0.95rem 1rem;
        box-sizing: border-box;
      }

      textarea {
        resize: vertical;
        min-height: 7rem;
      }

      input.field-error {
        border-color: #ba6d57;
        background: rgba(255, 245, 242, 0.95);
      }

      .field-error-message,
      .error-copy {
        margin: 0;
        color: #ba6d57;
        font-size: 0.88rem;
      }

      .color-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.7rem;
      }

      .color-chip {
        --chip-color: #4a8a63;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        border: 0;
        background: var(--chip-color);
        box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.9);
      }

      .color-chip-active {
        outline: 2px solid var(--chip-color);
        outline-offset: 3px;
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
      }

      .primary-button {
        background: #2d7c53;
        color: #f7fbf6;
      }

      .secondary-button {
        background: #ede6d8;
        color: #5d584d;
      }

      @media (max-width: 640px) {
        .modal-shell {
          padding: 0;
          place-items: end center;
        }

        .modal-card {
          width: 100%;
          max-height: 92dvh;
          border-radius: 1.4rem 1.4rem 0 0;
          padding: 1.25rem;
          overflow: auto;
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
export class PersonalProjectModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() error: string | null = null;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<CreateProjectDto>();

  protected readonly palette = PROJECT_PALETTE;
  protected readonly draftName = signal('');
  protected readonly draftDescription = signal('');
  protected readonly draftColor = signal<ProjectColor>('sage');
  protected readonly nameError = signal<string | null>(null);

  protected submit() {
    const name = this.draftName().trim();

    if (!name) {
      this.nameError.set('Project name is required');
      return;
    }

    this.nameError.set(null);
    this.save.emit({
      name,
      description: this.draftDescription().trim() || undefined,
      color: this.draftColor(),
    });
  }
}
