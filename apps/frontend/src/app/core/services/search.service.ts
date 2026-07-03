import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import type { SearchResponse, SearchTaskResult } from '@yotara/shared';
import { environment } from '../../../environments/environment';

export type SearchTab = 'all' | 'tasks' | 'projects' | 'labels';

export interface SearchArchiveResults {
  tasks: SearchTaskResult[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  search(query: string): Observable<SearchResponse> {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return of({
        query: query.trim(),
        normalizedQuery,
        tasks: [],
        projects: [],
        labels: [],
      });
    }

    return this.http.get<SearchResponse>(`${this.baseUrl}/tasks/search`, {
      params: { q: query },
      withCredentials: true,
    });
  }

  searchArchive(query: string): Observable<SearchArchiveResults> {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return of({ tasks: [], total: 0 });
    }

    return this.http
      .get<SearchResponse>(`${this.baseUrl}/tasks/search`, {
        params: { q: query, completed: 'true', pageSize: '100' },
        withCredentials: true,
      })
      .pipe(map((response) => ({ tasks: response.tasks, total: response.tasks.length })));
  }

  searchAllTasks(query: string): Observable<SearchTaskResult[]> {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) {
      return of([]);
    }

    return this.fetchAllTaskPages(query).pipe(
      map((responses) => responses.flatMap((r) => r.tasks)),
    );
  }

  private fetchAllTaskPages(query: string): Observable<SearchResponse[]> {
    const pageSize = 100;

    const fetchPage = (page: number): Observable<SearchResponse[]> => {
      return this.http
        .get<SearchResponse>(`${this.baseUrl}/tasks/search`, {
          params: { q: query, page: page.toString(), pageSize: pageSize.toString() },
          withCredentials: true,
        })
        .pipe(
          switchMap((response) => {
            if (response.tasks.length < pageSize) {
              return of([response]);
            }
            return fetchPage(page + 1).pipe(map((rest) => [response, ...rest]));
          }),
        );
    };

    return fetchPage(1);
  }
}

function normalize(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}
