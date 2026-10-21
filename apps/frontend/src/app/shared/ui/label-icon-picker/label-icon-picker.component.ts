import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  viewChildren,
} from '@angular/core';
import { LABEL_ICON_GROUPS, LABEL_ICON_KEYS, isLabelIcon, type LabelIcon } from '@yotara/shared';
import { LabelIconComponent } from '../label-icon/label-icon.component';

/**
 * The curated icon picker. The 24 options are a real radio group with roving
 * tabindex: one option is tabbable, arrows move focus inside the grid, and
 * Enter/Space pick the focused glyph natively. Icons render as large glyphs
 * without tiles so the preview above the picker carries the selected color.
 */
@Component({
  selector: 'app-label-icon-picker',
  standalone: true,
  imports: [LabelIconComponent],
  template: `
    <div class="icon-picker">
      <div
        class="icon-groups"
        role="radiogroup"
        aria-label="Label icon"
        (keydown)="onKeydown($event)"
      >
        @for (group of groups; track group.id) {
          <div class="icon-group">
            <span class="group-label">{{ group.label }}</span>
            <div class="icon-grid">
              @for (key of group.icons; track key) {
                <button
                  #iconOption
                  type="button"
                  class="icon-option"
                  role="radio"
                  [attr.aria-checked]="icon === key"
                  [attr.aria-label]="iconLabel(key) + ' icon'"
                  [attr.title]="iconLabel(key)"
                  [tabindex]="optionIndex(key) === activeIndex() ? 0 : -1"
                  (focus)="activeIndex.set(optionIndex(key))"
                  (click)="choose(key)"
                >
                  <app-label-icon [icon]="key" size="xl" [flat]="true" />
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .icon-picker {
        display: grid;
        gap: 0.9rem;
      }

      .group-label {
        display: block;
        margin-bottom: 0.35rem;
        color: var(--on-surface-subtle);
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .icon-groups {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: 1rem 1.5rem;
      }

      .icon-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.25rem;
      }

      .icon-option {
        appearance: none;
        border: 0;
        display: grid;
        place-items: center;
        width: 100%;
        min-width: 0;
        min-height: 2.75rem;
        padding: 0.15rem;
        border-radius: 0.75rem;
        background: transparent;
        color: var(--on-surface-muted);
        cursor: pointer;
        transition:
          color 120ms ease,
          box-shadow 120ms ease;
      }

      .icon-option:hover {
        color: var(--on-surface);
      }

      /* Selection is a glyph color and outline, not a filled tile. */
      .icon-option[aria-checked='true'] {
        color: var(--primary-solid);
        box-shadow: inset 0 0 0 1.5px var(--primary-solid);
      }

      .icon-option:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 1px;
      }

      @media (pointer: coarse) {
        .icon-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        .icon-option {
          min-height: 3rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class LabelIconPickerComponent implements OnChanges {
  @Input() icon = 'tag';

  @Output() readonly iconChange = new EventEmitter<LabelIcon>();

  protected readonly groups = LABEL_ICON_GROUPS;
  protected readonly activeIndex = signal(0);
  private readonly options = viewChildren<ElementRef<HTMLButtonElement>>('iconOption');

  ngOnChanges() {
    this.activeIndex.set(this.selectedIndex());
  }

  protected choose(icon: LabelIcon) {
    if (this.icon !== icon) {
      this.iconChange.emit(icon);
    }
  }

  protected optionIndex(key: LabelIcon): number {
    return LABEL_ICON_KEYS.indexOf(key);
  }

  protected iconLabel(key: LabelIcon): string {
    return key.replace(/-/g, ' ');
  }

  protected onKeydown(event: KeyboardEvent) {
    const keys = LABEL_ICON_KEYS;
    const last = keys.length - 1;
    let next: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = this.activeIndex() >= last ? 0 : this.activeIndex() + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = this.activeIndex() <= 0 ? last : this.activeIndex() - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.activeIndex.set(next);
    this.options()[next]?.nativeElement.focus();
  }

  private selectedIndex(): number {
    if (!isLabelIcon(this.icon)) {
      return 0;
    }
    const index = LABEL_ICON_KEYS.indexOf(this.icon);
    return index === -1 ? 0 : index;
  }
}
