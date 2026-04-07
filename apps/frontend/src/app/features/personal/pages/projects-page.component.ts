import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface PersonalProjectCard {
  name: string;
  description: string;
  accent: string;
  tasksLeft: string;
  icon: string;
}

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page">
      <div class="header-row">
        <header class="page-header">
          <h1>Projects</h1>
          <p>Your creative and personal clusters.</p>
        </header>

        <div class="view-toggle" aria-label="Project view mode">
          <button type="button" class="view-button view-button-active">Grid</button>
          <button type="button" class="view-button">Kanban</button>
        </div>
      </div>

      <div class="project-grid">
        @for (project of projects; track project.name) {
          <article class="project-card">
            <div class="project-icon" [style.background]="project.accent">{{ project.icon }}</div>
            <h2>{{ project.name }}</h2>
            <p>{{ project.description }}</p>
            <span>{{ project.tasksLeft }}</span>
          </article>
        }

        <article class="project-card project-card-create">
          <div class="create-icon">+</div>
          <h2>Create New Project</h2>
          <p>Start a new creative chapter.</p>
        </article>

        <article class="quote-card">
          <p>
            "Your mind is for having ideas, not holding them. Create space for what truly matters."
          </p>
          <span>The Art of Focus</span>
        </article>
      </div>

      <a class="fab" href="#top" aria-label="Create project">+</a>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        position: relative;
        padding: 1rem 0 3rem;
      }

      .header-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
      }

      h1 {
        margin: 0;
        font-size: clamp(3rem, 4vw, 4rem);
        line-height: 1.02;
        letter-spacing: -0.05em;
      }

      .page-header p {
        margin: 0.55rem 0 0;
        color: #8a8378;
        font-size: 1.08rem;
      }

      .view-toggle {
        display: inline-flex;
        gap: 0.35rem;
        border-radius: 999px;
        background: rgba(255, 251, 242, 0.82);
        border: 1px solid rgba(236, 228, 210, 0.9);
        padding: 0.3rem;
      }

      .view-button {
        border: 0;
        background: transparent;
        border-radius: 999px;
        min-height: 2.35rem;
        padding: 0 1rem;
        color: #7d776b;
        font-weight: 700;
      }

      .view-button-active {
        background: #ffffff;
        color: #226c47;
      }

      .project-grid {
        margin-top: 2rem;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .project-card,
      .quote-card {
        border-radius: 1.7rem;
        background: rgba(255, 251, 242, 0.72);
        border: 1px solid rgba(236, 228, 210, 0.9);
        min-height: 15rem;
        padding: 1.45rem;
      }

      .project-icon,
      .create-icon {
        width: 3rem;
        height: 3rem;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-size: 1.3rem;
      }

      .create-icon {
        background: #f0ece0;
        color: #a29c90;
      }

      .project-card h2,
      .project-card-create h2 {
        margin: 1.25rem 0 0;
        font-size: 2rem;
        letter-spacing: -0.04em;
      }

      .project-card p,
      .project-card-create p {
        margin: 0.65rem 0 0;
        color: #8a8378;
        line-height: 1.45;
      }

      .project-card span {
        display: inline-block;
        margin-top: 1.3rem;
        color: #2f7a54;
        font-weight: 700;
      }

      .project-card-create {
        border-style: dashed;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
      }

      .quote-card {
        grid-column: span 2;
        background: linear-gradient(135deg, #11573b, #083527);
        color: #f2f4ee;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .quote-card p {
        margin: 0;
        color: inherit;
        font-size: 2rem;
        line-height: 1.35;
        font-style: italic;
      }

      .quote-card span {
        margin-top: 1.25rem;
        color: #c6d6c7;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .fab {
        position: fixed;
        right: 2rem;
        bottom: 2rem;
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 999px;
        background: #2d7c53;
        color: #f7faf5;
        text-decoration: none;
        font-size: 2rem;
        display: grid;
        place-items: center;
        box-shadow: 0 18px 36px rgba(45, 124, 83, 0.2);
      }

      @media (max-width: 980px) {
        .project-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .quote-card {
          grid-column: span 2;
        }
      }

      @media (max-width: 720px) {
        .header-row {
          flex-direction: column;
        }

        .project-grid {
          grid-template-columns: 1fr;
        }

        .quote-card {
          grid-column: span 1;
        }

        .fab {
          right: 1rem;
          bottom: 1rem;
        }
      }
    `,
  ],
})
export class ProjectsPageComponent {
  protected readonly projects: PersonalProjectCard[] = [
    {
      name: 'Work',
      description: 'System architecture, strategic roadmaps, and client deliveries.',
      accent: '#d7f0de',
      tasksLeft: '12 tasks left',
      icon: '💼',
    },
    {
      name: 'Home',
      description: 'Renovation plans, gardening schedules, and interior design.',
      accent: '#fdeab8',
      tasksLeft: '4 tasks left',
      icon: '🏠',
    },
    {
      name: 'Health',
      description: 'Nutrition tracking, morning routines, and mental wellness.',
      accent: '#dbe7fb',
      tasksLeft: '8 tasks left',
      icon: '♥',
    },
  ];
}
