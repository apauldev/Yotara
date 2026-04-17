import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';

@Component({
  selector: 'app-upcoming-page',
  standalone: true,
  imports: [CommonModule, PersonalTaskCardComponent, PersonalTaskWorkspaceComponent],
  template: `
    <app-personal-task-workspace #workspace>
      <section class="page">
        <header class="page-header">
          <p class="eyebrow">Future Focus</p>
          <h1>Upcoming</h1>
          <p>See what is approaching and space it out before it becomes noisy.</p>
        </header>

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
                <div class="group-header">
                  <h2>{{ group.label }}</h2>
                  <span>{{ group.tasks.length }} tasks</span>
                </div>

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

      .eyebrow {
        margin: 0;
        color: #9f9887;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.82rem;
        font-weight: 800;
      }

      h1 {
        margin: 0.25rem 0 0;
        font-size: clamp(3rem, 4vw, 4rem);
        line-height: 1.02;
        letter-spacing: -0.05em;
      }

      .page-header p:last-child,
      .status-copy {
        margin-top: 0.6rem;
        color: #8a8378;
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
        background: rgba(255, 251, 242, 0.72);
        border: 1px solid rgba(236, 228, 210, 0.9);
        padding: 1.25rem;
      }

      .group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 0.95rem;
      }

      .group-header h2,
      .empty-state h2 {
        margin: 0;
        font-size: 1.7rem;
        letter-spacing: -0.04em;
      }

      .group-header span {
        color: #8a8378;
        font-size: 0.88rem;
      }

      .task-stack {
        display: grid;
        gap: 0.85rem;
      }

      .empty-state p {
        margin: 0.55rem 0 0;
        color: #8a8378;
      }
    `,
  ],
})
export class UpcomingPageComponent {
  protected readonly taskService = inject(TaskService);
}
