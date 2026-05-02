import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Label } from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';
import { TaskService } from '../../../core/services/task.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { LabelModalComponent } from '../components/label-modal.component';

@Component({
  selector: 'app-labels-page',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    LabelModalComponent,
  ],
  template: `
    <app-personal-task-workspace #workspace>
      <section class="page">
        <app-page-header
          eyebrow="Personal Sanctuary"
          title="Labels"
          subtitle="Tap a label to see its tasks. Manage colors and names from the same modal."
        >
          <div page-header-actions class="header-actions">
            <button type="button" class="header-button" (click)="openCreateLabel()">
              Create Label
            </button>
            <button type="button" class="header-button secondary" (click)="openManageLabels()">
              Manage Labels
            </button>
          </div>
        </app-page-header>

        @if (labelService.loading()) {
          <p class="status-copy">Loading labels...</p>
        } @else if (labelService.error()) {
          <p class="status-copy">{{ labelService.error() }}</p>
        } @else {
          <div class="label-browser">
            <div class="label-grid">
              @for (label of labels(); track label.id) {
                <button
                  type="button"
                  class="label-card"
                  [class.label-card-active]="selectedLabelId() === label.id"
                  (click)="selectLabel(label)"
                >
                  <span class="label-card-dot" [style.background]="label.color"></span>
                  <div class="label-card-copy">
                    <strong>{{ label.name }}</strong>
                    <p>{{ label.taskCount ?? 0 }} tasks</p>
                  </div>
                </button>
              }

              <button
                type="button"
                class="label-card label-card-create"
                (click)="openCreateLabel()"
              >
                <span class="create-plus">+</span>
                <strong>Create New Label</strong>
                <p>Start a new focus area</p>
              </button>
            </div>

            <aside class="task-pane">
              <div class="task-pane-header">
                <div>
                  <h2>{{ selectedLabel()?.name || 'All Labels' }}</h2>
                  <p>
                    @if (selectedLabel()) {
                      {{ filteredTasks().length }} matching tasks in this label.
                    } @else {
                      Select a label to see its tasks.
                    }
                  </p>
                </div>
                @if (selectedLabel()) {
                  <button type="button" class="edit-link" (click)="openManageLabels()">
                    Edit Label
                  </button>
                }
              </div>

              @if (!selectedLabel()) {
                <div class="task-empty">
                  <h3>Choose a label</h3>
                  <p>Pick a label from the grid to filter the tasks attached to it.</p>
                </div>
              } @else if (filteredTasks().length === 0) {
                <div class="task-empty">
                  <h3>No tasks here yet</h3>
                  <p>This label is ready, but nothing has been tagged with it.</p>
                </div>
              } @else {
                <div class="task-stack">
                  @for (task of filteredTasks(); track task.id) {
                    <app-personal-task-card
                      [task]="task"
                      [interactive]="true"
                      (select)="workspace.editTask(task)"
                    />
                  }
                </div>
              }
            </aside>
          </div>
        }
      </section>

      <app-label-modal
        [open]="labelModalOpen()"
        [labels]="labels()"
        [selectedLabelId]="selectedLabelId()"
        [mode]="labelModalMode()"
        [taskCountForSelected]="selectedLabel()?.taskCount ?? 0"
        (close)="closeLabelModal()"
        (saved)="onLabelSaved()"
        (deleted)="onLabelDeleted()"
        (selectedLabelIdChange)="selectLabelById($event)"
      />
    </app-personal-task-workspace>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        padding: 0.75rem 0 1.5rem;
      }

      .header-actions {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .header-button {
        min-height: 2.65rem;
        padding: 0 0.95rem;
        border: 0;
        border-radius: 999px;
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
        font-weight: 700;
      }

      .header-button.secondary {
        background: var(--surface-container-highest);
        color: var(--on-surface-muted);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .status-copy {
        margin-top: 1rem;
        color: var(--on-surface-muted);
      }

      .label-browser {
        margin-top: 0.9rem;
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(19rem, 1fr);
        gap: 0.9rem;
      }

      .label-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
        align-content: start;
      }

      .label-card {
        min-height: 10rem;
        border-radius: 1.55rem;
        border: 0;
        padding: 1.05rem;
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--surface-container-lowest) 78%, var(--surface-card) 22%),
          var(--surface-container-lowest)
        );
        box-shadow:
          0 12px 24px color-mix(in srgb, var(--surface-dim) 10%, transparent),
          inset 0 0 0 1px var(--outline-variant);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: space-between;
        text-align: left;
      }

      .label-card-active {
        transform: translateY(-1px);
        box-shadow:
          0 18px 35px color-mix(in srgb, var(--surface-dim) 14%, transparent),
          inset 0 0 0 1px color-mix(in srgb, var(--primary-solid) 18%, var(--outline-variant));
      }

      .label-card-dot {
        width: 1rem;
        height: 1rem;
        border-radius: 999px;
        box-shadow: 0 0 0 8px color-mix(in srgb, currentColor 6%, transparent);
      }

      .label-card-copy strong {
        display: block;
        margin-top: 0.9rem;
        font-size: 1.45rem;
        line-height: 1.02;
        letter-spacing: -0.04em;
      }

      .label-card-copy p {
        margin: 0.45rem 0 0;
        color: var(--on-surface-muted);
        font-size: 0.92rem;
      }

      .label-card-create {
        border: 1px dashed var(--outline-variant);
        background: color-mix(
          in srgb,
          var(--surface-container-lowest) 68%,
          var(--surface-container-low) 32%
        );
        justify-content: center;
        align-items: center;
        gap: 0.4rem;
      }

      .create-plus {
        width: 2.7rem;
        height: 2.7rem;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--surface-container-highest);
        font-size: 1.7rem;
        color: var(--on-surface-subtle);
      }

      .task-pane {
        border-radius: 1.55rem;
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--surface-container-lowest) 75%, var(--surface-card) 25%),
          var(--surface-container-lowest)
        );
        box-shadow:
          0 12px 24px color-mix(in srgb, var(--surface-dim) 10%, transparent),
          inset 0 0 0 1px var(--outline-variant);
        padding: 1.05rem;
      }

      .task-pane-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      .task-pane-header h2 {
        margin: 0;
        font-size: 1.55rem;
        letter-spacing: -0.04em;
      }

      .task-pane-header p {
        margin: 0.35rem 0 0;
        color: var(--on-surface-muted);
      }

      .edit-link {
        border: 0;
        background: transparent;
        color: var(--primary-solid);
        font-weight: 700;
        padding: 0.3rem 0;
      }

      .task-empty {
        margin-top: 1rem;
        min-height: 22rem;
        border-radius: 1.35rem;
        background: color-mix(
          in srgb,
          var(--surface-container-lowest) 72%,
          var(--surface-container-low) 28%
        );
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        display: grid;
        place-items: center;
        text-align: center;
        padding: 1.5rem;
      }

      .task-empty h3 {
        margin: 0;
        font-size: 1.4rem;
      }

      .task-empty p {
        margin: 0.55rem 0 0;
        color: var(--on-surface-muted);
      }

      .task-stack {
        margin-top: 0.9rem;
        display: grid;
        gap: 0.65rem;
      }

      @media (max-width: 1100px) {
        .label-browser {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .label-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LabelsPageComponent {
  protected readonly labelService = inject(LabelService);
  protected readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);

  protected readonly labels = this.labelService.labels;
  protected readonly labelModalOpen = signal(false);
  protected readonly labelModalMode = signal<'create' | 'edit'>('create');
  protected readonly selectedLabelId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('label'))),
    { initialValue: this.route.snapshot.queryParamMap.get('label') },
  );

  protected readonly selectedLabel = computed(
    () => this.labels().find((label) => label.id === this.selectedLabelId()) ?? null,
  );
  protected readonly filteredTasks = computed(() =>
    this.selectedLabelId()
      ? this.taskService.tasks().filter((task) => task.labels?.includes(this.selectedLabelId()!))
      : [],
  );

  constructor() {
    if (!this.selectedLabelId() && this.labels().length > 0) {
      void this.selectLabel(this.labels()[0]);
    }
  }

  protected async selectLabel(label: Label) {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { label: label.id },
      queryParamsHandling: 'merge',
    });
  }

  protected selectLabelById(labelId: string | null) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { label: labelId || null },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreateLabel() {
    this.labelModalMode.set('create');
    this.labelModalOpen.set(true);
    this.selectLabelById(null);
  }

  protected openManageLabels() {
    this.labelModalMode.set(this.selectedLabel() ? 'edit' : 'create');
    this.labelModalOpen.set(true);
  }

  protected closeLabelModal() {
    this.labelModalOpen.set(false);
  }

  protected onLabelSaved() {
    this.labelModalMode.set('edit');
    this.labelModalOpen.set(true);
  }

  protected onLabelDeleted() {
    this.labelModalMode.set('create');
    this.selectLabelById(null);
  }
}
