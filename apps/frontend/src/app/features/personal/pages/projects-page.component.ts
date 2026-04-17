import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { CreateProjectDto, Project } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { PersonalProjectModalComponent } from '../components/personal-project-modal.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PersonalProjectModalComponent],
  template: `
    <section class="page">
      <header class="hero-row">
        <div class="hero-copy">
          <p class="eyebrow">Personal Projects</p>
          <h1>Projects</h1>
          <p class="subtitle">
            Your work, gathered by outcome. Focused environments for your highest intentions.
          </p>
        </div>

        <button type="button" class="hero-button" (click)="openCreateModal()">New Project</button>
      </header>

      <app-personal-project-modal
        [open]="createModalOpen()"
        [saving]="projectService.saving()"
        [error]="projectService.error()"
        (close)="closeCreateModal()"
        (save)="createProject($event)"
      />

      @if (projectService.loading()) {
        <p class="status-copy">Loading your project spaces...</p>
      } @else if (projectService.error() && projects().length === 0) {
        <p class="status-copy">{{ projectService.error() }}</p>
      } @else if (projects().length === 0) {
        <section class="empty-shell">
          <div class="empty-orb">+</div>
          <h2>Start your first project</h2>
          <p>A project becomes useful the moment the next step has a home.</p>
          <button type="button" class="empty-button" (click)="openCreateModal()">
            Create Project
          </button>
        </section>
      } @else {
        <section class="project-grid">
          @for (project of projects(); track project.id) {
            <article
              class="project-card"
              [style.background]="cardBackground(project)"
              (click)="openProject(project.id)"
            >
              <div class="project-icon" [style.background]="accentSoft(project)">
                <span [style.color]="accent(project)">✦</span>
              </div>

              <div class="project-menu">•••</div>

              <h2>{{ project.name }}</h2>
              <p>{{ project.description || 'A calm place for the work that belongs together.' }}</p>

              <div class="progress-copy">
                <strong>{{ project.taskCount }} tasks</strong>
                <span>{{ project.openTaskCount }} remaining</span>
              </div>

              <div class="progress-track">
                <span
                  class="progress-bar"
                  [style.width.%]="progressPercent(project)"
                  [style.background]="accent(project)"
                ></span>
              </div>

              <div class="meta-row">
                <span class="meta-pill">{{ progressPercent(project) }}% complete</span>
                <span class="meta-pill meta-pill-soft">{{ paletteLabel(project) }}</span>
              </div>
            </article>
          }

          <article class="project-card project-card-create" (click)="openCreateModal()">
            <div class="create-orb">+</div>
            <h2>New Project</h2>
            <p>Begin a new journey of focused outcomes.</p>
          </article>
        </section>

        <section class="focus-card">
          <div class="focus-copy">
            <p class="focus-eyebrow">Weekly Focus</p>
            <h2>{{ focusHeadline() }}</h2>
            <p>{{ focusBody() }}</p>
            <a routerLink="/today" class="focus-button">Open Today</a>
          </div>

          <div class="focus-visual">
            <div class="focus-orb"></div>
          </div>
        </section>
      }

      <button type="button" class="fab" aria-label="Create project" (click)="openCreateModal()">
        +
      </button>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        position: relative;
        padding: 0.9rem 0 3.5rem;
      }

      .hero-row {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1.25rem;
      }

      .eyebrow,
      .focus-eyebrow {
        margin: 0;
        color: #9f9887;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.82rem;
        font-weight: 800;
      }

      h1 {
        margin: 0.25rem 0 0;
        font-size: clamp(3rem, 4.2vw, 4.2rem);
        line-height: 1;
        letter-spacing: -0.06em;
      }

      .subtitle {
        margin: 0.7rem 0 0;
        max-width: 36rem;
        color: #7f796f;
        font-size: 1.08rem;
        line-height: 1.5;
      }

      .hero-button,
      .empty-button,
      .focus-button {
        border: 0;
        border-radius: 1rem;
        background: #2d7c53;
        color: #f7fbf6;
        font-weight: 700;
        min-height: 3rem;
        padding: 0 1.15rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .status-copy {
        margin-top: 2rem;
        color: #8a8378;
      }

      .project-grid {
        margin-top: 2rem;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .project-card {
        position: relative;
        min-height: 18rem;
        border-radius: 1.6rem;
        border: 1px solid rgba(235, 227, 208, 0.92);
        padding: 1.35rem;
        cursor: pointer;
        box-shadow: 0 18px 36px rgba(105, 97, 74, 0.08);
      }

      .project-card h2,
      .project-card-create h2,
      .empty-shell h2,
      .focus-card h2 {
        margin: 1rem 0 0;
        font-size: 1.9rem;
        letter-spacing: -0.05em;
      }

      .project-card p,
      .project-card-create p,
      .empty-shell p,
      .focus-card p {
        color: #797266;
        line-height: 1.5;
      }

      .project-icon,
      .create-orb,
      .empty-orb {
        width: 3rem;
        height: 3rem;
        border-radius: 1rem;
        display: grid;
        place-items: center;
      }

      .project-menu {
        position: absolute;
        top: 1.35rem;
        right: 1.2rem;
        color: #a49b8d;
        letter-spacing: 0.18em;
      }

      .progress-copy {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-top: 1.1rem;
        font-size: 0.88rem;
      }

      .progress-copy strong {
        color: #345a47;
      }

      .progress-copy span {
        color: #847d70;
      }

      .progress-track {
        margin-top: 0.75rem;
        height: 0.45rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.86);
        overflow: hidden;
      }

      .progress-bar {
        display: block;
        height: 100%;
        border-radius: inherit;
      }

      .meta-row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        flex-wrap: wrap;
        margin-top: 1rem;
      }

      .meta-pill {
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.88);
        padding: 0.28rem 0.7rem;
        color: #516457;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .meta-pill-soft {
        color: #7f796d;
      }

      .project-card-create,
      .empty-shell {
        background: rgba(255, 251, 242, 0.72);
        border: 1px dashed rgba(222, 214, 195, 0.95);
        text-align: center;
      }

      .project-card-create {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .create-orb,
      .empty-orb {
        background: #f0ece0;
        color: #9b9588;
        font-size: 1.6rem;
      }

      .empty-shell {
        margin-top: 2rem;
        padding: 2.3rem 1.5rem;
      }

      .focus-card {
        margin-top: 2rem;
        border-radius: 1.8rem;
        background: rgba(255, 251, 242, 0.74);
        border: 1px solid rgba(235, 227, 208, 0.92);
        padding: 1.5rem;
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(14rem, 18rem);
        gap: 1.5rem;
        align-items: center;
      }

      .focus-copy h2 {
        max-width: 24rem;
      }

      .focus-visual {
        min-height: 13rem;
        border-radius: 1.5rem;
        background: radial-gradient(circle at 35% 30%, #f2e8cd, transparent 32%), #3f3428;
        display: grid;
        place-items: center;
        overflow: hidden;
      }

      .focus-orb {
        width: 6.5rem;
        height: 6.5rem;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.85), #7ca690);
        box-shadow: 0 0 0 2rem rgba(245, 250, 244, 0.08);
      }

      .fab {
        position: fixed;
        right: 2rem;
        bottom: 2rem;
        width: 3.75rem;
        height: 3.75rem;
        border-radius: 999px;
        border: 0;
        background: #2d7c53;
        color: #f7faf5;
        font-size: 2rem;
        box-shadow: 0 18px 36px rgba(45, 124, 83, 0.22);
      }

      @media (max-width: 1080px) {
        .project-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 840px) {
        .hero-row,
        .focus-card {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: stretch;
        }

        .project-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .hero-row {
          align-items: stretch;
        }

        .hero-button,
        .focus-button {
          width: 100%;
        }

        .project-card,
        .project-card-create,
        .empty-shell,
        .focus-card {
          padding: 1.15rem;
        }

        .progress-copy {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.35rem;
        }

        .meta-row {
          gap: 0.45rem;
        }

        .fab {
          right: 1rem;
          bottom: 1rem;
          width: 3.4rem;
          height: 3.4rem;
        }
      }
    `,
  ],
})
export class ProjectsPageComponent {
  protected readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  protected readonly createModalOpen = signal(false);
  protected readonly projects = this.projectService.projects;
  protected readonly focusHeadline = computed(() => {
    const projects = this.projects();
    if (projects.length === 0) {
      return 'A project becomes useful the moment the next step is visible.';
    }

    const busiest = [...projects].sort(
      (left, right) => right.openTaskCount - left.openTaskCount,
    )[0];
    return `${busiest.name} holds ${busiest.openTaskCount} active steps right now.`;
  });
  protected readonly focusBody = computed(() => {
    const projects = this.projects();
    if (projects.length === 0) {
      return 'Create one focused space, then let Today and Upcoming guide the daily rhythm.';
    }

    const completed = projects.reduce((sum, project) => sum + project.completedTaskCount, 0);
    return `Completed work now adds up to ${completed} steps across your active projects. Keep the next action visible and the rest will follow.`;
  });

  protected openCreateModal() {
    this.createModalOpen.set(true);
  }

  protected closeCreateModal() {
    this.createModalOpen.set(false);
  }

  protected async createProject(payload: CreateProjectDto) {
    const created = await this.projectService.createProject(payload);
    this.createModalOpen.set(false);
    await this.router.navigate(['/projects', created.id]);
  }

  protected openProject(projectId: string) {
    void this.router.navigate(['/projects', projectId]);
  }

  protected accent(project: Project) {
    return projectPaletteFor(project.color).accent;
  }

  protected accentSoft(project: Project) {
    return projectPaletteFor(project.color).accentSoft;
  }

  protected cardBackground(project: Project) {
    return projectPaletteFor(project.color).panel;
  }

  protected paletteLabel(project: Project) {
    return projectPaletteFor(project.color).label;
  }

  protected progressPercent(project: Project) {
    return projectProgressPercent(project.openTaskCount, project.completedTaskCount);
  }
}
