import { Component, input, signal, inject, effect, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PreferencesStore } from '../../../core/services/preferences-store.service';

@Component({
  selector: 'app-suggestion-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="suggestion-tooltip-wrapper">
      <ng-content />

      @if (visible()) {
        <div
          class="tooltip-bubble"
          [class.tooltip-right]="position() === 'right'"
          [class.tooltip-left]="position() === 'left'"
          [class.tooltip-bottom]="position() === 'bottom'"
          role="status"
          #tooltip
        >
          <div class="tooltip-body">
            <p class="tooltip-text">{{ text() }}</p>

            @if (showDismissCheckbox()) {
              <label class="tooltip-checkbox">
                <input
                  type="checkbox"
                  [checked]="dontShowAgain()"
                  (change)="dontShowAgain.set(!dontShowAgain())"
                />
                Don't show this again
              </label>
            }

            <button type="button" class="tooltip-got-it" (click)="dismiss()">
              {{ ctaLabel() }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .suggestion-tooltip-wrapper {
        position: relative;
        display: inline-flex;
      }

      .tooltip-bubble {
        position: absolute;
        z-index: 100;
        min-width: 220px;
        max-width: 300px;
        padding: 0;
        border-radius: 0.75rem;
        background: var(--surface-card);
        box-shadow:
          0 12px 32px -4px rgb(0 0 0 / 14%),
          0 4px 12px -2px rgb(0 0 0 / 10%),
          inset 0 0 0 1px var(--outline-variant);
        animation: tooltip-enter 200ms cubic-bezier(0, 0, 0.2, 1);
      }

      @keyframes tooltip-enter {
        from {
          opacity: 0;
          transform: translateY(-4px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .tooltip-right {
        left: calc(100% + 12px);
        top: 50%;
        transform: translateY(-50%);
      }

      .tooltip-right::before {
        content: '';
        position: absolute;
        right: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-right-color: var(--outline-variant);
      }

      .tooltip-left {
        right: calc(100% + 12px);
        top: 50%;
        transform: translateY(-50%);
      }

      .tooltip-left::before {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-left-color: var(--outline-variant);
      }

      .tooltip-bottom {
        top: calc(100% + 12px);
        left: 50%;
        transform: translateX(-50%);
      }

      .tooltip-bottom::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-bottom-color: var(--outline-variant);
      }

      .tooltip-body {
        padding: 0.85rem 1rem;
        display: grid;
        gap: 0.65rem;
      }

      .tooltip-text {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.5;
        color: var(--on-surface);
      }

      .tooltip-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.78rem;
        color: var(--on-surface-muted);
        cursor: pointer;
        user-select: none;
      }

      .tooltip-checkbox input {
        accent-color: var(--primary-solid);
      }

      .tooltip-got-it {
        justify-self: end;
        min-height: 2rem;
        padding: 0 1rem;
        border: 0;
        border-radius: 0.5rem;
        background: var(--primary-action-gradient);
        color: hsl(var(--primary-foreground));
        font-weight: 700;
        font-size: 0.82rem;
        font-family: inherit;
        cursor: pointer;
        transition: all 150ms ease;
      }

      .tooltip-got-it:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px var(--primary-soft);
      }
    `,
  ],
})
export class SuggestionTooltipComponent {
  private readonly preferences = inject(PreferencesStore);

  readonly id = input.required<string>();
  readonly text = input.required<string>();
  readonly position = input<'right' | 'left' | 'bottom'>('right');
  readonly showDismissCheckbox = input(true);
  readonly ctaLabel = input('Got it');

  protected readonly dontShowAgain = signal(false);
  protected readonly visible = signal(false);

  private readonly tooltip = viewChild<ElementRef<HTMLElement>>('tooltip');

  constructor() {
    effect(() => {
      const enabled = this.preferences.areSuggestionsEnabled();
      const dismissed = this.preferences.isSuggestionDismissed(this.id());
      this.visible.set(enabled && !dismissed);
    });
  }

  protected dismiss(): void {
    if (this.dontShowAgain()) {
      this.preferences.dismissSuggestion(this.id());
    }
    this.visible.set(false);
  }
}
