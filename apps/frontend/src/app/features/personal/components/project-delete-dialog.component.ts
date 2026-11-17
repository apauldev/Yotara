import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { Project } from '@yotara/shared';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-project-delete-dialog',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  template: `
    <app-modal
      [open]="open"
      [title]="project ? 'Delete “' + project.name + '”?' : 'Delete project?'"
      size="md"
      (close)="close.emit()"
    >
      <div class="delete-dialog-content">
        <p class="delete-summary">
          @if ((project?.taskCount ?? 0) === 0) {
            This project has no tasks.
          } @else {
            This project contains
            <strong
              >{{ project?.taskCount }} {{ project?.taskCount === 1 ? 'task' : 'tasks' }}</strong
            >. Choose what happens to them:
          }
        </p>

        <div class="delete-options" role="radiogroup" aria-label="Task handling options">
          <button
            type="button"
            role="radio"
            class="delete-option-card"
            [class.selected]="keepTasks()"
            [attr.aria-checked]="keepTasks()"
            (click)="keepTasks.set(true)"
          >
            <div class="option-header">
              <strong>Delete project, keep tasks</strong>
              <span class="recommended-badge">Recommended</span>
            </div>
            <p>
              Tasks lose their project assignment but keep their dates, labels, and notes. Undated
              open tasks return to your Inbox.
            </p>
          </button>

          <button
            type="button"
            role="radio"
            class="delete-option-card option-danger"
            [class.selected]="!keepTasks()"
            [attr.aria-checked]="!keepTasks()"
            (click)="keepTasks.set(false)"
          >
            <div class="option-header">
              <strong>Delete project and tasks</strong>
            </div>
            <p>
              The project and its tasks move to Trash and can be restored together within 30 days.
            </p>
          </button>
        </div>
      </div>

      <div modal-footer class="delete-actions">
        <button #cancelButton type="button" class="secondary-button" (click)="close.emit()">
          Cancel
        </button>
        <button
          type="button"
          [class]="keepTasks() ? 'primary-button' : 'danger-button'"
          [disabled]="loading"
          (click)="confirmDelete.emit({ keepTasks: keepTasks() })"
        >
          {{
            loading
              ? 'Deleting...'
              : keepTasks()
                ? 'Delete Project, Keep Tasks'
                : 'Delete Project & Tasks'
          }}
        </button>
      </div>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: contents;
      }

      .delete-dialog-content {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .delete-summary {
        margin: 0;
        font-size: 0.95rem;
        color: var(--on-surface-muted);
        line-height: 1.5;

        strong {
          color: var(--on-surface);
        }
      }

      .delete-options {
        display: grid;
        gap: 0.75rem;
      }

      .delete-option-card {
        display: flex;
        flex-direction: column;
        text-align: left;
        border: 1px solid var(--outline-variant);
        border-radius: 1rem;
        background: var(--surface-container-low);
        padding: 1rem;
        cursor: pointer;
        transition: all 150ms ease;

        &:hover {
          background: var(--surface-container-high);
        }

        &.selected {
          border-color: var(--primary-solid);
          background: color-mix(in srgb, var(--primary-soft) 40%, var(--surface-container-low));
          box-shadow: 0 0 0 1px var(--primary-solid);
        }

        &.option-danger.selected {
          border-color: var(--status-overdue);
          background: color-mix(in srgb, var(--status-overdue) 12%, var(--surface-container-low));
          box-shadow: 0 0 0 1px var(--status-overdue);
        }

        .option-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        strong {
          font-size: 0.95rem;
          color: var(--on-surface);
        }

        p {
          margin: 0.35rem 0 0;
          font-size: 0.82rem;
          color: var(--on-surface-muted);
          line-height: 1.45;
        }
      }

      .recommended-badge {
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary-solid) 15%, transparent);
        color: var(--primary-solid);
        font-size: 0.72rem;
        font-weight: 700;
        padding: 0.15rem 0.55rem;
        letter-spacing: 0.02em;
      }

      .delete-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        width: 100%;
      }

      .primary-button,
      .danger-button,
      .secondary-button {
        border: 0;
        border-radius: 0.75rem;
        min-height: 2.75rem;
        padding: 0 1.25rem;
        font-weight: 700;
        font-size: 0.9rem;
        cursor: pointer;
      }

      .primary-button {
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
      }

      .danger-button {
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--status-overdue) 80%, black),
          var(--status-overdue)
        );
        color: hsl(var(--primary-foreground));
        box-shadow: 0 10px 22px
          color-mix(in srgb, var(--status-overdue) 20%, var(--surface-dim-strong));
      }

      .secondary-button {
        background: var(--surface-container-low);
        color: var(--on-surface-muted);
      }

      @media (max-width: 640px) {
        .delete-actions {
          flex-direction: column-reverse;
          align-items: stretch;

          button {
            width: 100%;
          }
        }
      }
    `,
  ],
})
export class ProjectDeleteDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() project: Project | null = null;
  @Input() loading = false;
  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly confirmDelete = new EventEmitter<{ keepTasks: boolean }>();

  @ViewChild('cancelButton') cancelButton?: ElementRef<HTMLButtonElement>;

  protected readonly keepTasks = signal(true);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['open'] && this.open) {
      this.keepTasks.set(true);
      setTimeout(() => {
        this.cancelButton?.nativeElement?.focus();
      }, 0);
    }
  }
}
