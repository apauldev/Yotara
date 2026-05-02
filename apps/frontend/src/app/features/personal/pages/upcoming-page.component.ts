import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';

@Component({
  selector: 'app-upcoming-page',
  standalone: true,
  imports: [
    CommonModule,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    PageHeaderComponent,
    SectionHeaderComponent,
  ],
  template: `
    <app-personal-task-workspace #workspace>
      <section class="page">
        <app-page-header
          eyebrow="Personal Sanctuary"
          title="Upcoming"
          subtitle="See what is approaching and space it out before it becomes noisy."
        />

        @if (taskService.loading()) {
          <p class="status-copy">Loading your upcoming plans...</p>
        } @else if (taskService.error()) {
          <p class="status-copy">{{ taskService.error() }}</p>
        } @else if (taskService.upcomingTaskGroups().length === 0) {
          <div class="empty-state">
            <h2>Nothing is crowding the horizon</h2>
            <p>Upcoming work will appear here once tasks are scheduled ahead.</p>
          </div>
        } @else {
          <div class="group-stack">
            @for (group of taskService.upcomingTaskGroups(); track group.label) {
              <section class="group-card">
                <app-section-header
                  [title]="group.label"
                  [count]="group.tasks.length + ' tasks'"
                  size="md"
                />

                <div class="task-stack">
                  @for (task of group.tasks; track task.id) {
                    <app-personal-task-card
                      [task]="task"
                      [interactive]="true"
                      (select)="workspace.editTask(task)"
                    />
                  }
                </div>
              </section>
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

      .group-stack {
        margin-top: 2rem;
        display: grid;
        gap: 1.15rem;
      }

      .group-card,
      .empty-state {
        border-radius: 1.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 1.25rem;
      }

      .empty-state h2 {
        margin: 0;
        font-size: 1.7rem;
        letter-spacing: -0.04em;
      }

      .task-stack {
        display: grid;
        gap: 0.85rem;
      }

      .empty-state p {
        margin: 0.55rem 0 0;
        color: var(--on-surface-muted);
      }
    `,
  ],
})
export class UpcomingPageComponent {
  protected readonly taskService = inject(TaskService);
}
