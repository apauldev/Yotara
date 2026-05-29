import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TaskSortOption } from '../../utils/task-sort';

@Component({
  selector: 'app-task-view-controls',
  standalone: true,
  imports: [],
  template: `
    <div class="view-controls">
      <div class="control-group">
        <button
          type="button"
          class="control-pill"
          [class.active]="sortOption === 'date'"
          (click)="sortOptionChange.emit('date')"
        >
          Date
        </button>
        <button
          type="button"
          class="control-pill"
          [class.active]="sortOption === 'alpha'"
          (click)="sortOptionChange.emit('alpha')"
        >
          A-Z
        </button>
      </div>

      <div class="control-divider"></div>

      <div class="control-group">
        <button
          type="button"
          class="control-pill"
          [class.active]="pageSize === 10"
          (click)="pageSizeChange.emit(10)"
        >
          10
        </button>
        <button
          type="button"
          class="control-pill"
          [class.active]="pageSize === 25"
          (click)="pageSizeChange.emit(25)"
        >
          25
        </button>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .view-controls {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }

    .control-group {
      display: flex;
      background: var(--surface-container-low);
      border-radius: 0.8rem;
      padding: 0.25rem;
      box-shadow: inset 0 0 0 1px var(--outline-variant);
    }

    .control-pill {
      border: none;
      background: transparent;
      color: var(--on-surface-subtle);
      padding: 0.35rem 0.7rem;
      border-radius: 0.6rem;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        color: var(--on-surface);
      }

      &.active {
        background: var(--bg-card, #fff);
        color: var(--primary-solid);
        box-shadow: 0 2px 4px var(--surface-dim);
      }
    }

    .control-divider {
      width: 1px;
      height: 1.2rem;
      background: var(--outline-variant);
    }

    @media (max-width: 600px) {
      .view-controls {
        gap: 0.4rem;
      }

      .control-pill {
        padding: 0.35rem 0.5rem;
        font-size: 0.74rem;
      }
    }

    @media (max-width: 480px) {
      .control-divider {
        display: none;
      }
    }
  `,
})
export class TaskViewControlsComponent {
  @Input({ required: true }) sortOption: TaskSortOption = 'date';
  @Input({ required: true }) pageSize: 10 | 25 = 10;
  @Output() readonly sortOptionChange = new EventEmitter<TaskSortOption>();
  @Output() readonly pageSizeChange = new EventEmitter<10 | 25>();
}
