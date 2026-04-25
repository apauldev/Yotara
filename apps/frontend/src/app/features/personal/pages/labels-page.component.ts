import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

interface PersonalLabelSummary {
  name: string;
  color: string;
  note: string;
}

@Component({
  selector: 'app-labels-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <section class="page">
      <app-page-header
        title="Labels"
        subtitle="Shape the language of your sanctuary before full label management arrives."
      />

      <div class="label-grid">
        @for (label of labels; track label.name) {
          <article class="label-card">
            <span class="label-dot" [style.background]="label.color"></span>
            <h2>{{ label.name }}</h2>
            <p>{{ label.note }}</p>
          </article>
        }
      </div>

      <div class="note-panel">
        <strong>What is live now</strong>
        <p>
          This page is intentionally frontend-only in the MVP. It gives personal mode a finished
          navigation path and establishes the visual system that real label persistence will plug
          into next.
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        padding: 1rem 0 2rem;
      }

      .label-grid {
        margin-top: 2rem;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .label-card,
      .note-panel {
        border-radius: 1.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 1.35rem;
      }

      .label-dot {
        width: 1rem;
        height: 1rem;
        border-radius: 999px;
        display: inline-block;
      }

      .label-card h2 {
        margin: 1rem 0 0;
        font-size: 1.65rem;
        letter-spacing: -0.04em;
      }

      .label-card p,
      .note-panel p {
        margin: 0.55rem 0 0;
        color: var(--on-surface-muted);
        line-height: 1.45;
      }

      .note-panel {
        margin-top: 1rem;
      }

      .note-panel strong {
        font-size: 0.84rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--on-surface-subtle);
      }

      @media (max-width: 900px) {
        .label-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 640px) {
        .label-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LabelsPageComponent {
  protected readonly labels: PersonalLabelSummary[] = [
    {
      name: 'Writing',
      color: '#82d7a9',
      note: 'Long-form thinking, briefs, and proposal drafts.',
    },
    {
      name: 'Focus',
      color: '#81d7e8',
      note: 'Deep work blocks, concentration rituals, and quiet hours.',
    },
    {
      name: 'Home',
      color: '#f1c582',
      note: 'Household systems, errands, and improvements.',
    },
    {
      name: 'Life',
      color: '#c7e9b3',
      note: 'Personal admin, appointments, and maintenance.',
    },
    {
      name: 'Finance',
      color: '#a5d3e1',
      note: 'Subscriptions, reviews, and money check-ins.',
    },
    {
      name: 'Health',
      color: '#bcd0fb',
      note: 'Nutrition, movement, recovery, and mental wellness.',
    },
  ];
}
