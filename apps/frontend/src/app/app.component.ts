import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TaskService } from './services/task.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="container">
      <h1>Yotara</h1>
      <p class="tagline">Tasks that flow. Naturally.</p>

      <section>
        <h2>Pending ({{ taskService.pendingTasks().length }})</h2>
        <ul>
          @for (task of taskService.pendingTasks(); track task.id) {
            <li class="task-item">
              <span class="priority priority--{{ task.priority }}">{{ task.priority }}</span>
              <strong>{{ task.title }}</strong>
              <span class="status">{{ task.status }}</span>
            </li>
          }
        </ul>
      </section>

      <section>
        <h2>Completed ({{ taskService.completedTasks().length }})</h2>
        <ul>
          @for (task of taskService.completedTasks(); track task.id) {
            <li class="task-item task-item--done">
              <span class="priority priority--{{ task.priority }}">{{ task.priority }}</span>
              <strong>{{ task.title }}</strong>
            </li>
          }
        </ul>
      </section>

      <router-outlet />
    </div>
  `,
  styles: [`
    .container { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
    .tagline { color: #6b7280; font-style: italic; margin-top: -.5rem; }
    .task-item { display: flex; align-items: center; gap: .75rem; padding: .5rem 0; border-bottom: 1px solid #f3f4f6; }
    .task-item--done strong { text-decoration: line-through; color: #9ca3af; }
    .priority { font-size: .7rem; padding: 2px 6px; border-radius: 9999px; font-weight: 600; text-transform: uppercase; }
    .priority--high { background: #fee2e2; color: #dc2626; }
    .priority--medium { background: #fef3c7; color: #d97706; }
    .priority--low { background: #dcfce7; color: #16a34a; }
    .status { margin-left: auto; font-size: .75rem; color: #9ca3af; }
  `]
})
export class AppComponent {
  protected taskService = inject(TaskService);
}
