import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TaskService } from '../../../core/services/task.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';

@Component({
  selector: 'app-archive-page',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
  ],
  template: `
    <app-personal-task-workspace #workspace>
      <section class="page">
        <app-page-header
          title="Archive"
          subtitle="Recently completed tasks stay here for 30 days, ready to be restored if needed."
        />

        @if (taskService.loading()) {
          <p class="status-copy">Loading your recent completions...</p>
        } @else if (taskService.error()) {
          <p class="status-copy">{{ taskService.error() }}</p>
        } @else if (taskService.archivedTasks().length === 0) {
          <div class="empty-state">
            <h2>Nothing archived yet</h2>
            <p>Completed work will appear here for the next 30 days.</p>
          </div>
        } @else {
          <div class="archive-summary">
            <span>{{ taskService.archivedTasks().length }} recent completions</span>
            <p>Use the checkmark or the task modal to move something back into doing.</p>
          </div>

          <div class="task-stack">
            @for (task of taskService.archivedTasks(); track task.id) {
              <app-personal-task-card
                [task]="task"
                [interactive]="true"
                [showDescription]="false"
                [showCompletionState]="true"
                (select)="workspace.editTask(task)"
              />
            }
          </div>
        }
      </section>
    </app-personal-task-workspace>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        padding: 1rem 0 2rem;
      }

      .status-copy {
        margin-top: 0.6rem;
        color: var(--on-surface-muted);
        font-size: 1.08rem;
      }

      .archive-summary {
        margin: 1rem 0 1rem;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        color: var(--on-surface-muted);
      }

      .archive-summary span {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
      }

      .archive-summary p {
        margin: 0;
      }

      .task-stack,
      .empty-state {
        border-radius: 1.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 1.25rem;
      }

      .task-stack {
        display: grid;
        gap: 0.85rem;
      }

      .empty-state h2 {
        margin: 0;
        font-size: 1.7rem;
        letter-spacing: -0.04em;
      }

      .empty-state p {
        margin: 0.55rem 0 0;
        color: var(--on-surface-muted);
      }
    `,
  ],
})
export class ArchivePageComponent {
  protected readonly taskService = inject(TaskService);
}
