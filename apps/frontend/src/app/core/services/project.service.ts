import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CreateProjectDto, Project, UpdateProjectDto } from '@yotara/shared';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  firstValueFrom,
  map,
  of,
  switchMap,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);
  private authState = inject(AuthStateService);
  private baseUrl = environment.apiBaseUrl;
  private refreshState = signal(0);
  private loadingState = signal(false);
  private savingState = signal(false);
  private errorState = signal<string | null>(null);

  readonly projects = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId]) => {
        if (!initialized || !currentUserId) {
          this.errorState.set(null);
          return of([] as Project[]);
        }

        this.loadingState.set(true);
        this.errorState.set(null);

        return this.http.get<Project[]>(`${this.baseUrl}/projects`, { withCredentials: true }).pipe(
          map((projects) =>
            [...projects].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
          ),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
              this.errorState.set(null);
              return of([] as Project[]);
            }

            console.error('Failed to load projects', error);
            this.errorState.set('Could not load your projects right now.');
            return of([] as Project[]);
          }),
          finalize(() => {
            this.loadingState.set(false);
          }),
        );
      }),
    ),
    { initialValue: [] as Project[] },
  );

  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly hasProjects = computed(() => this.projects().length > 0);

  async createProject(payload: CreateProjectDto) {
    this.savingState.set(true);
    this.errorState.set(null);

    try {
      const created = await firstValueFrom(
        this.http.post<Project>(`${this.baseUrl}/projects`, payload, { withCredentials: true }),
      );
      this.refreshProjects();
      return created;
    } catch (error) {
      console.error('Failed to create project', error);
      this.errorState.set('Could not create your project right now.');
      throw error;
    } finally {
      this.savingState.set(false);
    }
  }

  async updateProject(projectId: string, payload: UpdateProjectDto) {
    this.savingState.set(true);
    this.errorState.set(null);

    try {
      const updated = await firstValueFrom(
        this.http.patch<Project>(`${this.baseUrl}/projects/${projectId}`, payload, {
          withCredentials: true,
        }),
      );
      this.refreshProjects();
      return updated;
    } catch (error) {
      console.error('Failed to update project', error);
      this.errorState.set('Could not update your project right now.');
      throw error;
    } finally {
      this.savingState.set(false);
    }
  }

  refreshProjects() {
    this.refreshState.update((value) => value + 1);
  }
}
