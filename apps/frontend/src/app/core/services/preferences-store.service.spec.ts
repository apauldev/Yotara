import { TestBed } from '@angular/core/testing';
import { PreferencesStore } from './preferences-store.service';

describe('PreferencesStore', () => {
  let store: PreferencesStore;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    store = TestBed.inject(PreferencesStore);
  });

  it('defaults skipCompleteConfirm to false', () => {
    expect(store.skipCompleteConfirm()).toBeFalse();
  });

  it('setSkipCompleteConfirm updates signal and localStorage', () => {
    store.setSkipCompleteConfirm(true);
    expect(store.skipCompleteConfirm()).toBeTrue();
    expect(localStorage.getItem('yotara_skipCompleteConfirm')).toBe('true');

    store.setSkipCompleteConfirm(false);
    expect(store.skipCompleteConfirm()).toBeFalse();
    expect(localStorage.getItem('yotara_skipCompleteConfirm')).toBe('false');
  });

  it('defaults insightDismissed to false', () => {
    expect(store.insightDismissed()).toBeFalse();
  });

  it('setInsightDismissed updates signal and localStorage', () => {
    store.setInsightDismissed(true);
    expect(store.insightDismissed()).toBeTrue();
    expect(localStorage.getItem('yotara_insightDismissed')).toBe('true');

    store.setInsightDismissed(false);
    expect(store.insightDismissed()).toBeFalse();
    expect(localStorage.getItem('yotara_insightDismissed')).toBe('false');
  });

  it('defaults loginTipDismissed to false', () => {
    expect(store.loginTipDismissed()).toBeFalse();
  });

  it('setLoginTipDismissed updates signal and sessionStorage by default', () => {
    store.setLoginTipDismissed(true);
    expect(store.loginTipDismissed()).toBeTrue();
    expect(sessionStorage.getItem('yotara_loginTipDismissed')).toBe('true');
    expect(localStorage.getItem('yotara_loginTipDismissed')).toBeNull();

    store.setLoginTipDismissed(false);
    expect(store.loginTipDismissed()).toBeFalse();
    expect(sessionStorage.getItem('yotara_loginTipDismissed')).toBe('false');
  });

  it('setLoginTipDismissed updates signal and localStorage when permanent is true', () => {
    store.setLoginTipDismissed(true, true);
    expect(store.loginTipDismissed()).toBeTrue();
    expect(localStorage.getItem('yotara_loginTipDismissed')).toBe('true');
    expect(sessionStorage.getItem('yotara_loginTipDismissed')).toBeNull();

    store.setLoginTipDismissed(false, true);
    expect(store.loginTipDismissed()).toBeFalse();
    expect(localStorage.getItem('yotara_loginTipDismissed')).toBe('false');
  });

  it('onboardingCompleted defaults to false', () => {
    expect(store.onboardingCompleted()).toBeFalse();
  });

  it('setOnboardingCompleted persists to localStorage', () => {
    store.setOnboardingCompleted();
    expect(store.onboardingCompleted()).toBeTrue();
    expect(localStorage.getItem('onboardingCompleted')).toBe('true');
  });

  it('workspaceType defaults to empty string', () => {
    expect(store.workspaceType()).toBe('');
  });

  it('setWorkspaceType persists to localStorage', () => {
    store.setWorkspaceType('personal');
    expect(store.workspaceType()).toBe('personal');
    expect(localStorage.getItem('workspaceType')).toBe('personal');
  });

  it('initializes from existing localStorage values', () => {
    localStorage.setItem('yotara_skipCompleteConfirm', 'true');
    localStorage.setItem('yotara_insightDismissed', 'true');
    localStorage.setItem('yotara_loginTipDismissed', 'true');
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('workspaceType', 'personal');

    TestBed.resetTestingModule();
    store = TestBed.inject(PreferencesStore);

    expect(store.skipCompleteConfirm()).toBeTrue();
    expect(store.insightDismissed()).toBeTrue();
    expect(store.loginTipDismissed()).toBeTrue();
    expect(store.onboardingCompleted()).toBeTrue();
    expect(store.workspaceType()).toBe('personal');
  });

  it('initializes from sessionStorage for loginTipDismissed', () => {
    sessionStorage.setItem('yotara_loginTipDismissed', 'true');

    TestBed.resetTestingModule();
    store = TestBed.inject(PreferencesStore);

    expect(store.loginTipDismissed()).toBeTrue();
  });
});
