import { Injectable, computed, signal } from '@angular/core';
import { AuthService } from '@yotara/shared';

type SessionResponse = Awaited<ReturnType<typeof AuthService.getSession>>;
type SessionData = NonNullable<SessionResponse['data']>;
type ProfileUser = Awaited<ReturnType<typeof AuthService.getProfile>>['user'];

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private sessionState = signal<SessionData['session'] | null>(null);
  private userState = signal<ProfileUser | null>(null);
  private initializedState = signal(false);
  private loadingState = signal(false);
  private initPromise: Promise<SessionResponse> | null = null;

  readonly session = this.sessionState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly initialized = this.initializedState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly isAuthenticated = computed(() => !!this.sessionState());
  readonly currentUserId = computed(
    () => this.userState()?.id ?? this.sessionState()?.userId ?? null,
  );
  readonly needsOnboarding = computed(
    () => this.isAuthenticated() && !this.userState()?.onboardingCompleted,
  );

  async initialize() {
    if (this.initializedState()) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.refreshSession().finally(() => {
      this.initPromise = null;
    });

    try {
      return await this.initPromise;
    } catch (error) {
      console.error('Initial session refresh failed', error);
      this.sessionState.set(null);
      this.userState.set(null);
      return null;
    }
  }

  async refreshSession() {
    this.loadingState.set(true);

    try {
      const result = await AuthService.getSession();
      await this.applySessionResult(result);
      return result;
    } finally {
      this.initializedState.set(true);
      this.loadingState.set(false);
    }
  }

  async signIn(email: string, password: string) {
    this.loadingState.set(true);

    try {
      const result = await AuthService.signIn(email, password);
      if (!result.error) {
        await this.refreshSession();
      }
      return result;
    } finally {
      this.loadingState.set(false);
    }
  }

  async signUp(email: string, password: string, name: string) {
    this.loadingState.set(true);

    try {
      const result = await AuthService.signUp(email, password, name);
      if (!result.error) {
        await this.refreshSession();
      }
      return result;
    } finally {
      this.loadingState.set(false);
    }
  }

  async signOut() {
    this.loadingState.set(true);

    try {
      const result = await AuthService.signOut();
      this.sessionState.set(null);
      this.userState.set(null);
      this.initializedState.set(true);
      return result;
    } finally {
      this.loadingState.set(false);
    }
  }

  async completeOnboarding(workspaceMode: 'personal' | 'team') {
    this.loadingState.set(true);

    try {
      const result = await AuthService.completeOnboarding(workspaceMode);
      this.userState.set(result.user);
      return result;
    } finally {
      this.loadingState.set(false);
    }
  }

  getPostAuthRedirectUrl() {
    if (this.needsOnboarding()) {
      return '/onboarding';
    }

    return this.userState()?.workspaceMode === 'personal' ? '/inbox' : '/dashboard';
  }

  private async applySessionResult(result: SessionResponse | null | undefined) {
    const session = result?.data?.session ?? null;
    this.sessionState.set(session);

    if (!session) {
      this.userState.set(null);
      return;
    }

    const profile = await AuthService.getProfile();
    this.userState.set(profile.user);
  }
}
