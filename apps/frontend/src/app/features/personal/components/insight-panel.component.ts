import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { InsightType } from '../pages/task-list-page/types';

@Component({
  selector: 'app-insight-panel',
  standalone: true,
  imports: [FontAwesomeModule],
  template: `
    <div class="insight-panel" role="complementary" aria-label="Daily Insight">
      <button
        type="button"
        class="insight-dismiss"
        (click)="dismiss.emit()"
        aria-label="Dismiss insight"
      >
        <fa-icon [icon]="faXmark"></fa-icon>
      </button>

      @if (type === 'clarity') {
        <div class="insight-content">
          <div class="insight-icon" aria-hidden="true">&#10022;</div>
          <div>
            <strong>Daily Clarity</strong>
            <p>{{ prompt }}</p>
          </div>
        </div>
      } @else {
        <div class="insight-content">
          <div class="insight-icon" aria-hidden="true">&#9998;&#65039;</div>
          <div>
            <strong>The Yotara Journal</strong>
            <p>{{ prompt }}</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .insight-panel {
      position: relative;
      min-width: 18rem;
      max-width: 22rem;
      background: color-mix(in srgb, var(--primary-soft) 25%, var(--surface-card));
      border: 1px solid var(--outline-variant);
      border-radius: 1.15rem;
      padding: 0.95rem 2.85rem 0.95rem 1rem;
      box-shadow: 0 4px 12px var(--surface-dim);
      display: flex;
      align-items: center;
      gap: 0.85rem;
      transition: all 200ms ease;
    }

    .insight-dismiss {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 1.75rem;
      height: 1.75rem;
      border: 0;
      border-radius: 0.5rem;
      background: transparent;
      color: var(--on-surface-subtle);
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: all 150ms ease;

      &:hover {
        background: var(--surface-container-high);
        color: var(--on-surface);
      }

      &:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: -1px;
      }
    }

    .insight-content {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      width: 100%;
    }

    .insight-icon {
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 0.75rem;
      background: var(--primary-soft);
      color: var(--primary-solid);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      font-size: 1.1rem;
    }

    .insight-panel strong {
      display: block;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--primary-solid);
      line-height: 1.2;
    }

    .insight-panel p {
      margin: 0.15rem 0 0;
      font-size: 0.82rem;
      font-weight: 600;
      line-height: 1.4;
      color: var(--on-surface-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    @media (max-width: 720px) {
      .insight-panel {
        min-width: 0;
        max-width: none;
        width: 100%;
        padding: 0.85rem 2.5rem 0.85rem 0.85rem;
      }

      .insight-icon {
        width: 2rem;
        height: 2.2rem;
        font-size: 1rem;
      }
    }
  `,
})
export class InsightPanelComponent {
  @Input({ required: true }) type: InsightType = 'clarity';
  @Input({ required: true }) prompt = '';
  @Output() readonly dismiss = new EventEmitter<void>();

  protected readonly faXmark = faXmark;
}
