import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBold,
  faItalic,
  faStrikethrough,
  faLink,
  faList,
  faEye,
  faEdit,
  faHeading,
  faCode,
  faQuoteLeft,
  faListOl,
  faSquareCheck,
  faMinus,
  faImage,
} from '@fortawesome/free-solid-svg-icons';

export interface SyntaxInsert {
  prefix: string;
  suffix: string;
  multiline?: boolean;
}

@Component({
  selector: 'app-format-toolbar',
  standalone: true,
  imports: [FontAwesomeModule],
  template: `
    <div class="format-toolbar" role="toolbar" aria-label="Formatting toolbar">
      <div class="toolbar-scroll">
        <div class="toolbar-group">
          <button
            type="button"
            class="tb"
            aria-label="Heading"
            data-label="Heading"
            data-syntax="# text"
            (click)="insertSyntax.emit({ prefix: '# ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faHeading" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Bold"
            data-label="Bold"
            data-syntax="**text**"
            (click)="insertSyntax.emit({ prefix: '**', suffix: '**' })"
          >
            <fa-icon [icon]="faBold" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Italic"
            data-label="Italic"
            data-syntax="_text_"
            (click)="insertSyntax.emit({ prefix: '_', suffix: '_' })"
          >
            <fa-icon [icon]="faItalic" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Strikethrough"
            data-label="Strikethrough"
            data-syntax="~~text~~"
            (click)="insertSyntax.emit({ prefix: '~~', suffix: '~~' })"
          >
            <fa-icon [icon]="faStrikethrough" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Inline code"
            data-label="Inline code"
            [attr.data-syntax]="backtickSyntax"
            (click)="onInlineCode()"
          >
            <fa-icon [icon]="faCode" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Blockquote"
            data-label="Blockquote"
            data-syntax="> text"
            (click)="insertSyntax.emit({ prefix: '> ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faQuoteLeft" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Bullet list"
            data-label="Bullet list"
            data-syntax="- item"
            (click)="insertSyntax.emit({ prefix: '- ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faList" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Numbered list"
            data-label="Numbered list"
            data-syntax="1. item"
            (click)="insertSyntax.emit({ prefix: '1. ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faListOl" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Checklist"
            data-label="Checklist"
            data-syntax="- [ ] item"
            (click)="insertSyntax.emit({ prefix: '- [ ] ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faSquareCheck" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Insert link"
            data-label="Insert link"
            data-syntax="[text](url)"
            (click)="insertSyntax.emit({ prefix: '[', suffix: '](url)' })"
          >
            <fa-icon [icon]="faLink" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Insert image"
            data-label="Insert image"
            data-syntax="![alt](url)"
            (click)="insertSyntax.emit({ prefix: '![alt](', suffix: ')' })"
          >
            <fa-icon [icon]="faImage" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Horizontal rule"
            data-label="Horizontal rule"
            data-syntax="---"
            (click)="
              insertSyntax.emit({
                prefix:
                  '

---

',
                suffix: '',
                multiline: true,
              })
            "
          >
            <fa-icon [icon]="faMinus" />
          </button>
        </div>
      </div>
      <div class="tb-group-end">
        <button
          type="button"
          class="tb tb-toggle"
          [class.tb-active]="previewMode"
          [attr.aria-label]="previewMode ? 'Switch to edit mode' : 'Preview rendered markdown'"
          [attr.title]="previewMode ? 'Edit — make changes' : 'Preview'"
          (click)="togglePreview.emit()"
        >
          <fa-icon [icon]="previewMode ? faEdit : faEye" />
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .format-toolbar {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.35rem;
        border-radius: 0.6rem;
        background: var(--surface-container-low);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .toolbar-scroll {
        flex: 1 1 auto;
        min-width: 0;
        overflow: visible;
      }

      .toolbar-group {
        display: flex;
        align-items: center;
        gap: 0.2rem;
        flex-wrap: wrap;
      }

      .tb-group-end {
        flex: 0 0 auto;
        margin-left: 0;
        display: flex;
        align-items: center;
      }

      .tb {
        appearance: none;
        border: 0;
        width: 2rem;
        height: 2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.4rem;
        background: transparent;
        color: var(--on-surface-muted);
        font-size: 0.82rem;
        cursor: pointer;
        flex-shrink: 0;
        position: relative;
        transition:
          background-color 120ms ease,
          color 120ms ease;
      }

      .tb:hover {
        background: var(--surface-container-high);
        color: var(--on-surface);
      }

      .tb:hover ::ng-deep svg {
        color: var(--on-surface);
      }

      .tb:active {
        background: var(--surface-container-highest);
      }

      .tb:hover::after {
        content: attr(data-label) ' — ' attr(data-syntax);
        position: absolute;
        top: calc(100% + 0.3rem);
        left: 50%;
        transform: translateX(-50%);
        padding: 0.2rem 0.5rem;
        border-radius: 0.35rem;
        background: var(--surface-container-high);
        color: var(--on-surface);
        font-size: 0.68rem;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        z-index: 60;
        box-shadow: 0 2px 6px var(--surface-dim);
      }

      .tb-active {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      .tb-active:hover {
        background: var(--primary-soft-strong);
        color: var(--primary-solid);
      }

      @media (max-width: 720px) {
        .format-toolbar {
          align-items: stretch;
          gap: 0.25rem;
          padding: 0.28rem;
          border-radius: 0.55rem;
        }

        .toolbar-scroll {
          flex: 1 1 100%;
          overflow: visible;
        }

        .toolbar-group {
          flex-wrap: wrap;
          white-space: normal;
          gap: 0.2rem;
        }

        .tb-group-end {
          width: 100%;
          margin-left: 0;
          justify-content: flex-end;
        }

        .tb {
          width: 1.95rem;
          height: 1.95rem;
          border-radius: 0.35rem;
        }

        .tb-sep {
          display: none;
        }
      }
    `,
  ],
})
export class FormatToolbarComponent {
  @Input() previewMode = false;
  @Output() readonly insertSyntax = new EventEmitter<SyntaxInsert>();
  @Output() readonly togglePreview = new EventEmitter<void>();

  protected readonly faBold = faBold;
  protected readonly faItalic = faItalic;
  protected readonly faStrikethrough = faStrikethrough;
  protected readonly faLink = faLink;
  protected readonly faList = faList;
  protected readonly faEye = faEye;
  protected readonly faEdit = faEdit;
  protected readonly faHeading = faHeading;
  protected readonly faCode = faCode;
  protected readonly faQuoteLeft = faQuoteLeft;
  protected readonly faListOl = faListOl;
  protected readonly faSquareCheck = faSquareCheck;
  protected readonly faMinus = faMinus;
  protected readonly faImage = faImage;

  // Used in template where backtick can't appear in template literal
  protected readonly backtickSyntax = '`code`';

  protected onInlineCode() {
    this.insertSyntax.emit({ prefix: '`', suffix: '`' });
  }
}
