import { Injectable, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Task } from '@yotara/shared';
import { catchError, distinctUntilChanged, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private http = inject(HttpClient);
  private authState = inject(AuthStateService);
  private baseUrl = environment.apiBaseUrl;

  readonly tasks = toSignal(
    toObservable(this.authState.initialized).pipe(
      distinctUntilChanged(),
      switchMap((initialized) => {
        if (!initialized || !this.authState.isAuthenticated()) {
          return of([] as Task[]);
        }

        return this.http.get<Task[]>(`${this.baseUrl}/tasks`).pipe(
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
              return of([] as Task[]);
            }

            return throwError(() => error);
          }),
        );
      }),
    ),
    { initialValue: [] as Task[] },
  );

  readonly pendingTasks = computed(() => this.tasks().filter((task) => !task.completed));
  readonly completedTasks = computed(() => this.tasks().filter((task) => task.completed));
}
