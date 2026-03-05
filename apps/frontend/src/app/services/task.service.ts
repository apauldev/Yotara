import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Task } from '@yotara/shared';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TaskService {
    private http = inject(HttpClient);
    private baseUrl = environment.apiBaseUrl;

    /** Reactive signal backed by the tasks HTTP request. */
    readonly tasks = toSignal(
        this.http.get<Task[]>(`${this.baseUrl}/tasks`),
        { initialValue: [] as Task[] }
    );

    /** Derived signal: tasks grouped by completion status. */
    readonly pendingTasks = computed(() =>
        this.tasks().filter(t => !t.completed)
    );

    readonly completedTasks = computed(() =>
        this.tasks().filter(t => t.completed)
    );
}
