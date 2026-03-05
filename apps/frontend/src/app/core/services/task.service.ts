import { Injectable, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Task } from '@yotara/shared';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  readonly tasks = toSignal(this.http.get<Task[]>(`${this.baseUrl}/tasks`), {
    initialValue: [] as Task[],
  });

  readonly pendingTasks = computed(() => this.tasks().filter((task) => !task.completed));
  readonly completedTasks = computed(() => this.tasks().filter((task) => task.completed));
}
