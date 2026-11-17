import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  CreateProjectDto,
  CreateProjectSectionDto,
  Project,
  ProjectSection,
  ReorderProjectSectionsDto,
  Task,
  UpdateProjectDto,
  UpdateProjectSectionDto,
} from '@yotara/shared';
import { LogService } from './log.service';
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
  private logService = inject(LogService);
  private baseUrl = environment.apiBaseUrl;
  private refreshState = signal(0);
  private loadingState = signal(false);
  // A boolean flips back to false when the first overlapping mutation finishes,
  // hiding the saving state while another request is still in flight.
  private savingCount = signal(0);
  private errorState = signal<string | null>(null);

  readonly projects = toSignal(
    combineLatest([
      toObservable(this.authState.initialized).pipe(distinctUntilChanged()),
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.authState.onboardingCompleted).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([initialized, currentUserId, onboardingCompleted]) => {
        // The onboarding PATCH seeds the starter projects. Loading before it
        // finishes would cache a pre-seed list, so wait for the flag.
        if (!initialized || !currentUserId || !onboardingCompleted) {
          this.errorState.set(null);
          return of([] as Project[]);
        }

        this.loadingState.set(true);
        this.errorState.set(null);

        return this.http.get<Project[]>(`${this.baseUrl}/projects`, { withCredentials: true }).pipe(
          map((projects) => [...projects]),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
              this.errorState.set(null);
              return of([] as Project[]);
            }

            this.logService.error('Failed to load projects', error, 'ProjectService');
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
  readonly saving = computed(() => this.savingCount() > 0);
  readonly error = this.errorState.asReadonly();
  readonly hasProjects = computed(() => this.projects().length > 0);
  readonly version = this.refreshState.asReadonly();

  async getProject(projectId: string): Promise<Project | null> {
    try {
      return await firstValueFrom(
        this.http.get<Project>(`${this.baseUrl}/projects/${projectId}`, { withCredentials: true }),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  async getProjectTasks(projectId: string): Promise<Task[] | null> {
    try {
      return await firstValueFrom(
        this.http.get<Task[]>(`${this.baseUrl}/projects/${projectId}/tasks`, {
          withCredentials: true,
        }),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  async getSections(projectId: string): Promise<ProjectSection[]> {
    return firstValueFrom(
      this.http.get<ProjectSection[]>(`${this.baseUrl}/projects/${projectId}/sections`, {
        withCredentials: true,
      }),
    );
  }

  async createSection(
    projectId: string,
    payload: CreateProjectSectionDto,
  ): Promise<ProjectSection> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      const created = await firstValueFrom(
        this.http.post<ProjectSection>(`${this.baseUrl}/projects/${projectId}/sections`, payload, {
          withCredentials: true,
        }),
      );
      this.refresh();
      return created;
    } catch (error) {
      this.logService.error('Failed to create section', error, 'ProjectService');
      this.errorState.set('Could not create the section right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async updateSection(
    sectionId: string,
    payload: UpdateProjectSectionDto,
  ): Promise<ProjectSection> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      const updated = await firstValueFrom(
        this.http.patch<ProjectSection>(`${this.baseUrl}/sections/${sectionId}`, payload, {
          withCredentials: true,
        }),
      );
      this.refresh();
      return updated;
    } catch (error) {
      this.logService.error('Failed to update section', error, 'ProjectService');
      this.errorState.set('Could not update the section right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async reorderSections(projectId: string, ids: string[]): Promise<ProjectSection[]> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    const body: ReorderProjectSectionsDto = { projectId, ids };
    try {
      const reordered = await firstValueFrom(
        this.http.patch<ProjectSection[]>(`${this.baseUrl}/sections/reorder`, body, {
          withCredentials: true,
        }),
      );
      this.refresh();
      return reordered;
    } catch (error) {
      this.logService.error('Failed to reorder sections', error, 'ProjectService');
      this.errorState.set('Could not reorder your sections right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async deleteSection(sectionId: string): Promise<void> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      await firstValueFrom(
        this.http.delete(`${this.baseUrl}/sections/${sectionId}`, { withCredentials: true }),
      );
      this.refresh();
    } catch (error) {
      this.logService.error('Failed to delete section', error, 'ProjectService');
      this.errorState.set('Could not delete the section right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async createProject(payload: CreateProjectDto) {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);

    try {
      const created = await firstValueFrom(
        this.http.post<Project>(`${this.baseUrl}/projects`, payload, { withCredentials: true }),
      );
      this.refresh();
      return created;
    } catch (error) {
      this.logService.error('Failed to create project', error, 'ProjectService');
      this.errorState.set('Could not create your project right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async updateProject(projectId: string, payload: UpdateProjectDto) {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);

    try {
      const updated = await firstValueFrom(
        this.http.patch<Project>(`${this.baseUrl}/projects/${projectId}`, payload, {
          withCredentials: true,
        }),
      );
      this.refresh();
      return updated;
    } catch (error) {
      this.logService.error('Failed to update project', error, 'ProjectService');
      this.errorState.set('Could not update your project right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async getProjectsByStatus(
    status: 'active' | 'completed' | 'archived' | 'all',
  ): Promise<Project[]> {
    return await firstValueFrom(
      this.http.get<Project[]>(`${this.baseUrl}/projects?status=${status}`, {
        withCredentials: true,
      }),
    );
  }

  async completeProject(projectId: string): Promise<Project> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      const completed = await firstValueFrom(
        this.http.post<Project>(
          `${this.baseUrl}/projects/${projectId}/complete`,
          {},
          { withCredentials: true },
        ),
      );
      this.refresh();
      return completed;
    } catch (error) {
      this.logService.error('Failed to complete project', error, 'ProjectService');
      this.errorState.set('Could not complete your project right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async reopenProject(projectId: string): Promise<Project> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      const reopened = await firstValueFrom(
        this.http.post<Project>(
          `${this.baseUrl}/projects/${projectId}/reopen`,
          {},
          { withCredentials: true },
        ),
      );
      this.refresh();
      return reopened;
    } catch (error) {
      this.logService.error('Failed to reopen project', error, 'ProjectService');
      this.errorState.set('Could not reopen your project right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async archiveProject(projectId: string): Promise<Project> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      const archived = await firstValueFrom(
        this.http.post<Project>(
          `${this.baseUrl}/projects/${projectId}/archive`,
          {},
          { withCredentials: true },
        ),
      );
      this.refresh();
      return archived;
    } catch (error) {
      this.logService.error('Failed to archive project', error, 'ProjectService');
      this.errorState.set('Could not archive your project right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async unarchiveProject(projectId: string): Promise<Project> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      const unarchived = await firstValueFrom(
        this.http.post<Project>(
          `${this.baseUrl}/projects/${projectId}/unarchive`,
          {},
          { withCredentials: true },
        ),
      );
      this.refresh();
      return unarchived;
    } catch (error) {
      this.logService.error('Failed to unarchive project', error, 'ProjectService');
      this.errorState.set('Could not unarchive your project right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async reorderProjects(ids: string[]): Promise<Project[]> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      const reordered = await firstValueFrom(
        this.http.patch<Project[]>(
          `${this.baseUrl}/projects/reorder`,
          { ids },
          { withCredentials: true },
        ),
      );
      this.refresh();
      return reordered;
    } catch (error) {
      this.logService.error('Failed to reorder projects', error, 'ProjectService');
      this.errorState.set('Could not reorder your projects right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  async deleteProject(projectId: string, keepTasks: boolean = true): Promise<void> {
    this.savingCount.update((count) => count + 1);
    this.errorState.set(null);
    try {
      await firstValueFrom(
        this.http.delete<{ success: boolean }>(
          `${this.baseUrl}/projects/${projectId}?keepTasks=${keepTasks}`,
          { withCredentials: true },
        ),
      );
      this.refresh();
    } catch (error) {
      this.logService.error('Failed to delete project', error, 'ProjectService');
      this.errorState.set('Could not delete your project right now.');
      throw error;
    } finally {
      this.savingCount.update((count) => count - 1);
    }
  }

  refresh() {
    this.refreshState.update((value) => value + 1);
  }
}
