import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PreferencesStore {
  readonly SKIP_COMPLETE_KEY = 'yotara_skipCompleteConfirm';
  readonly INSIGHT_DISMISSED_KEY = 'yotara_insightDismissed';
  readonly LOGIN_TIP_DISMISSED = 'yotara_loginTipDismissed';
  readonly ONBOARDING_COMPLETED = 'onboardingCompleted';
  readonly WORKSPACE_TYPE = 'workspaceType';

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

  isLoginTipDismissed(): boolean {
    return localStorage.getItem(this.LOGIN_TIP_DISMISSED) === 'true';
  }

  setLoginTipDismissed(value: boolean): void {
    localStorage.setItem(this.LOGIN_TIP_DISMISSED, value ? 'true' : 'false');
  }
}
