import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CreateLabelDto, Label, UpdateLabelDto } from '@yotara/shared';
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
export class LabelService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly refreshState = signal(0);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly labels = toSignal(
    combineLatest([
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([userId]) => {
        if (!userId) {
          this.errorState.set(null);
          return of([] as Label[]);
        }

        this.loadingState.set(true);
        this.errorState.set(null);
        return this.http.get<Label[]>(`${this.baseUrl}/labels`, { withCredentials: true }).pipe(
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
              return of([] as Label[]);
            }

            console.error('Failed to load labels', error);
            this.errorState.set('Could not load labels right now.');
            return of([] as Label[]);
          }),
          finalize(() => this.loadingState.set(false)),
        );
      }),
      map((labels) => [...labels].sort((left, right) => left.name.localeCompare(right.name))),
    ),
    { initialValue: [] as Label[] },
  );

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly count = computed(() => this.labels().length);

  refreshLabels() {
    this.refreshState.update((value) => value + 1);
  }

  async createLabel(payload: CreateLabelDto) {
    const created = await firstValueFrom(
      this.http.post<Label>(`${this.baseUrl}/labels`, payload, { withCredentials: true }),
    );
    this.refreshLabels();
    return created;
  }

  async updateLabel(labelId: string, payload: UpdateLabelDto) {
    const updated = await firstValueFrom(
      this.http.patch<Label>(`${this.baseUrl}/labels/${labelId}`, payload, {
        withCredentials: true,
      }),
    );
    this.refreshLabels();
    return updated;
  }

  async deleteLabel(labelId: string) {
    await firstValueFrom(
      this.http.delete<{ ok: true }>(`${this.baseUrl}/labels/${labelId}`, {
        withCredentials: true,
      }),
    );
    this.refreshLabels();
  }
}
