import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
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
        } @else {
          <div class="insight-icon journal" aria-hidden="true">
            <fa-icon [icon]="faPenNib"></fa-icon>
          </div>
        }

        <div class="insight-text">
          <strong>{{ type === 'clarity' ? 'Daily Clarity' : 'The Yotara Journal' }}</strong>
          <span class="insight-quote" tabindex="0">
            <span class="insight-quote-text">{{ prompt }}</span>
            <span class="insight-tooltip" role="tooltip" aria-hidden="true">{{ prompt }}</span>
          </span>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: `
    :host {
      display: block;
    }

    .insight-panel {
      position: relative;
      z-index: 1;
      min-width: 18rem;
      max-width: 24rem;
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

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(135deg, var(--primary-soft) 0%, transparent 100%);
        opacity: 0.4;
        pointer-events: none;
      }

      &:hover,
      &:focus-within {
        z-index: 20;
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

    .insight-quote {
      position: relative;
      display: block;
      cursor: help;
      border-radius: 0.25rem;

      &:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 2px;
      }

      &:hover .insight-tooltip,
      &:focus-within .insight-tooltip {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
    }

    .insight-quote-text {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-size: 0.85rem;
      font-weight: 600;
      line-height: 1.4;
      color: var(--on-surface);
    }

    .insight-tooltip {
      position: absolute;
      top: calc(100% + 1rem);
      right: 0;
      z-index: 30;
      width: max-content;
      max-width: min(24rem, calc(100vw - 6rem));
      padding: 0.7rem 0.85rem;
      border-radius: 0.7rem;
      background: var(--on-surface);
      color: var(--surface-container-lowest);
      box-shadow: 0 12px 32px var(--surface-dim-strong);
      font-size: 0.8rem;
      font-weight: 500;
      line-height: 1.45;
      text-align: left;
      white-space: normal;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-4px);
      transition:
        opacity 150ms ease,
        transform 150ms ease,
        visibility 150ms;

      &::before {
        content: '';
        position: absolute;
        top: -4px;
        right: 1.5rem;
        width: 8px;
        height: 8px;
        border-radius: 1px;
        background: inherit;
        transform: rotate(45deg);
      }
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

    @media (prefers-reduced-motion: reduce) {
      .insight-tooltip {
        transition: none;
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
