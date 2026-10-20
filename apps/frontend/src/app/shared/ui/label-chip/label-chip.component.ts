import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Label } from '@yotara/shared';
import { isHexColor, isNearNeutralColor, pickOnColor } from '../../utils/color-contrast';
import { LabelIconComponent } from '../label-icon/label-icon.component';

/**
 * The one shared label chip component. The icon tile renders the label's
 * curated icon key through LabelIconComponent; legacy keys fall back to the
 * generic tag without breaking the surface.
 *
 * Recipes by surface:
 *   task card / search results — static (interactive=false), full mode
 *   picker options             — interactive, selected for the chosen option
 *   removable anywhere         — removable=true (never inside another button)
 *   compact/icon-only          — mode="compact"; an accessible name is always
 *                                present and `title` is only a hover extra
 *
 * Color tokens (host):
 *   --label-color     the label's own color (accent fallback for legacy rows
 *                     whose color predates validation)
 *   --label-on-strong computed black/white text color over --label-color
 * --label-soft (12% tint over the surface) is derived in CSS from --label-color
 * via color-mix, so theme changes need no recompute.
 */
@Component({
  selector: 'app-label-chip',
  standalone: true,
  imports: [LabelIconComponent],
  host: {
    '[class.label-chip-neutral]': 'neutral',
    '[class.label-chip-color-first]': 'colorFirst',
    '[style.--label-color]': 'tokens.color',
    '[style.--label-on-strong]': 'tokens.onColor',
  },
  template: `
    <span class="label-chip" [class.label-chip-selected]="selected" [attr.data-size]="size">
      @if (interactive) {
        <button
          type="button"
          class="label-chip-body label-chip-control"
          [attr.aria-pressed]="selected"
          [attr.title]="label.name"
          (click)="handleSelect($event)"
        >
          <app-label-icon
            [icon]="label.icon"
            [color]="label.color"
            [size]="size === 'sm' ? 'xs' : 'sm'"
            [flat]="selected || colorFirst"
          />
          @if (mode === 'full') {
            <span class="label-chip-name">{{ label.name }}</span>
          } @else {
            <span class="sr-only">Label: {{ label.name }}</span>
          }
        </button>
      } @else {
        <span
          class="label-chip-body"
          role="img"
          [attr.aria-label]="'Label: ' + label.name"
          [attr.title]="label.name"
        >
          <app-label-icon
            [icon]="label.icon"
            [color]="label.color"
            [size]="size === 'sm' ? 'xs' : 'sm'"
            [flat]="selected || colorFirst"
          />
          @if (mode === 'full') {
            <span class="label-chip-name">{{ label.name }}</span>
          }
        </span>
      }

      @if (removable) {
        <button
          type="button"
          class="label-chip-remove"
          [attr.aria-label]="'Remove ' + label.name"
          [title]="'Remove ' + label.name"
          (click)="handleRemove($event)"
          (keydown)="$event.stopPropagation()"
        >
          ×
        </button>
      }
    </span>
  `,
  styles: [
    `
      :host {
        /* Replaced from label data when its color parses. */
        --label-color: var(--accent-strong);
        --label-strong: var(--label-color);
        --label-soft: color-mix(in srgb, var(--label-color) 12%, var(--surface-card));
        --label-on-strong: hsl(var(--primary-foreground));
        display: inline-flex;
        max-width: 100%;
      }

      .label-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.05rem;
        min-width: 0;
      }

      .label-chip-body {
        appearance: none;
        border: 0;
        font: inherit;
        padding: 0;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        min-height: 1.55rem;
        border-radius: 999px;
        padding: 0.1rem 0.5rem 0.1rem 0.22rem;
        background: var(--label-soft);
        color: var(--on-surface);
        white-space: nowrap;
      }

      /* Near-neutral label colors would vanish on the tint; give the body a
         hairline of the label color so the chip's identity survives. */
      :host(.label-chip-neutral) .label-chip-body {
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--label-strong) 55%, transparent);
      }

      /* Opt-in color-first mode: a solid label-color pill, icon and name
         switching to the contrast-safe on-color. */
      :host(.label-chip-color-first) .label-chip-body {
        background: var(--label-strong);
        color: var(--label-on-strong);
        box-shadow: none;
      }

      .label-chip-control {
        cursor: pointer;
        text-align: left;
      }

      .label-chip-name {
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-transform: none;
        max-width: 10rem;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .label-chip[data-size='sm'] .label-chip-body {
        min-height: 1.35rem;
      }

      .label-chip[data-size='sm'] .label-chip-name {
        max-width: 6.5rem;
      }

      /* Selected/active: solid label-color pill, glyph straight on the fill. */
      .label-chip-selected .label-chip-body {
        background: var(--label-strong);
        color: var(--label-on-strong);
        box-shadow: none;
      }

      .label-chip-control:focus-visible,
      .label-chip-remove:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      .label-chip-remove {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--on-surface-muted);
        font-size: 0.8rem;
        line-height: 1;
        padding: 0.2rem 0.3rem;
        border-radius: 999px;
        cursor: pointer;
        display: inline-grid;
        place-items: center;
        min-width: 1.4rem;
        min-height: 1.4rem;
      }

      .label-chip-remove:hover {
        color: var(--on-surface);
        background: color-mix(in srgb, var(--label-color) 18%, transparent);
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      @media (pointer: coarse) {
        .label-chip-remove {
          min-width: 2.25rem;
          min-height: 2.25rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class LabelChipComponent {
  @Input({ required: true }) label!: Label;
  @Input() mode: 'full' | 'compact' = 'full';
  @Input() selected = false;
  @Input() removable = false;
  @Input() interactive = false;
  @Input() size: 'sm' | 'md' = 'md';
  /** Opt-in preference: fill the whole chip with the label color. */
  @Input() colorFirst = false;

  @Output() readonly select = new EventEmitter<Label>();
  @Output() readonly remove = new EventEmitter<Label>();

  /** Near-neutral colors need the chip's subtle border (see CSS). */
  protected get neutral(): boolean {
    return isHexColor(this.label?.color) ? isNearNeutralColor(this.label.color) : true;
  }

  /**
   * Legacy rows may store colors that predate API validation; they fall back
   * to the accent tokens the caller already renders, keeping the CSS default
   * on :host.
   */
  protected get tokens(): { color: string; onColor: string } {
    const color = this.label?.color;
    if (!isHexColor(color)) {
      return {
        color: 'var(--accent-strong)',
        onColor: 'hsl(var(--primary-foreground))',
      };
    }

    return {
      color: color.toLowerCase(),
      onColor: pickOnColor(color) ?? 'hsl(var(--primary-foreground))',
    };
  }

  protected handleSelect(event: MouseEvent) {
    event.stopPropagation();
    this.select.emit(this.label);
  }

  protected handleRemove(event: MouseEvent) {
    event.stopPropagation();
    this.remove.emit(this.label);
  }
}
