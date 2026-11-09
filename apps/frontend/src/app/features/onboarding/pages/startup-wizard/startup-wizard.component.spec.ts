import { signal, type WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, type ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import type { Theme } from '../../../../core/constants/themes';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { LogService } from '../../../../core/services/log.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PreferencesStore } from '../../../../core/services/preferences-store.service';
import { TaskService } from '../../../../core/services/task.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { StartupWizardComponent } from './startup-wizard.component';

interface MockUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  workspaceMode?: 'personal' | 'team' | null;
  onboardingCompleted?: boolean;
  archiveAutoDelete?: boolean;
  captureBehavior?: 'quick' | 'capture' | null;
}

interface MockDraft {
  step?: string;
  theme?: string;
  showLabelNames?: boolean;
  colorFirstLabels?: boolean;
  captureBehavior?: 'quick' | 'capture';
  archiveAutoDelete?: boolean;
  askBeforeComplete?: boolean;
  actionNotifications?: boolean;
  desktopNotifications?: boolean;
  dailyInsights?: boolean;
  showLoginTips?: boolean;
}

const DRAFT_KEY = 'yotara_wizard_draft:user-1';

describe('StartupWizardComponent', () => {
  let fixture: ComponentFixture<StartupWizardComponent>;
  let component: StartupWizardComponent;
  let router: jasmine.SpyObj<Router>;
  let routeParams: BehaviorSubject<ParamMap>;
  let userSignal: WritableSignal<MockUser | null>;
  let userIdSignal: WritableSignal<string | null>;
  let authState: {
    user: WritableSignal<MockUser | null>;
    currentUserId: WritableSignal<string | null>;
    completeOnboarding: jasmine.Spy;
    signOut: jasmine.Spy;
    getPostAuthRedirectUrl: jasmine.Spy;
  };
  let themeSignal: WritableSignal<Theme>;
  let themeService: { theme: WritableSignal<Theme>; setTheme: jasmine.Spy };
  let permissionSignal: WritableSignal<NotificationPermission>;
  let notificationService: {
    isSupported: boolean;
    permission: WritableSignal<NotificationPermission>;
    requestPermission: jasmine.Spy;
  };
  let logService: { error: jasmine.Spy; warn: jasmine.Spy };
  let taskService: { createTask: jasmine.Spy };
  let preferences: PreferencesStore;

  function checkbox(checked: boolean): Event {
    return { target: { checked } } as unknown as Event;
  }

  function select(value: string): Event {
    return { target: { value } } as unknown as Event;
  }

  function input(value: string): Event {
    return { target: { value } } as unknown as Event;
  }

  async function create(
    options: {
      query?: Record<string, string>;
      storedDraft?: { savedAt: number; draft: MockDraft };
      theme?: Theme;
      user?: Partial<MockUser>;
    } = {},
  ): Promise<void> {
    localStorage.clear();

    if (options.storedDraft) {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          version: 2,
          savedAt: options.storedDraft.savedAt,
          draft: options.storedDraft.draft,
        }),
      );
    }

    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl']);
    router.navigate.and.resolveTo(true);
    router.navigateByUrl.and.resolveTo(true);

    routeParams = new BehaviorSubject<ParamMap>(convertToParamMap(options.query ?? {}));
    const route = {
      snapshot: { queryParamMap: routeParams.value },
      queryParamMap: routeParams.asObservable(),
    };

    userSignal = signal<MockUser | null>({
      id: 'user-1',
      name: 'Jordan Doe',
      email: 'jordan@example.com',
      image: null,
      archiveAutoDelete: true,
      captureBehavior: 'quick',
      ...options.user,
    });
    userIdSignal = signal<string | null>('user-1');
    authState = {
      user: userSignal,
      currentUserId: userIdSignal,
      completeOnboarding: jasmine.createSpy('completeOnboarding').and.resolveTo(undefined),
      signOut: jasmine.createSpy('signOut').and.resolveTo(undefined),
      getPostAuthRedirectUrl: jasmine.createSpy('getPostAuthRedirectUrl').and.returnValue('/inbox'),
    };

    themeSignal = signal<Theme>(options.theme ?? 'light-forest');
    themeService = {
      theme: themeSignal,
      setTheme: jasmine
        .createSpy('setTheme')
        .and.callFake((theme: Theme) => themeSignal.set(theme)),
    };

    permissionSignal = signal<NotificationPermission>('granted');
    notificationService = {
      isSupported: true,
      permission: permissionSignal,
      requestPermission: jasmine.createSpy('requestPermission').and.resolveTo('granted'),
    };

    logService = {
      error: jasmine.createSpy('error'),
      warn: jasmine.createSpy('warn'),
    };

    taskService = {
      createTask: jasmine.createSpy('createTask').and.resolveTo({}),
    };

    await TestBed.configureTestingModule({
      imports: [StartupWizardComponent],
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
        { provide: ThemeService, useValue: themeService },
        { provide: NotificationService, useValue: notificationService },
        { provide: LogService, useValue: logService },
        { provide: TaskService, useValue: taskService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StartupWizardComponent);
    component = fixture.componentInstance;
    preferences = TestBed.inject(PreferencesStore);
    fixture.detectChanges();
  }

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders the welcome step and a six-step indicator', async () => {
    await create();

    expect(component.steps.length).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('Welcome, Jordan');
    expect(fixture.nativeElement.textContent).toContain('Signed in as jordan@example.com');

    const dots = fixture.nativeElement.querySelectorAll('.progress-dots li');
    expect(dots.length).toBe(6);
    expect(dots[0].getAttribute('aria-current')).toBe('step');
    expect(fixture.nativeElement.querySelector('.sr-only[aria-live="polite"]')).not.toBeNull();
  });

  it('initializes defaults from PreferencesStore, ThemeService, and the user', async () => {
    await create({
      theme: 'coastal-calm',
      user: { archiveAutoDelete: false, captureBehavior: 'capture' },
    });

    expect(component.draft().theme).toBe('coastal-calm');
    expect(component.draft().captureBehavior).toBe('capture');
    expect(component.draft().archiveAutoDelete).toBeFalse();
    expect(component.draft().showLabelNames).toBeTrue();
    expect(component.draft().colorFirstLabels).toBeFalse();
    expect(component.draft().askBeforeComplete).toBeFalse();
    expect(component.draft().dailyInsights).toBeTrue();
    expect(component.draft().showLoginTips).toBeTrue();
    expect(component.draft().starterProjects.length).toBe(7);
    expect(component.draft().starterLabels.length).toBe(6);
    expect(component.draft().starterProjects.every((project) => project.selected)).toBeTrue();
    expect(component.draft().starterLabels.every((label) => label.selected)).toBeTrue();
  });

  it('advances and retreats without losing choices', async () => {
    await create();

    component.selectTheme('dark-forest');
    component.setShowLabelNames(checkbox(false));
    component.goNext();
    component.goNext();

    expect(component.step()).toBe('defaults');
    expect(component.draft().theme).toBe('dark-forest');
    expect(component.draft().showLabelNames).toBeFalse();

    component.goBack();

    expect(component.step()).toBe('look');
    expect(component.draft().theme).toBe('dark-forest');
  });

  it('applies a theme immediately through ThemeService', async () => {
    await create();

    component.selectTheme('ember-hearth');

    expect(themeService.setTheme).toHaveBeenCalledWith('ember-hearth');
    expect(component.draft().theme).toBe('ember-hearth');
  });

  it('completes with one profile patch, writes local choices, and clears the draft', async () => {
    await create();

    component.selectTheme('dark-forest');
    component.setShowLabelNames(checkbox(false));
    component.setColorFirstLabels(checkbox(true));
    component.setCaptureBehavior(select('capture'));
    component.setArchiveAutoDelete(checkbox(false));
    component.setAskBeforeComplete(checkbox(true));
    component.setActionNotifications(checkbox(false));
    await component.setDesktopNotifications(checkbox(true));
    component.setDailyInsights(checkbox(false));
    component.setShowLoginTips(checkbox(false));

    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();

    await component.complete();

    const [mode, payload] = authState.completeOnboarding.calls.mostRecent().args as [
      string,
      {
        archiveAutoDelete?: boolean;
        captureBehavior?: string;
        starterContent: {
          projects: { name: string }[];
          labels: { name: string }[];
        };
        image?: string | null;
      },
    ];
    expect(mode).toBe('personal');
    expect(payload.archiveAutoDelete).toBeFalse();
    expect(payload.captureBehavior).toBe('capture');
    expect(payload.starterContent.projects.length).toBe(7);
    expect(payload.starterContent.labels.length).toBe(6);
    expect(payload.image).toBeUndefined();
    expect(preferences.showLabelNames()).toBeFalse();
    expect(preferences.colorFirstLabels()).toBeTrue();
    expect(preferences.skipCompleteConfirm()).toBeFalse();
    expect(preferences.actionNotifications()).toBeFalse();
    expect(preferences.desktopNotifications()).toBeTrue();
    expect(preferences.insightDismissed()).toBeTrue();
    expect(preferences.loginTipDismissed()).toBeTrue();
    expect(localStorage.getItem('yotara_loginTipDismissed')).toBe('true');
    expect(preferences.workspaceType()).toBe('personal');
    expect(preferences.onboardingCompleted()).toBeTrue();
    expect(themeService.setTheme).toHaveBeenCalledWith('dark-forest');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/inbox');
  });

  it('skip completes with the current draft', async () => {
    await create();
    const completeSpy = spyOn(component, 'complete').and.resolveTo();

    component.skip();

    expect(completeSpy).toHaveBeenCalled();
  });

  it('persists the login-tip choice and still suppresses the first-session tip', async () => {
    await create();

    // Default choice: login tips stay on for later sessions.
    await component.complete();

    expect(preferences.loginTipDismissed()).toBeTrue();
    expect(localStorage.getItem('yotara_loginTipDismissed')).toBe('false');
  });

  it('deselecting a default project removes it from the payload', async () => {
    await create();

    component.toggleProject('Work', checkbox(false));
    await component.complete();

    const [, payload] = authState.completeOnboarding.calls.mostRecent().args as [
      string,
      { starterContent: { projects: { name: string }[] } },
    ];
    expect(payload.starterContent.projects.length).toBe(6);
    expect(payload.starterContent.projects.map((project) => project.name)).not.toContain('Work');
  });

  it('adds custom projects and labels to the payload', async () => {
    await create();

    component.onProjectInput(input('Garden'));
    component.addProject();
    component.onLabelInput(input('Deep Work'));
    component.addLabel();

    expect(component.draft().starterProjects.length).toBe(8);
    expect(component.draft().starterLabels.length).toBe(7);

    await component.complete();

    const [, payload] = authState.completeOnboarding.calls.mostRecent().args as [
      string,
      {
        starterContent: {
          projects: { name: string }[];
          labels: { name: string }[];
        };
      },
    ];
    expect(payload.starterContent.projects.map((project) => project.name)).toContain('Garden');
    expect(payload.starterContent.labels.map((label) => label.name)).toContain('Deep Work');
  });

  it('start empty sends empty starter arrays', async () => {
    await create();

    component.startEmpty();
    await component.complete();

    const [, payload] = authState.completeOnboarding.calls.mostRecent().args as [
      string,
      { starterContent: { projects: unknown[]; labels: unknown[] } },
    ];
    expect(payload.starterContent.projects).toEqual([]);
    expect(payload.starterContent.labels).toEqual([]);
  });

  it('rejects empty and duplicate custom names', async () => {
    await create();

    component.onProjectInput(input('   '));
    component.addProject();
    expect(component.projectAddError()).toBe('Enter a project name.');
    expect(component.draft().starterProjects.length).toBe(7);

    component.onProjectInput(input('work'));
    component.addProject();
    expect(component.projectAddError()).toBe('A project with that name already exists.');
    expect(component.draft().starterProjects.length).toBe(7);

    component.onLabelInput(input('Urgent'));
    component.addLabel();
    expect(component.labelAddError()).toBe('A label with that name already exists.');
    expect(component.draft().starterLabels.length).toBe(6);

    component.removeProject('Work');
    expect(component.draft().starterProjects.length).toBe(7);
  });

  it('use default suite restores defaults and clears custom rows', async () => {
    await create();

    component.toggleProject('Work', checkbox(false));
    component.onProjectInput(input('Garden'));
    component.addProject();
    component.onLabelInput(input('Deep Work'));
    component.addLabel();

    component.useDefaultSuite();

    expect(component.draft().starterProjects.length).toBe(7);
    expect(component.draft().starterProjects.every((project) => project.selected)).toBeTrue();
    expect(component.draft().starterLabels.length).toBe(6);
    expect(component.draft().starterLabels.every((label) => label.selected)).toBeTrue();
  });

  it('sends a touched avatar, clears a removed one, and creates the first task', async () => {
    await create();
    const image = 'data:image/png;base64,iVBORw0KGgo=';

    component.onAvatarSaved(image);
    expect(component.draft().avatarTouched).toBeTrue();
    component.setFirstTaskTitle(input('Write the launch note'));

    await component.complete();

    const [, payload] = authState.completeOnboarding.calls.mostRecent().args as [
      string,
      { image?: string | null },
    ];
    expect(payload.image).toBe(image);
    expect(taskService.createTask).toHaveBeenCalledOnceWith({
      title: 'Write the launch note',
      status: 'inbox',
    });
  });

  it('sends null when a saved avatar is removed', async () => {
    await create();

    component.onAvatarSaved('data:image/png;base64,iVBORw0KGgo=');
    component.onAvatarRemoved();
    await component.complete();

    const [, payload] = authState.completeOnboarding.calls.mostRecent().args as [
      string,
      { image?: string | null },
    ];
    expect(payload.image).toBeNull();
  });

  it('renders the three curated tips', async () => {
    await create();

    component.goNext();
    component.goNext();
    component.goNext();
    component.goNext();
    fixture.detectChanges();

    expect(component.step()).toBe('tips');
    expect(fixture.nativeElement.querySelectorAll('.tip-card').length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Capture in plain language');
  });

  it('keeps the wizard open and writes no completion flag when saving fails', async () => {
    await create();
    component.setActionNotifications(checkbox(true));
    authState.completeOnboarding.and.rejectWith(new Error('save failed'));

    await component.complete();

    expect(component.error()).toBe('Could not finish setting up. Please try again.');
    expect(component.completing()).toBeFalse();
    expect(preferences.onboardingCompleted()).toBeFalse();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(logService.error).toHaveBeenCalled();
  });

  it('lands on Ready when skipping from an earlier step fails', async () => {
    await create();
    authState.completeOnboarding.and.rejectWith(new Error('save failed'));

    component.skip();
    await fixture.whenStable();

    expect(component.step()).toBe('ready');
    expect(component.error()).toBe('Could not finish setting up. Please try again.');
    expect(preferences.onboardingCompleted()).toBeFalse();
  });

  it('sends the person to login when the session ended', async () => {
    await create();
    authState.completeOnboarding.and.rejectWith(new Error('Request failed with status 401'));

    await component.complete();

    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/login');
    expect(component.error()).toBe('');
    expect(preferences.onboardingCompleted()).toBeFalse();
  });

  it('stores desktop notifications as off when permission is denied', async () => {
    await create();
    permissionSignal.set('default');
    notificationService.requestPermission.and.resolveTo('denied');

    await component.setDesktopNotifications(checkbox(true));

    expect(component.draft().desktopNotifications).toBeFalse();
    expect(preferences.desktopNotifications()).toBeFalse();
  });

  it('restores a saved step and choices and reapplies the theme', async () => {
    await create({
      storedDraft: {
        savedAt: Date.now(),
        draft: {
          step: 'defaults',
          theme: 'ember-hearth',
          showLabelNames: false,
          captureBehavior: 'capture',
          archiveAutoDelete: false,
          askBeforeComplete: true,
          actionNotifications: false,
          desktopNotifications: true,
          dailyInsights: false,
          showLoginTips: false,
        },
      },
    });

    expect(component.step()).toBe('defaults');
    expect(component.draft().theme).toBe('ember-hearth');
    expect(component.draft().showLabelNames).toBeFalse();
    expect(component.draft().captureBehavior).toBe('capture');
    expect(component.draft().archiveAutoDelete).toBeFalse();
    expect(component.draft().askBeforeComplete).toBeTrue();
    expect(themeService.setTheme).toHaveBeenCalledWith('ember-hearth');
  });

  it('ignores and deletes a draft older than 24 hours', async () => {
    await create({
      storedDraft: {
        savedAt: Date.now() - 25 * 60 * 60 * 1000,
        draft: { step: 'defaults', theme: 'dark-forest' },
      },
    });

    expect(component.step()).toBe('welcome');
    expect(component.draft().theme).toBe('light-forest');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('validates the step query parameter and follows later changes', async () => {
    await create({ query: { step: 'nonsense' } });
    expect(component.step()).toBe('welcome');

    routeParams.next(convertToParamMap({ step: 'look' }));
    fixture.detectChanges();

    expect(component.step()).toBe('look');
    expect(
      fixture.nativeElement.querySelectorAll('.progress-dots li')[1].getAttribute('aria-current'),
    ).toBe('step');
  });

  it('signs out and returns to login', async () => {
    await create();

    await component.signOut();

    expect(authState.signOut).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
