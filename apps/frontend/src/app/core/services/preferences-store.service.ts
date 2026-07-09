import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PreferencesStore {
  readonly SKIP_COMPLETE_KEY = 'yotara_skipCompleteConfirm';
  readonly INSIGHT_DISMISSED_KEY = 'yotara_insightDismissed';
  readonly ONBOARDING_COMPLETED = 'onboardingCompleted';
  readonly WORKSPACE_TYPE = 'workspaceType';
  readonly DISMISSED_SUGGESTIONS_KEY = 'yotara_dismissedSuggestions';
  readonly SUGGESTIONS_ENABLED_KEY = 'yotara_suggestionsEnabled';

  getSkipCompleteConfirm(): boolean {
    return localStorage.getItem(this.SKIP_COMPLETE_KEY) === 'true';
  }

  setSkipCompleteConfirm(value: boolean): void {
    localStorage.setItem(this.SKIP_COMPLETE_KEY, value ? 'true' : 'false');
  }

  isInsightDismissed(): boolean {
    return localStorage.getItem(this.INSIGHT_DISMISSED_KEY) === 'true';
  }

  setInsightDismissed(value: boolean): void {
    localStorage.setItem(this.INSIGHT_DISMISSED_KEY, value ? 'true' : 'false');
  }

  isOnboardingCompleted(): boolean {
    return localStorage.getItem(this.ONBOARDING_COMPLETED) === 'true';
  }

  setOnboardingCompleted(): void {
    localStorage.setItem(this.ONBOARDING_COMPLETED, 'true');
  }

  getWorkspaceType(): string {
    return localStorage.getItem(this.WORKSPACE_TYPE) ?? '';
  }

  setWorkspaceType(value: string): void {
    localStorage.setItem(this.WORKSPACE_TYPE, value);
  }

  getDismissedSuggestions(): string[] {
    try {
      const raw = localStorage.getItem(this.DISMISSED_SUGGESTIONS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private saveDismissedSuggestions(ids: string[]): void {
    localStorage.setItem(this.DISMISSED_SUGGESTIONS_KEY, JSON.stringify(ids));
  }

  isSuggestionDismissed(id: string): boolean {
    return this.getDismissedSuggestions().includes(id);
  }

  dismissSuggestion(id: string): void {
    const dismissed = this.getDismissedSuggestions();
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      this.saveDismissedSuggestions(dismissed);
    }
  }

  resetAllSuggestions(): void {
    this.saveDismissedSuggestions([]);
  }

  areSuggestionsEnabled(): boolean {
    return localStorage.getItem(this.SUGGESTIONS_ENABLED_KEY) !== 'false';
  }

  setSuggestionsEnabled(enabled: boolean): void {
    localStorage.setItem(this.SUGGESTIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  }
}
