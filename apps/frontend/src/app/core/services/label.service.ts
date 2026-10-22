import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { CreateLabelDto, Label, LabelMergeResult, UpdateLabelDto } from '@yotara/shared';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  filter,
  finalize,
  firstValueFrom,
  map,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStateService } from './auth-state.service';
import { LogService } from './log.service';

interface LabelRefreshEvent {
  version: number;
  labels: Label[];
}

@Injectable({ providedIn: 'root' })
export class LabelService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);
  private readonly logService = inject(LogService);
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly refreshState = signal(0);
  private readonly refreshCompleted = new Subject<LabelRefreshEvent>();
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly labels = toSignal(
    combineLatest([
      toObservable(this.authState.currentUserId).pipe(distinctUntilChanged()),
      toObservable(this.authState.onboardingCompleted).pipe(distinctUntilChanged()),
      toObservable(this.refreshState),
    ]).pipe(
      switchMap(([userId, onboardingCompleted, version]) => {
        // Labels are seeded by the onboarding PATCH. Waiting for the flag
        // avoids caching the empty pre-onboarding list for the whole session.
        if (!userId || !onboardingCompleted) {
          this.errorState.set(null);
          return of({ version, labels: [] as Label[] });
        }

        this.loadingState.set(true);
        this.errorState.set(null);
        return this.http.get<Label[]>(`${this.baseUrl}/labels`, { withCredentials: true }).pipe(
          map((labels) => ({ version, labels })),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
              return of({ version, labels: [] as Label[] });
            }

            this.logService.error('Failed to load labels', error, 'LabelService');
            this.errorState.set('Could not load labels right now.');
            return of({ version, labels: [] as Label[] });
          }),
          finalize(() => this.loadingState.set(false)),
        );
      }),
      map(({ version, labels }) => {
        const sorted = [...labels].sort(
          (left, right) =>
            Number(right.pinned) - Number(left.pinned) || left.name.localeCompare(right.name),
        );
        this.refreshCompleted.next({ version, labels: sorted });
        return sorted;
      }),
    ),
    { initialValue: [] as Label[] },
  );

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly count = computed(() => this.labels().length);
  readonly version = this.refreshState.asReadonly();

  /** Live label-ID → Label map; consumers skip unknown labels instead of rendering raw IDs. */
  readonly labelById = computed(() => new Map(this.labels().map((label) => [label.id, label])));

  refresh() {
    this.refreshState.update((value) => value + 1);
  }

  /**
   * Requests a refresh and resolves with the label list from the resulting
   * request. Use when the next step depends on the refreshed list, such as
   * selecting a label returned by a duplicate-name conflict.
   */
  async refreshAndWait(): Promise<Label[]> {
    const targetVersion = this.refreshState() + 1;
    const refreshed = firstValueFrom(
      this.refreshCompleted.pipe(
        filter((event) => event.version >= targetVersion),
        map((event) => event.labels),
      ),
    );
    this.refresh();
    return refreshed;
  }

  async createLabel(payload: CreateLabelDto) {
    const created = await firstValueFrom(
      this.http.post<Label>(`${this.baseUrl}/labels`, payload, { withCredentials: true }),
    );
    this.refresh();
    return created;
  }

  async updateLabel(labelId: string, payload: UpdateLabelDto) {
    const updated = await firstValueFrom(
      this.http.patch<Label>(`${this.baseUrl}/labels/${labelId}`, payload, {
        withCredentials: true,
      }),
    );
    this.refresh();
    return updated;
  }

  async deleteLabel(labelId: string) {
    await firstValueFrom(
      this.http.delete<{ ok: true }>(`${this.baseUrl}/labels/${labelId}`, {
        withCredentials: true,
      }),
    );
    this.refresh();
  }

  /**
   * Move every task association from one label to another and delete the
   * source. The API returns how many source associations were moved.
   */
  async mergeLabel(sourceId: string, targetId: string): Promise<LabelMergeResult> {
    const result = await firstValueFrom(
      this.http.post<LabelMergeResult>(
        `${this.baseUrl}/labels/${sourceId}/merge`,
        { targetId },
        { withCredentials: true },
      ),
    );
    this.refresh();
    return result;
  }

  /**
   * Deletes a label and resolves with the label list fetched after the delete,
   * so the caller can pick the "next" label from server truth rather than the
   * locally stale signal (see the Labels page delete flow). The signal itself
   * refreshes in parallel via the regular refresh() bump.
   */
  async deleteLabelAndList(labelId: string): Promise<Label[]> {
    await this.deleteLabel(labelId);
    return await firstValueFrom(
      this.http.get<Label[]>(`${this.baseUrl}/labels`, { withCredentials: true }),
    );
  }
}
