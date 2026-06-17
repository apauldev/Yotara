import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PreferencesStore {
  private static readonly SKIP_COMPLETE_KEY = 'yotara_skipCompleteConfirm';
  private static readonly INSIGHT_DISMISSED_KEY = 'yotara_insightDismissed';
  private static readonly LOGIN_TIP_DISMISSED_KEY = 'yotara_loginTipDismissed';
  private static readonly ONBOARDING_COMPLETED_KEY = 'onboardingCompleted';
  private static readonly WORKSPACE_TYPE_KEY = 'workspaceType';

  readonly skipCompleteConfirm = signal(
    localStorage.getItem(PreferencesStore.SKIP_COMPLETE_KEY) === 'true',
  );
  readonly insightDismissed = signal(
    localStorage.getItem(PreferencesStore.INSIGHT_DISMISSED_KEY) === 'true',
  );
  readonly loginTipDismissed = signal(
    localStorage.getItem(PreferencesStore.LOGIN_TIP_DISMISSED_KEY) === 'true' ||
      sessionStorage.getItem(PreferencesStore.LOGIN_TIP_DISMISSED_KEY) === 'true',
  );
  readonly onboardingCompleted = signal(
    localStorage.getItem(PreferencesStore.ONBOARDING_COMPLETED_KEY) === 'true',
  );
  readonly workspaceType = signal(localStorage.getItem(PreferencesStore.WORKSPACE_TYPE_KEY) ?? '');

  setSkipCompleteConfirm(value: boolean): void {
    this.skipCompleteConfirm.set(value);
    localStorage.setItem(PreferencesStore.SKIP_COMPLETE_KEY, value ? 'true' : 'false');
  }

  setInsightDismissed(value: boolean): void {
    this.insightDismissed.set(value);
    localStorage.setItem(PreferencesStore.INSIGHT_DISMISSED_KEY, value ? 'true' : 'false');
  }

  setLoginTipDismissed(value: boolean, permanent = false): void {
    this.loginTipDismissed.set(value);
    if (permanent) {
      localStorage.setItem(PreferencesStore.LOGIN_TIP_DISMISSED_KEY, value ? 'true' : 'false');
      // Also clear session storage to keep it clean if permanently dismissed
      sessionStorage.removeItem(PreferencesStore.LOGIN_TIP_DISMISSED_KEY);
    } else {
      sessionStorage.setItem(PreferencesStore.LOGIN_TIP_DISMISSED_KEY, value ? 'true' : 'false');
    }
  }

  setOnboardingCompleted(value = true): void {
    this.onboardingCompleted.set(value);
    localStorage.setItem(PreferencesStore.ONBOARDING_COMPLETED_KEY, value ? 'true' : 'false');
  }

  setWorkspaceType(value: string): void {
    this.workspaceType.set(value);
    localStorage.setItem(PreferencesStore.WORKSPACE_TYPE_KEY, value);
  }
}
