import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { isHexColor, pickOnColor } from '../../utils/color-contrast';
import { labelIconDefinition } from '../../utils/label-icons';

export type LabelIconSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * The solid label-color icon tile shared by chips, the Labels directory, the
 * pane header, the icon picker, and the editor preview. The glyph color is
 * computed from the tile color so light label colors stay readable.
 *
 * The tile is decorative: callers render the label name next to it or supply
 * an accessible name on the surrounding control.
 */
@Component({
  selector: 'app-label-icon',
  standalone: true,
  imports: [FontAwesomeModule],
  host: {
    '[attr.data-size]': 'size',
    '[style.--label-color]': 'tileColor',
    '[style.--label-on-strong]': 'onColor',
  },
  template: `
    <span class="label-icon" [class.label-icon-flat]="flat">
      <fa-icon [icon]="definition" aria-hidden="true" />
    </span>
  `,
  styles: [
    `
      :host {
        --label-color: var(--accent-strong);
        --label-on-strong: hsl(var(--primary-foreground));
        display: inline-grid;
        flex: 0 0 auto;
        place-items: center;
      }

      .label-icon {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 0.6rem;
        background: var(--label-color);
        color: var(--label-on-strong);
        font-size: 0.9rem;
        line-height: 1;
      }

      :host([data-size='xs']) .label-icon {
        width: 1.05rem;
        height: 1.05rem;
        border-radius: 0.38rem;
        font-size: 0.55rem;
      }

      :host([data-size='sm']) .label-icon {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 0.45rem;
        font-size: 0.62rem;
      }

      :host([data-size='lg']) .label-icon {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.75rem;
        font-size: 1.05rem;
      }

      .label-icon-flat {
        width: auto;
        height: auto;
        background: transparent;
        color: inherit;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class LabelIconComponent {
  @Input({ required: true }) icon!: string;
  @Input() color: string | null | undefined = null;
  @Input() size: LabelIconSize = 'md';
  /** Selected-state glyph: no own tile, inherits the surrounding pill color. */
  @Input() flat = false;

  protected get definition() {
    return labelIconDefinition(this.icon);
  }

  /** Legacy colors that predate validation fall back to the accent tokens. */
  protected get tileColor(): string {
    return isHexColor(this.color) ? this.color.toLowerCase() : 'var(--accent-strong)';
  }

  protected get onColor(): string {
    return isHexColor(this.color)
      ? (pickOnColor(this.color) ?? 'hsl(var(--primary-foreground))')
      : 'hsl(var(--primary-foreground))';
  }
}
