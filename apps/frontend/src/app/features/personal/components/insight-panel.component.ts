import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark, faWandMagicSparkles, faPenNib } from '@fortawesome/free-solid-svg-icons';
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

      <div class="insight-content">
        @if (type === 'clarity') {
          <div class="insight-icon clarity" aria-hidden="true">
            <fa-icon [icon]="faWandMagicSparkles"></fa-icon>
          </div>
          <div class="insight-text">
            <strong>Daily Clarity</strong>
            <p>{{ prompt }}</p>
          </div>
        } @else {
          <div class="insight-icon journal" aria-hidden="true">
            <fa-icon [icon]="faPenNib"></fa-icon>
          </div>
          <div class="insight-text">
            <strong>The Yotara Journal</strong>
            <p>{{ prompt }}</p>
          </div>
        }
      </div>
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
      background: var(--surface-card);
      border: 1px solid var(--outline-variant);
      border-radius: 1.25rem;
      padding: 0.85rem 2.75rem 0.85rem 0.85rem;
      box-shadow:
        0 4px 12px var(--surface-dim),
        0 1px 2px var(--surface-dim-strong);
      display: flex;
      align-items: center;
      gap: 0.85rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, var(--primary-soft) 0%, transparent 100%);
        opacity: 0.4;
        pointer-events: none;
      }

      &:hover {
        transform: translateY(-2px);
        box-shadow:
          0 8px 16px var(--surface-dim),
          0 2px 4px var(--surface-dim-strong);
        border-color: color-mix(in srgb, var(--primary-solid) 25%, var(--outline-variant));
      }
    }

    .insight-dismiss {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 1.75rem;
      height: 1.75rem;
      border: 0;
      border-radius: 0.6rem;
      background: transparent;
      color: var(--on-surface-subtle);
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 2;

      &:hover {
        background: var(--surface-container-high);
        color: var(--on-surface);
        transform: rotate(90deg);
      }

      &:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: -1px;
      }
    }

    .insight-content {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      width: 100%;
      z-index: 1;
    }

    .insight-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.85rem;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      font-size: 1.1rem;
      background: var(--primary-soft);
      color: var(--primary-solid);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-solid) 10%, transparent);

      &.journal {
        background: var(--warning-soft);
        color: var(--status-pending);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--status-pending) 10%, transparent);
      }
    }

    .insight-text {
      flex: 1;
      min-width: 0;
    }

    .insight-panel strong {
      display: block;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--on-surface-subtle);
      line-height: 1;
      margin-bottom: 0.2rem;
    }

    .insight-panel p {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 600;
      line-height: 1.4;
      color: var(--on-surface);
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
        padding: 0.75rem 2.5rem 0.75rem 0.75rem;
      }

      .insight-icon {
        width: 2.25rem;
        height: 2.25rem;
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
  protected readonly faWandMagicSparkles = faWandMagicSparkles;
  protected readonly faPenNib = faPenNib;
}
