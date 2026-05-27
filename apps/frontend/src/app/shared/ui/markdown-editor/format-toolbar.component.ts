import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
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
  faChevronLeft,
  faChevronRight,
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
      <button type="button" class="scroll-button" aria-label="Scroll left" (click)="scrollLeft()">
        <fa-icon [icon]="faChevronLeft" />
      </button>
      <div #scrollContainer class="toolbar-scroll">
        <div class="toolbar-group">
          <button
            type="button"
            class="tb"
            aria-label="Heading"
            title="Heading"
            data-syntax="# text"
            (click)="insertSyntax.emit({ prefix: '# ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faHeading" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Bold"
            title="Bold"
            data-syntax="**text**"
            (click)="insertSyntax.emit({ prefix: '**', suffix: '**' })"
          >
            <fa-icon [icon]="faBold" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Italic"
            title="Italic"
            data-syntax="_text_"
            (click)="insertSyntax.emit({ prefix: '_', suffix: '_' })"
          >
            <fa-icon [icon]="faItalic" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Strikethrough"
            title="Strikethrough"
            data-syntax="~~text~~"
            (click)="insertSyntax.emit({ prefix: '~~', suffix: '~~' })"
          >
            <fa-icon [icon]="faStrikethrough" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Inline code"
            title="Inline code"
            [attr.data-syntax]="backtickSyntax"
            (click)="onInlineCode()"
          >
            <fa-icon [icon]="faCode" />
          </button>
          <span class="tb-sep"></span>
          <button
            type="button"
            class="tb"
            aria-label="Blockquote"
            title="Blockquote"
            data-syntax="> text"
            (click)="insertSyntax.emit({ prefix: '> ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faQuoteLeft" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Bullet list"
            title="Bullet list"
            data-syntax="- item"
            (click)="insertSyntax.emit({ prefix: '- ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faList" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Numbered list"
            title="Numbered list"
            data-syntax="1. item"
            (click)="insertSyntax.emit({ prefix: '1. ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faListOl" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Checklist"
            title="Checklist"
            data-syntax="- [ ] item"
            (click)="insertSyntax.emit({ prefix: '- [ ] ', suffix: '', multiline: true })"
          >
            <fa-icon [icon]="faSquareCheck" />
          </button>
          <span class="tb-sep"></span>
          <button
            type="button"
            class="tb"
            aria-label="Insert link"
            title="Link"
            data-syntax="[text](url)"
            (click)="insertSyntax.emit({ prefix: '[', suffix: '](url)' })"
          >
            <fa-icon [icon]="faLink" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Insert image"
            title="Image"
            data-syntax="![alt](url)"
            (click)="insertSyntax.emit({ prefix: '![alt](', suffix: ')' })"
          >
            <fa-icon [icon]="faImage" />
          </button>
          <button
            type="button"
            class="tb"
            aria-label="Horizontal rule"
            title="Horizontal rule"
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
      <button type="button" class="scroll-button" aria-label="Scroll right" (click)="scrollRight()">
        <fa-icon [icon]="faChevronRight" />
      </button>
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
        gap: 0.15rem;
        padding: 0.3rem 0.35rem;
        border-radius: 0.6rem;
        background: var(--surface-container-low);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .toolbar-scroll {
        flex: 1 1 auto;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .toolbar-scroll::-webkit-scrollbar {
        display: none;
      }

      .toolbar-group {
        display: flex;
        align-items: center;
        gap: 0.1rem;
        white-space: nowrap;
      }

      .tb-group-end {
        flex: 0 0 auto;
        margin-left: auto;
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

      .tb:active {
        background: var(--surface-container-highest);
      }

      .tb:hover::after {
        content: attr(data-syntax);
        position: absolute;
        top: calc(100% + 0.3rem);
        left: 50%;
        transform: translateX(-50%);
        padding: 0.15rem 0.4rem;
        border-radius: 0.3rem;
        background: var(--primary-solid);
        color: var(--surface-container-lowest);
        font-family: ui-monospace, 'SF Mono', monospace;
        font-size: 0.65rem;
        font-weight: 500;
        white-space: nowrap;
        pointer-events: none;
        z-index: 60;
        box-shadow: 0 2px 6px var(--surface-dim-strong);
      }

      .tb-active {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      .tb-active:hover {
        background: var(--primary-soft-strong);
        color: var(--primary-solid);
      }

      .tb-sep {
        display: inline-block;
        width: 1px;
        height: 1.15rem;
        margin: 0 0.2rem;
        background: var(--outline-variant);
        flex-shrink: 0;
      }

      .scroll-button {
        appearance: none;
        border: 0;
        width: 1.4rem;
        height: 2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.35rem;
        background: transparent;
        color: var(--on-surface-muted);
        font-size: 0.7rem;
        cursor: pointer;
        flex-shrink: 0;
        transition: background-color 120ms ease;
      }

      .scroll-button:hover {
        background: var(--surface-container-high);
        color: var(--on-surface);
      }
    `,
  ],
})
export class FormatToolbarComponent {
  @Input() previewMode = false;
  @Output() readonly insertSyntax = new EventEmitter<SyntaxInsert>();
  @Output() readonly togglePreview = new EventEmitter<void>();

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLElement>;

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
  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;

  // Used in template where backtick can't appear in template literal
  protected readonly backtickSyntax = '`code`';

  protected onInlineCode() {
    this.insertSyntax.emit({ prefix: '`', suffix: '`' });
  }

  protected scrollLeft() {
    const el = this.scrollContainer?.nativeElement;
    if (el) el.scrollBy({ left: -140, behavior: 'smooth' });
  }

  protected scrollRight() {
    const el = this.scrollContainer?.nativeElement;
    if (el) el.scrollBy({ left: 140, behavior: 'smooth' });
  }
}
