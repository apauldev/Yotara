import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class PreferencesStore {
  private static readonly SKIP_COMPLETE_KEY = 'yotara_skipCompleteConfirm';
  private static readonly ACTION_NOTIFICATIONS_KEY = 'yotara_actionNotifications';
  private static readonly DESKTOP_NOTIFICATIONS_KEY = 'yotara_desktopNotifications';
  private static readonly SHOW_DONE_CALENDAR_KEY = 'yotara_showDoneCalendar';
  private static readonly SHOW_METADATA_CALENDAR_KEY = 'yotara_showMetadataCalendar';
  private static readonly INSIGHT_DISMISSED_KEY = 'yotara_insightDismissed';
  private static readonly LOGIN_TIP_DISMISSED_KEY = 'yotara_loginTipDismissed';
  private static readonly ONBOARDING_COMPLETED_KEY = 'onboardingCompleted';
  private static readonly WORKSPACE_TYPE_KEY = 'workspaceType';
  private static readonly SHOW_LABEL_NAMES_KEY = 'yotara_showLabelNames';
  private static readonly COLOR_FIRST_LABELS_KEY = 'yotara_colorFirstLabels';

  readonly skipCompleteConfirm = signal(
    localStorage.getItem(PreferencesStore.SKIP_COMPLETE_KEY) === 'true',
  );
  readonly actionNotifications = signal(
    localStorage.getItem(PreferencesStore.ACTION_NOTIFICATIONS_KEY) !== 'false',
  );
  readonly desktopNotifications = signal(
    localStorage.getItem(PreferencesStore.DESKTOP_NOTIFICATIONS_KEY) === 'true',
  );
  readonly showDoneCalendar = signal(
    localStorage.getItem(PreferencesStore.SHOW_DONE_CALENDAR_KEY) === 'true',
  );
  readonly showMetadataCalendar = signal(
    localStorage.getItem(PreferencesStore.SHOW_METADATA_CALENDAR_KEY) === 'true',
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
  readonly showLabelNames = signal(
    localStorage.getItem(PreferencesStore.SHOW_LABEL_NAMES_KEY) !== 'false',
  );
  readonly colorFirstLabels = signal(
    localStorage.getItem(PreferencesStore.COLOR_FIRST_LABELS_KEY) === 'true',
  );

  setSkipCompleteConfirm(value: boolean): void {
    this.skipCompleteConfirm.set(value);
    localStorage.setItem(PreferencesStore.SKIP_COMPLETE_KEY, value ? 'true' : 'false');
  }

  setActionNotifications(value: boolean): void {
    this.actionNotifications.set(value);
    localStorage.setItem(PreferencesStore.ACTION_NOTIFICATIONS_KEY, value ? 'true' : 'false');
  }

  setDesktopNotifications(value: boolean): void {
    this.desktopNotifications.set(value);
    localStorage.setItem(PreferencesStore.DESKTOP_NOTIFICATIONS_KEY, value ? 'true' : 'false');
  }

  setShowDoneCalendar(value: boolean): void {
    this.showDoneCalendar.set(value);
    localStorage.setItem(PreferencesStore.SHOW_DONE_CALENDAR_KEY, value ? 'true' : 'false');
  }

  setShowMetadataCalendar(value: boolean): void {
    this.showMetadataCalendar.set(value);
    localStorage.setItem(PreferencesStore.SHOW_METADATA_CALENDAR_KEY, value ? 'true' : 'false');
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

  setShowLabelNames(value: boolean): void {
    this.showLabelNames.set(value);
    localStorage.setItem(PreferencesStore.SHOW_LABEL_NAMES_KEY, value ? 'true' : 'false');
  }

  setColorFirstLabels(value: boolean): void {
    this.colorFirstLabels.set(value);
    localStorage.setItem(PreferencesStore.COLOR_FIRST_LABELS_KEY, value ? 'true' : 'false');
  }
}
