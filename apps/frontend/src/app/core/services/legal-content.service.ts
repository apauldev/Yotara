import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface LegalDocument {
  type: 'terms-of-service';
  version: string;
  effectiveDate: string;
  title: string;
  content: string;
}

function isLegalDocument(value: unknown): value is LegalDocument {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const document = value as Record<string, unknown>;
  return (
    document['type'] === 'terms-of-service' &&
    typeof document['version'] === 'string' &&
    document['version'].trim().length > 0 &&
    typeof document['effectiveDate'] === 'string' &&
    document['effectiveDate'].trim().length > 0 &&
    typeof document['title'] === 'string' &&
    document['title'].trim().length > 0 &&
    typeof document['content'] === 'string' &&
    document['content'].trim().length > 0
  );
}

@Injectable({ providedIn: 'root' })
export class LegalContentService {
  private readonly http = inject(HttpClient);
  private readonly documentState = signal<LegalDocument | null>(null);
  private readonly loadedState = signal(false);
  private loadPromise: Promise<void> | null = null;

  readonly document = this.documentState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();
  readonly configured = computed(() => this.loadedState() && this.documentState() !== null);

  load(): Promise<void> {
    if (this.loadedState()) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = firstValueFrom(
      this.http.get<unknown>('/legal/terms.json', {
        headers: {
          Accept: 'application/json',
          'X-Skip-Loading': 'true',
          'X-Skip-Error': 'true',
        },
      }),
    )
      .then((value) => {
        this.documentState.set(isLegalDocument(value) ? value : null);
      })
      .catch(() => {
        this.documentState.set(null);
      })
      .finally(() => {
        this.loadedState.set(true);
        this.loadPromise = null;
      });

    return this.loadPromise;
  }
}
