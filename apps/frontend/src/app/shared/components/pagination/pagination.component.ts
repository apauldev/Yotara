import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pagination-container" *ngIf="totalPages > 1">
      <div class="pagination-info">
        Showing <strong>{{ startItem }}</strong> – <strong>{{ endItem }}</strong> of
        <strong>{{ totalItems }}</strong>
      </div>

      <div class="pagination-controls">
        <button
          type="button"
          class="pagination-button"
          [disabled]="currentPage === 1"
          (click)="onPageChange(currentPage - 1)"
          aria-label="Previous page"
        >
          &larr;
        </button>

        <div class="pagination-pages">
          <button
            *ngFor="let page of pages"
            type="button"
            class="page-number"
            [class.page-active]="page === currentPage"
            [class.page-dots]="page === '...'"
            [disabled]="page === '...'"
            (click)="onPageChange(page)"
          >
            {{ page }}
          </button>
        </div>

        <button
          type="button"
          class="pagination-button"
          [disabled]="currentPage === totalPages"
          (click)="onPageChange(currentPage + 1)"
          aria-label="Next page"
        >
          &rarr;
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .pagination-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 2rem 0;
        border-top: 1px solid var(--border-subtle, #eee);
        margin-top: 2rem;
      }

      .pagination-info {
        font-size: 0.875rem;
        color: var(--text-muted, #666);
      }

      .pagination-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .pagination-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.5rem;
        border: 1px solid var(--border-default, #ddd);
        background: var(--bg-card, #fff);
        color: var(--text-default, #333);
        cursor: pointer;
        transition: all 0.2s;
      }

      .pagination-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pagination-button:not(:disabled):hover {
        background: var(--bg-hover, #f5f5f5);
        border-color: var(--border-hover, #ccc);
      }

      .pagination-pages {
        display: flex;
        gap: 0.25rem;
      }

      .page-number {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 2.5rem;
        height: 2.5rem;
        padding: 0 0.5rem;
        border-radius: 0.5rem;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text-muted, #666);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .page-number:hover {
        background: var(--bg-hover, #f5f5f5);
        color: var(--text-default, #333);
      }

      .page-number.page-active {
        background: var(--bg-active, #f0f0f0);
        color: var(--text-accent, #000);
        border-color: var(--border-default, #ddd);
      }

      .page-number.page-dots {
        cursor: default;
        opacity: 0.7;
      }

      @media (max-width: 640px) {
        .pagination-pages {
          display: none;
        }
      }
    `,
  ],
})
export class PaginationComponent {
  @Input({ required: true }) totalItems = 0;
  @Input({ required: true }) pageSize = 10;
  @Input({ required: true }) currentPage = 1;

  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get startItem(): number {
    return this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  get pages(): (number | string)[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const delta = 1; // Number of pages to show around current
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    range.push(1);
    for (let i = current - delta; i <= current + delta; i++) {
      if (i < total && i > 1) {
        range.push(i);
      }
    }
    if (total > 1) {
      range.push(total);
    }

    for (const i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return rangeWithDots;
  }

  onPageChange(page: number | string) {
    if (
      typeof page === 'number' &&
      page >= 1 &&
      page <= this.totalPages &&
      page !== this.currentPage
    ) {
      this.pageChange.emit(page);
    }
  }
}
