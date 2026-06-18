import { Component, computed, inject } from '@angular/core';
import { TaskService } from '../../../../core/services/task.service';
import { TaskListComponent } from '../../components/task-list/task-list.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [TaskListComponent],
  template: `
    <app-task-list heading="Pending" [tasks]="pendingTasks()" [showStatus]="true" />
    <app-task-list heading="Completed" [tasks]="taskService.recentlyCompleted()" />
  `,
})
export class TasksPageComponent {
  protected taskService = inject(TaskService);

  protected readonly pendingTasks = computed(() =>
    this.taskService.allActiveTasks().filter((task) => !task.parentId),
  );
}
