import { Component, Input, TemplateRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';
import { Task } from '@yotara/shared';

@Component({
  selector: 'app-task-stack',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="task-stack">
      @for (task of tasks; track task.id) {
        <div class="task-group" @taskSlide>
          <ng-container
            *ngTemplateOutlet="taskCard; context: { $implicit: task, compact: false }"
          />

          @if (subtasksByParent?.get(task.id); as subtasks) {
            <div class="subtask-nested-list">
              @for (subtask of subtasks; track subtask.id) {
                <div class="subtask-item-wrapper" @taskSlide>
                  <ng-container
                    *ngTemplateOutlet="taskCard; context: { $implicit: subtask, compact: true }"
                  />
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .task-stack {
      display: grid;
      gap: 1.25rem;
    }

    .task-group {
      display: grid;
      gap: 0.4rem;
    }

    .subtask-nested-list {
      margin-left: 1.4rem;
      display: grid;
      gap: 0.15rem;
      padding: 0.4rem 0.6rem 0.4rem 0.8rem;
      background: var(--surface-card);
      border-radius: 0.8rem;
      border-left: 3px solid var(--outline-variant);
      box-shadow:
        0 2px 8px var(--surface-dim),
        inset 0 0 0 1px var(--outline-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [
    trigger('taskSlide', [
      transition(':enter', [
        style({ transform: 'translateY(6px)' }),
        animate('180ms ease-out', style({ transform: 'translateY(0)' })),
      ]),
      transition(':leave', [animate('140ms ease-in', style({ transform: 'translateY(6px)' }))]),
    ]),
  ],
})
export class TaskStackComponent {
  @Input({ required: true }) tasks: Task[] = [];
  @Input() subtasksByParent: Map<string, Task[]> | null = null;
  @Input({ required: true }) taskCard!: TemplateRef<{ $implicit: Task; compact: boolean }>;
}
