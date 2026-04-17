import { CommonModule } from '@angular/common';
import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { Project } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';

@Component({
  selector: 'app-project-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PersonalTaskCardComponent, PersonalTaskWorkspaceComponent],
  template: `
    <app-personal-task-workspace
      #workspace
      [initialProjectId]="projectId()"
      (taskSaved)="handleTaskSaved()"
    >
      <section class="page">
        @if (project(); as currentProject) {
          <a routerLink="/projects" class="back-link">← Projects</a>

          <header class="hero-card" [style.background]="heroBackground(currentProject)">
            <div class="hero-icon" [style.background]="accentSoft(currentProject)">
              <span [style.color]="accent(currentProject)">✦</span>
            </div>

            <div class="hero-copy">
              <p class="eyebrow">Personal Project</p>
              <h1>{{ currentProject.name }}</h1>
              <p class="subtitle">
                {{
                  currentProject.description ||
                    'A calm place for everything related to this outcome.'
                }}
              </p>
            </div>
          </header>

          <section class="metrics-card">
            <div class="metric">
              <strong>{{ currentProject.openTaskCount }}</strong>
              <span>Remaining</span>
            </div>
            <div class="metric">
              <strong>{{ currentProject.completedTaskCount }}</strong>
              <span>Completed</span>
            </div>
            <div class="progress-block">
              <div class="progress-copy">
                <strong>{{ progressPercent(currentProject) }}% total progress</strong>
                <span>{{ currentProject.taskCount }} tasks total</span>
              </div>
              <div class="progress-track">
                <span
                  class="progress-bar"
                  [style.width.%]="progressPercent(currentProject)"
                  [style.background]="accent(currentProject)"
                ></span>
              </div>
            </div>
          </section>

          <div class="actions-row">
            <div class="view-pill">List</div>
            <button type="button" class="action-button" (click)="workspace.openCreateTaskModal()">
              Add Task
            </button>
          </div>

          @if (activeProjectTasks().length === 0 && completedProjectTasks().length === 0) {
            <section class="empty-state">
              <div class="empty-emblem">◌</div>
              <p class="quote">
                “A project becomes useful the moment the next step is visible. Start with one
                meaningful step.”
              </p>
              <button type="button" class="empty-button" (click)="workspace.openCreateTaskModal()">
                Add First Task
              </button>
            </section>
          } @else {
            <section class="task-section">
              <div class="section-heading">
                <h2>To Do</h2>
                <span>{{ activeProjectTasks().length }}</span>
              </div>

              <div class="task-stack">
                @for (task of activeProjectTasks(); track task.id) {
                  <app-personal-task-card
                    [task]="task"
                    [interactive]="true"
                    (select)="workspace.editTask(task)"
                  />
                }

                <button
                  type="button"
                  class="inline-create"
                  (click)="workspace.openCreateTaskModal()"
                >
                  + Add new task to {{ currentProject.name }}
                </button>
              </div>
            </section>

            @if (completedProjectTasks().length > 0) {
              <section class="task-section task-section-soft">
                <div class="section-heading">
                  <h2>Completed</h2>
                  <span>{{ completedProjectTasks().length }}</span>
                </div>

                <div class="task-stack">
                  @for (task of completedProjectTasks(); track task.id) {
                    <app-personal-task-card
                      [task]="task"
                      [interactive]="true"
                      [showDescription]="false"
                      [showCompletionState]="true"
                      (select)="workspace.editTask(task)"
                    />
                  }
                </div>
              </section>
            }
          }
        } @else if (projectService.loading()) {
          <p class="status-copy">Loading your project...</p>
        } @else {
          <section class="empty-state">
            <h2>Project not found</h2>
            <p>This project may have moved, or it is not available in your sanctuary yet.</p>
            <a routerLink="/projects" class="empty-button">Back to Projects</a>
          </section>
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
        padding: 0.9rem 0 3rem;
      }

      .back-link {
        color: #7d776d;
        text-decoration: none;
        font-weight: 600;
      }

      .hero-card {
        margin-top: 1rem;
        border-radius: 1.8rem;
        border: 1px solid rgba(235, 227, 208, 0.92);
        padding: 1.6rem;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 1.1rem;
        align-items: center;
      }

      .hero-icon,
      .empty-emblem {
        width: 4rem;
        height: 4rem;
        border-radius: 1.25rem;
        display: grid;
        place-items: center;
        font-size: 1.35rem;
      }

      .eyebrow {
        margin: 0;
        color: #8c8a7b;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.76rem;
        font-weight: 800;
      }

      h1 {
        margin: 0.3rem 0 0;
        font-size: clamp(2.8rem, 5vw, 4rem);
        line-height: 1;
        letter-spacing: -0.06em;
      }

      .subtitle,
      .status-copy {
        margin: 0.7rem 0 0;
        color: #7b756a;
        font-size: 1.05rem;
        line-height: 1.5;
      }

      .metrics-card {
        margin-top: 1.4rem;
        border-radius: 1.5rem;
        background: rgba(255, 251, 242, 0.78);
        border: 1px solid rgba(235, 227, 208, 0.92);
        padding: 1.2rem 1.25rem;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 10rem)) minmax(0, 1fr);
        gap: 1.1rem;
        align-items: center;
      }

      .metric strong {
        display: block;
        font-size: 2rem;
        letter-spacing: -0.05em;
        color: #27573f;
      }

      .metric span,
      .progress-copy span,
      .section-heading span {
        color: #857f73;
        font-size: 0.88rem;
      }

      .progress-copy {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .progress-copy strong {
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: 0.82rem;
        color: #2f6f4d;
      }

      .progress-track {
        margin-top: 0.65rem;
        height: 0.5rem;
        border-radius: 999px;
        background: rgba(233, 227, 213, 0.95);
        overflow: hidden;
      }

      .progress-bar {
        display: block;
        height: 100%;
      }

      .actions-row {
        margin-top: 1.6rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .view-pill {
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(235, 227, 208, 0.95);
        padding: 0.6rem 1rem;
        color: #2d6b49;
        font-weight: 700;
      }

      .action-button,
      .inline-create,
      .empty-button {
        border: 0;
        border-radius: 1rem;
        background: #2d7c53;
        color: #f7fbf6;
        min-height: 3rem;
        padding: 0 1.1rem;
        font-weight: 700;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .task-section {
        margin-top: 1.6rem;
      }

      .task-section-soft {
        margin-top: 2rem;
      }

      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .section-heading h2,
      .empty-state h2 {
        margin: 0;
        font-size: 2rem;
        letter-spacing: -0.04em;
      }

      .task-stack {
        display: grid;
        gap: 0.9rem;
      }

      .inline-create {
        justify-content: flex-start;
        background: transparent;
        color: #7c7568;
        border: 1px dashed rgba(220, 210, 190, 0.95);
      }

      .empty-state {
        margin-top: 1.8rem;
        border-radius: 1.7rem;
        background: rgba(255, 251, 242, 0.74);
        border: 1px solid rgba(235, 227, 208, 0.92);
        padding: 2.2rem 1.5rem;
        text-align: center;
      }

      .empty-emblem {
        margin: 0 auto;
        background: rgba(255, 255, 255, 0.9);
        color: #bcb4a5;
      }

      .quote {
        max-width: 28rem;
        margin: 1.1rem auto 0;
        color: #665f54;
        font-size: 1.08rem;
        line-height: 1.7;
      }

      @media (max-width: 920px) {
        .metrics-card {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .hero-card {
          grid-template-columns: 1fr;
        }

        .actions-row {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class ProjectDetailPageComponent {
  protected readonly projectService = inject(ProjectService);
  protected readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly projectId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );
  protected readonly project = computed(
    () => this.projectService.projects().find((project) => project.id === this.projectId()) ?? null,
  );
  protected readonly activeProjectTasks = computed(() =>
    this.taskService.activeTasks().filter((task) => task.projectId === this.projectId()),
  );
  protected readonly completedProjectTasks = computed(() =>
    this.taskService.completedTasks().filter((task) => task.projectId === this.projectId()),
  );

  protected handleTaskSaved() {
    this.workspace()?.closeTaskModal();
  }

  protected accent(project: Project) {
    return projectPaletteFor(project.color).accent;
  }

  protected accentSoft(project: Project) {
    return projectPaletteFor(project.color).accentSoft;
  }

  protected heroBackground(project: Project) {
    return projectPaletteFor(project.color).panel;
  }

  protected progressPercent(project: Project) {
    return projectProgressPercent(project.openTaskCount, project.completedTaskCount);
  }
}
