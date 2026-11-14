import { Injectable, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  type CalendarEventDto,
  type CalendarSource,
  type CalendarSyncStatus,
  type CreateCalendarSourceDto,
  type UpdateCalendarSourceDto,
} from '@yotara/shared';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getUserTimezone } from '../../shared/utils/timezone';
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly authState = inject(AuthStateService);
  private eventRequestId = 0;
  private ownerId: string | null = null;

  readonly sources = signal<CalendarSource[]>([]);
  readonly events = signal<CalendarEventDto[]>([]);
  readonly loadingEvents = signal(false);

  constructor() {
    effect(() => {
      const userId = this.authState.currentUserId();
      if (userId !== this.ownerId) {
        this.ownerId = userId;
        this.eventRequestId += 1;
        this.sources.set([]);
        this.events.set([]);
        this.loadingEvents.set(false);
      }
    });
  }

  async loadSources(): Promise<CalendarSource[]> {
    const sources = await firstValueFrom(
      this.http.get<CalendarSource[]>(`${this.baseUrl}/calendar/sources`, {
        withCredentials: true,
      }),
    );
    this.sources.set(sources);
    return sources;
  }

  async loadEvents(from: string, to: string): Promise<CalendarEventDto[]> {
    const requestId = ++this.eventRequestId;
    this.loadingEvents.set(true);
    const params = new HttpParams().set('from', from).set('to', to).set('tz', getUserTimezone());
    try {
      const events = await firstValueFrom(
        this.http.get<CalendarEventDto[]>(`${this.baseUrl}/calendar/events`, {
          params,
          withCredentials: true,
        }),
      );
      if (requestId === this.eventRequestId) this.events.set(events);
      return events;
    } finally {
      if (requestId === this.eventRequestId) this.loadingEvents.set(false);
    }
  }

  async createSource(body: CreateCalendarSourceDto): Promise<CalendarSource> {
    const source = await firstValueFrom(
      this.http.post<CalendarSource>(`${this.baseUrl}/calendar/sources`, body, {
        withCredentials: true,
      }),
    );
    this.sources.update((sources) => [...sources, source]);
    return source;
  }

  async updateSource(id: string, body: UpdateCalendarSourceDto): Promise<CalendarSource> {
    const source = await firstValueFrom(
      this.http.patch<CalendarSource>(`${this.baseUrl}/calendar/sources/${id}`, body, {
        withCredentials: true,
      }),
    );
    this.sources.update((sources) => sources.map((entry) => (entry.id === id ? source : entry)));
    if (!source.enabled) {
      this.events.update((events) => events.filter((event) => event.sourceId !== id));
    }
    return source;
  }

  async refreshSource(id: string): Promise<CalendarSyncStatus> {
    const status = await firstValueFrom(
      this.http.post<CalendarSyncStatus>(
        `${this.baseUrl}/calendar/sources/${id}/refresh`,
        {},
        {
          withCredentials: true,
        },
      ),
    );
    await this.loadSources();
    return status;
  }

  async deleteSource(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<{ ok: boolean }>(`${this.baseUrl}/calendar/sources/${id}`, {
        withCredentials: true,
      }),
    );
    this.sources.update((sources) => sources.filter((source) => source.id !== id));
    this.events.update((events) => events.filter((event) => event.sourceId !== id));
  }
}
