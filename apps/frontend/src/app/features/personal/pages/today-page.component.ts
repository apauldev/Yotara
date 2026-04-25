import { CommonModule } from '@angular/common';
import { Component, computed, inject, viewChild } from '@angular/core';
import { Task } from '@yotara/shared';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';

@Component({
  selector: 'app-today-page',
  standalone: true,
  imports: [CommonModule, PersonalTaskCardComponent, PersonalTaskWorkspaceComponent],
  template: `
    <app-personal-task-workspace #workspace>
      <section class="page">
        <div class="hero-row">
          <header class="page-header">
            <p class="eyebrow">Personal Sanctuary</p>
            <h1>Today</h1>
            <p class="subtitle">{{ dateLabel() }} - {{ progressLabel() }}</p>
          </header>

          <div class="zen-card">
            <div class="zen-icon">✦</div>
            <div>
              <strong>Daily Zen</strong>
              <p>Progress is quiet, but steady.</p>
            </div>
          </div>
        </div>

        @if (taskService.overdueTasks().length > 0) {
          <section class="task-section">
            <div class="section-heading section-heading-accent">
              <h2>Overdue</h2>
            </div>

            <div class="task-stack">
              @for (task of taskService.overdueTasks(); track task.id) {
                <app-personal-task-card
                  [task]="task"
                  tone="overdue"
                  [interactive]="true"
                  (select)="editTask(task)"
                />
              }
            </div>
          </section>
        }

        <section class="task-section">
          <div class="section-heading">
            <h2>Due Today</h2>

            <div class="section-actions">
              <button type="button" class="icon-chip" aria-label="Filter tasks">≡</button>
              <button type="button" class="icon-chip" aria-label="More actions">…</button>
            </div>
          </div>

          @if (taskService.loading()) {
            <p class="status-copy">Loading your focused list...</p>
          } @else if (taskService.error()) {
            <p class="status-copy">{{ taskService.error() }}</p>
          } @else if (
            taskService.todayTasks().length === 0 &&
            taskService.todayCompletedTasks().length === 0 &&
            taskService.overdueTasks().length === 0
          ) {
            <div class="empty-state">
              <h3>You are clear for today</h3>
              <p>Nothing urgent is waiting. Capture a new task or plan the next focus block.</p>
            </div>
          } @else {
            <div class="task-stack">
              @for (task of taskService.todayTasks(); track task.id) {
                <app-personal-task-card
                  [task]="task"
                  [interactive]="true"
                  (select)="editTask(task)"
                />
              }
            </div>

            @if (taskService.todayCompletedTasks().length > 0) {
              <div class="completed-stack">
                @for (task of taskService.todayCompletedTasks(); track task.id) {
                  <app-personal-task-card
                    [task]="task"
                    [interactive]="true"
                    [showDescription]="false"
                    [showCompletionState]="true"
                    (select)="editTask(task)"
                  />
                }
              </div>
            }
          }
        </section>

        <button
          type="button"
          class="fab"
          aria-label="Quick add task"
          (click)="openCreateTaskModal()"
        >
          +
        </button>
      </section>
    </app-personal-task-workspace>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        position: relative;
        padding: 0.85rem 0 3rem;
      }

      .hero-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1.5rem;
      }

      .eyebrow {
        margin: 0;
        color: var(--on-surface-subtle);
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.82rem;
        font-weight: 800;
      }

      .page-header h1 {
        margin: 0.2rem 0 0;
        font-size: clamp(2.7rem, 4vw, 3.6rem);
        line-height: 1.02;
        letter-spacing: -0.05em;
      }

      .subtitle {
        margin: 0.65rem 0 0;
        color: var(--on-surface-muted);
        font-size: 1.1rem;
      }

      .zen-card {
        min-width: 13rem;
        display: flex;
        align-items: center;
        gap: 0.85rem;
        border-radius: 1.2rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 0.85rem 0.95rem;
      }

      .zen-icon {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.9rem;
        background: var(--primary-soft);
        color: var(--primary-solid);
        display: grid;
        place-items: center;
      }

      .zen-card strong {
        display: block;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.7rem;
        color: var(--on-surface-subtle);
      }

      .zen-card p {
        margin: 0.2rem 0 0;
        color: var(--on-surface-muted);
      }

      .task-section {
        margin-top: 2rem;
      }

      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .section-heading h2 {
        margin: 0;
        font-size: 1.85rem;
        letter-spacing: -0.04em;
      }

      .section-heading-accent h2 {
        color: #c97c46;
      }

      .section-actions {
        display: flex;
        align-items: center;
        gap: 0.55rem;
      }

      .icon-chip {
        width: 2.4rem;
        height: 2.4rem;
        border: 0;
        border-radius: 0.9rem;
        background: var(--surface-container-lowest);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        color: var(--on-surface-subtle);
        font-size: 1rem;
      }

      .task-stack,
      .completed-stack {
        display: grid;
        gap: 0.95rem;
      }

      .completed-stack {
        margin-top: 1.15rem;
      }

      .status-copy {
        color: var(--on-surface-muted);
      }

      .empty-state {
        border-radius: 1.4rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 2rem 1.3rem;
      }

      .empty-state h3 {
        margin: 0;
        font-size: 1.9rem;
        letter-spacing: -0.04em;
      }

      .empty-state p {
        margin: 0.55rem 0 0;
        color: var(--on-surface-muted);
      }

      .fab {
        position: fixed;
        right: 2rem;
        bottom: 2rem;
        width: 4rem;
        height: 4rem;
        border-radius: 999px;
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
        text-decoration: none;
        font-size: 2rem;
        display: grid;
        place-items: center;
        box-shadow: 0 18px 36px var(--surface-dim-strong);
      }

      @media (max-width: 900px) {
        .hero-row {
          flex-direction: column;
          align-items: stretch;
        }

        .zen-card {
          min-width: 0;
        }
      }

      @media (max-width: 720px) {
        .fab {
          width: 3.4rem;
          height: 3.4rem;
          right: 1rem;
          bottom: 1rem;
        }
      }
    `,
  ],
})
export class TodayPageComponent {
  protected readonly taskService = inject(TaskService);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly dateLabel = computed(() =>
    new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date()),
  );
  protected readonly progressLabel = computed(() => {
    const total =
      this.taskService.overdueTasks().length +
      this.taskService.todayTasks().length +
      this.taskService.todayCompletedTasks().length;
    const completed = this.taskService.todayCompletedTasks().length;

    return total === 0 ? 'a clear page' : `${completed} of ${total} done`;
  });

  protected openCreateTaskModal() {
    this.workspace()?.openCreateTaskModal();
  }

  protected editTask(task: Task) {
    this.workspace()?.editTask(task);
  }
}
