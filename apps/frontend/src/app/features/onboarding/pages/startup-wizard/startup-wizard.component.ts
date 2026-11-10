import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  DEFAULT_LABEL_ICON,
  DEFAULT_LABELS,
  DEFAULT_PROJECTS,
  LABEL_COLORS,
  RequestError,
  isLabelIcon,
  isProjectColor,
  nameKey,
  pickLabelColorForName,
  type CaptureBehavior,
  type LabelColor,
  type LabelIcon,
  type ProjectColor,
  type StarterContent,
  type StarterLabelInput,
  type StarterProjectInput,
} from '@yotara/shared';
import { DEFAULT_THEME, THEMES, type Theme } from '../../../../core/constants/themes';
import { WIZARD_QUICK_ADD_TIPS, WIZARD_TIPS } from '../../../../core/constants/tips';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { LogService } from '../../../../core/services/log.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PreferencesStore } from '../../../../core/services/preferences-store.service';
import { StatusService } from '../../../../core/services/status.service';
import { TaskService } from '../../../../core/services/task.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { AvatarEditorComponent } from '../../../../shared/components/avatar/avatar-editor.component';
import { LabelIconComponent } from '../../../../shared/ui/label-icon/label-icon.component';
import { isSafeAvatarImage } from '../../../../shared/utils/avatar';
import { PROJECT_PALETTE, projectPaletteFor } from '../../../personal/project-presentation';

type WizardStep = 'welcome' | 'look' | 'defaults' | 'starter' | 'tips' | 'ready';

interface StarterProjectDraft {
  name: string;
  description?: string;
  color?: ProjectColor;
  selected: boolean;
  isDefault: boolean;
}

interface StarterLabelDraft {
  name: string;
  color?: string;
  icon?: LabelIcon;
  selected: boolean;
  isDefault: boolean;
}

interface WizardDraft {
  step: WizardStep;
  theme: Theme;
  showLabelNames: boolean;
  colorFirstLabels: boolean;
  captureBehavior: CaptureBehavior;
  archiveAutoDelete: boolean;
  askBeforeComplete: boolean;
  actionNotifications: boolean;
  desktopNotifications: boolean;
  dailyInsights: boolean;
  showLoginTips: boolean;
  avatarDataUrl: string | null;
  avatarTouched: boolean;
  starterProjects: StarterProjectDraft[];
  starterLabels: StarterLabelDraft[];
  firstTaskTitle: string;
}

const WIZARD_STEPS: readonly { id: WizardStep; title: string }[] = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'look', title: 'Look and feel' },
  { id: 'defaults', title: 'Workflow and notifications' },
  { id: 'starter', title: 'Starter projects and labels' },
  { id: 'tips', title: 'Tips' },
  { id: 'ready', title: 'Ready' },
];

const WIZARD_DRAFT_VERSION = 2;
const WIZARD_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const STARTER_NAME_MAX_LENGTH = 80;

const TIP_TITLES: Readonly<Record<string, string>> = {
  'capture-date': 'Type dates in plain language',
  'today-view': 'Keep the next step visible',
  'calendar-drag': 'Move a task by dragging',
};

const TIP_EXAMPLES: Readonly<Record<string, string>> = {
  'capture-date': '“tomorrow”, “next Friday”, or “Mar 12 3pm” — check the preview before you save.',
  'today-view': 'Today shows what is due or marked for today; Upcoming plans the week ahead.',
  'calendar-drag':
    'On desktop, drag a task to another day in Calendar, or double-click a day to create one.',
};

@Component({
  selector: 'app-startup-wizard',
  standalone: true,
  imports: [AvatarComponent, AvatarEditorComponent, LabelIconComponent],
  templateUrl: './startup-wizard.component.html',
  styleUrl: './startup-wizard.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class StartupWizardComponent {
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly logService = inject(LogService);
  private readonly preferences = inject(PreferencesStore);
  private readonly themeService = inject(ThemeService);
  private readonly taskService = inject(TaskService);
  private readonly statusService = inject(StatusService);
  protected readonly notificationService = inject(NotificationService);

  private readonly stepHeading = viewChild<ElementRef<HTMLHeadingElement>>('stepHeading');

  readonly steps = WIZARD_STEPS;
  readonly themes = THEMES;
  readonly wizardTips = WIZARD_TIPS;
  readonly quickAddTips = WIZARD_QUICK_ADD_TIPS;
  protected readonly user = this.authState.user;

  readonly step = signal<WizardStep>('welcome');
  readonly draft = signal<WizardDraft>(this.buildDefaultDraft());
  readonly completing = signal(false);
  readonly error = signal('');
  readonly accountCreated = signal(this.route.snapshot.queryParamMap.get('created') === '1');
  readonly isAvatarEditorOpen = signal(false);
  /** True when a stale draft expired, so the Welcome step can say so. */
  readonly draftExpired = signal(false);

  readonly newProjectName = signal('');
  readonly newLabelName = signal('');
  readonly projectAddError = signal('');
  readonly labelAddError = signal('');

  // ── Custom-item metadata ───────────────────────────────────────────────────
  // Auto-assigned from the name as the user types; overridable via the inline
  // color/icon pickers that appear below each add-row.
  readonly newProjectColor = signal<ProjectColor>('sage');
  readonly newLabelColor = signal<LabelColor>(LABEL_COLORS[0]);
  readonly newLabelIcon = signal<LabelIcon>(DEFAULT_LABEL_ICON);
  readonly newLabelExpanded = signal(false);

  // Exposed to the template so the HTML doesn't import constants directly.
  readonly projectPalette = PROJECT_PALETTE;
  readonly labelColors = LABEL_COLORS;
  /** Six quick-pick icons drawn from the "signals" group — most label-like. */
  readonly quickPickIcons: LabelIcon[] = [
    'flame',
    'hourglass',
    'calendar-days',
    'check-double',
    'lightbulb',
    'tag',
  ];

  private readonly newProjectInput = viewChild<ElementRef<HTMLInputElement>>('newProjectInput');
  private readonly newLabelInput = viewChild<ElementRef<HTMLInputElement>>('newLabelInput');

  readonly stepIndex = computed(() => WIZARD_STEPS.findIndex((entry) => entry.id === this.step()));
  readonly liveMessage = computed(
    () =>
      `Step ${this.stepIndex() + 1} of ${WIZARD_STEPS.length}: ${
        WIZARD_STEPS[this.stepIndex()]?.title ?? ''
      }`,
  );
  readonly primaryLabel = computed(() => {
    if (this.completing()) {
      return 'Saving...';
    }

    return this.step() === 'ready' ? 'Enter Yotara' : 'Continue';
  });
  readonly themeLabel = computed(
    () => THEMES.find((option) => option.id === this.draft().theme)?.label ?? 'Light Forest',
  );
  readonly welcomeHeading = computed(() => {
    const firstName = this.user()?.name?.trim().split(/\s+/)[0];
    return firstName ? `Welcome, ${firstName}` : 'Welcome to Yotara';
  });
  readonly notificationSummary = computed(() => {
    const draft = this.draft();
    const parts = [draft.actionNotifications ? 'Completion toasts on' : 'Completion toasts off'];

    if (this.notificationService.isSupported) {
      parts.push(draft.desktopNotifications ? 'desktop on' : 'desktop off');
    }

    return parts.join(' · ');
  });
  readonly selectedProjects = computed(() =>
    this.draft().starterProjects.filter((project) => project.selected),
  );
  readonly selectedLabels = computed(() =>
    this.draft().starterLabels.filter((label) => label.selected),
  );
  readonly selectedProjectCount = computed(() => this.selectedProjects().length);
  readonly selectedLabelCount = computed(() => this.selectedLabels().length);
  readonly starterSummary = computed(
    () =>
      `${this.selectedProjectCount()} projects · ${this.selectedLabelCount()} labels will be created`,
  );
  readonly starterIsEmpty = computed(
    () => this.selectedProjectCount() + this.selectedLabelCount() === 0,
  );

  constructor() {
    const restored = this.readDraft();
    const merged = restored ? this.mergeDraft(this.buildDefaultDraft(), restored) : this.draft();
    this.draft.set(merged);

    if (restored) {
      this.themeService.setTheme(merged.theme);
    }

    const queryStep = this.route.snapshot.queryParamMap.get('step');
    const initialStep = this.isStep(queryStep) ? queryStep : merged.step;
    this.step.set(initialStep);

    // Reflect the step in the URL after the current navigation settles, so the
    // initial deep link / refresh can be resumed without racing route activation.
    afterNextRender(() => this.syncStepParam(initialStep));

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const nextStep = params.get('step');
      if (this.isStep(nextStep) && nextStep !== this.step()) {
        this.step.set(nextStep);
        // Keep the persisted draft in step with the URL so a refresh after
        // back/forward resumes at the visible step instead of a stale one.
        this.patchDraft({ step: nextStep });
        this.focusStepHeading();
      }
    });
  }

  goNext(): void {
    if (this.step() === 'ready') {
      void this.complete();
      return;
    }

    const next = WIZARD_STEPS[this.stepIndex() + 1];
    if (next) {
      this.goToStep(next.id);
    }
  }

  goBack(): void {
    const previous = WIZARD_STEPS[this.stepIndex() - 1];
    if (previous) {
      this.goToStep(previous.id);
    }
  }

  editStep(step: WizardStep): void {
    this.goToStep(step);
  }

  selectTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
    this.patchDraft({ theme });
  }

  setShowLabelNames(event: Event): void {
    this.patchDraft({ showLabelNames: isChecked(event) });
  }

  setColorFirstLabels(event: Event): void {
    this.patchDraft({ colorFirstLabels: isChecked(event) });
  }

  setCaptureBehavior(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patchDraft({ captureBehavior: value === 'capture' ? 'capture' : 'quick' });
  }

  setArchiveAutoDelete(event: Event): void {
    this.patchDraft({ archiveAutoDelete: isChecked(event) });
  }

  setAskBeforeComplete(event: Event): void {
    this.patchDraft({ askBeforeComplete: isChecked(event) });
  }

  setActionNotifications(event: Event): void {
    this.patchDraft({ actionNotifications: isChecked(event) });
  }

  async setDesktopNotifications(event: Event): Promise<void> {
    const enabled = isChecked(event);

    if (!this.notificationService.isSupported) {
      this.patchDraft({ desktopNotifications: false });
      return;
    }

    if (enabled && this.notificationService.permission() === 'default') {
      const permission = await this.notificationService.requestPermission();
      if (permission !== 'granted') {
        this.patchDraft({ desktopNotifications: false });
        return;
      }
    }

    if (enabled && this.notificationService.permission() === 'denied') {
      this.patchDraft({ desktopNotifications: false });
      return;
    }

    this.patchDraft({ desktopNotifications: enabled });
  }

  setDailyInsights(event: Event): void {
    this.patchDraft({ dailyInsights: isChecked(event) });
  }

  setShowLoginTips(event: Event): void {
    this.patchDraft({ showLoginTips: isChecked(event) });
  }

  onProjectInput(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.newProjectName.set(name);
    // Auto-assign a palette color as the user types so the dot preview in the
    // color row already reflects this name when they glance at the picker.
    this.newProjectColor.set(pickProjectColorForName(name));
  }

  onLabelInput(event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.newLabelName.set(name);
    // Track a deterministic color by name only while the picker is collapsed —
    // once the user has explicitly picked a color don't overwrite their choice.
    if (!this.newLabelExpanded()) {
      this.newLabelColor.set(pickLabelColorForName(name));
    }
  }

  addProject(): void {
    const name = this.newProjectName().trim();
    const validation = this.validateStarterName(
      name,
      this.draft().starterProjects,
      'project',
      this.projectAddError,
    );
    if (!validation) {
      return;
    }

    this.patchDraft({
      starterProjects: [
        ...this.draft().starterProjects,
        { name, color: this.newProjectColor(), selected: true, isDefault: false },
      ],
    });
    this.newProjectName.set('');
    this.newProjectColor.set('sage');
    this.projectAddError.set('');
    // Keep focus in the input so a second project can be added without
    // re-tabbing from the button.
    this.newProjectInput()?.nativeElement.focus();
  }

  addLabel(): void {
    const name = this.newLabelName().trim();
    const validation = this.validateStarterName(
      name,
      this.draft().starterLabels,
      'label',
      this.labelAddError,
    );
    if (!validation) {
      return;
    }

    this.patchDraft({
      starterLabels: [
        ...this.draft().starterLabels,
        {
          name,
          color: this.newLabelColor(),
          icon: this.newLabelIcon(),
          selected: true,
          isDefault: false,
        },
      ],
    });
    this.newLabelName.set('');
    this.newLabelColor.set(LABEL_COLORS[0]);
    this.newLabelIcon.set(DEFAULT_LABEL_ICON);
    this.newLabelExpanded.set(false);
    this.labelAddError.set('');
    this.newLabelInput()?.nativeElement.focus();
  }

  toggleProject(name: string, event: Event): void {
    const selected = isChecked(event);
    this.patchDraft({
      starterProjects: this.draft().starterProjects.map((project) =>
        project.name === name ? { ...project, selected } : project,
      ),
    });
  }

  toggleLabel(name: string, event: Event): void {
    const selected = isChecked(event);
    this.patchDraft({
      starterLabels: this.draft().starterLabels.map((label) =>
        label.name === name ? { ...label, selected } : label,
      ),
    });
  }

  removeProject(name: string): void {
    this.patchDraft({
      starterProjects: this.draft().starterProjects.filter(
        (project) => project.isDefault || project.name !== name,
      ),
    });
  }

  removeLabel(name: string): void {
    this.patchDraft({
      starterLabels: this.draft().starterLabels.filter(
        (label) => label.isDefault || label.name !== name,
      ),
    });
  }

  useDefaultSuite(): void {
    this.patchDraft({
      starterProjects: defaultProjectDrafts(true),
      starterLabels: defaultLabelDrafts(true),
    });
    this.clearAddErrors();
  }

  startEmpty(): void {
    this.patchDraft({
      starterProjects: defaultProjectDrafts(false),
      starterLabels: defaultLabelDrafts(false),
    });
    this.clearAddErrors();
  }

  setFirstTaskTitle(event: Event): void {
    this.patchDraft({
      firstTaskTitle: (event.target as HTMLInputElement).value.slice(0, 200),
    });
  }

  openAvatarEditor(): void {
    this.isAvatarEditorOpen.set(true);
  }

  onAvatarSaved(image: string): void {
    this.patchDraft({ avatarDataUrl: image, avatarTouched: true });
    this.isAvatarEditorOpen.set(false);
  }

  onAvatarRemoved(): void {
    this.patchDraft({ avatarDataUrl: null, avatarTouched: true });
    this.isAvatarEditorOpen.set(false);
  }

  tipTitle(id: string): string {
    return TIP_TITLES[id] ?? 'A useful tip';
  }

  tipExample(id: string): string {
    return TIP_EXAMPLES[id] ?? '';
  }

  projectAccent(color?: ProjectColor): string {
    return projectPaletteFor(color).accent;
  }

  skip(): void {
    // "Skip setup" means the person wants in without the questions — it must
    // not silently create content they never saw. Seed nothing (matching the
    // "Start empty" choice) but keep theme and other preferences the draft
    // already holds, so the account lands with a clean, intentional baseline.
    this.patchDraft({
      starterProjects: defaultProjectDrafts(false),
      starterLabels: defaultLabelDrafts(false),
      firstTaskTitle: '',
    });
    void this.complete();
  }

  async signOut(): Promise<void> {
    // Don't leave a previous person's picks (including their avatar data
    // URL) in localStorage on a shared machine.
    this.clearDraft();
    try {
      await this.authState.signOut();
    } finally {
      await this.router.navigateByUrl('/login');
    }
  }

  async complete(): Promise<void> {
    if (this.completing()) {
      return;
    }

    const draft = this.draft();
    this.completing.set(true);
    this.error.set('');

    try {
      const image = draft.avatarTouched ? draft.avatarDataUrl : undefined;

      await this.authState.completeOnboarding('personal', {
        archiveAutoDelete: draft.archiveAutoDelete,
        captureBehavior: draft.captureBehavior,
        starterContent: buildStarterContent(draft),
        ...(image !== undefined ? { image } : {}),
      });

      this.themeService.setTheme(draft.theme);
      this.preferences.setShowLabelNames(draft.showLabelNames);
      this.preferences.setColorFirstLabels(draft.colorFirstLabels);
      this.preferences.setSkipCompleteConfirm(!draft.askBeforeComplete);
      this.preferences.setActionNotifications(draft.actionNotifications);
      this.preferences.setDesktopNotifications(draft.desktopNotifications);
      this.preferences.setInsightDismissed(!draft.dailyInsights);
      // Persist the person's choice permanently (including re-enabling tips
      // after a previous "off", which must write 'false'), then suppress the
      // tip for this session only so the shell does not open a modal right
      // after the wizard that just showed tips.
      this.preferences.setLoginTipDismissed(!draft.showLoginTips, true);
      if (draft.showLoginTips) {
        this.preferences.setLoginTipDismissed(true, false);
      }
      this.preferences.setWorkspaceType('personal');
      this.preferences.setOnboardingCompleted();
      this.clearDraft();

      const firstTaskTitle = draft.firstTaskTitle.trim();
      if (firstTaskTitle) {
        try {
          await this.taskService.createTask({ title: firstTaskTitle, status: 'inbox' });
        } catch (error) {
          this.logService.warn(
            'Could not create the first task from onboarding',
            error,
            'StartupWizard',
          );
          // Don't lose the task silently: name it in a toast on the landing
          // page so the person can re-add it in seconds.
          this.statusService.show(
            `We couldn\u2019t save your first task (\u201C${firstTaskTitle}\u201D) \u2014 please add it again.`,
            'warning',
            8000,
          );
        }
      }

      await this.router.navigateByUrl(this.authState.getPostAuthRedirectUrl());
    } catch (error) {
      if (this.isSessionError(error)) {
        await this.router.navigateByUrl('/login');
        return;
      }

      this.logService.error('Failed to complete onboarding', error, 'StartupWizard');
      // Skip can fail from an earlier step; land on Ready so the person sees
      // the error beside the retry action.
      if (this.step() !== 'ready') {
        this.goToStep('ready');
      }
      // Echo the server's message when there is one (validation detail, photo
      // too large, name collision) instead of a canned string.
      const detail = error instanceof Error ? error.message.trim() : '';
      this.error.set(
        detail
          ? `Could not finish setting up. ${detail}`
          : 'Could not finish setting up. Please try again.',
      );
    } finally {
      this.completing.set(false);
    }
  }

  private validateStarterName(
    name: string,
    rows: readonly { name: string }[],
    kind: 'project' | 'label',
    errorSignal: { set(value: string): void },
  ): boolean {
    if (!name) {
      errorSignal.set(`Enter a ${kind} name.`);
      return false;
    }
    if (name.length > STARTER_NAME_MAX_LENGTH) {
      errorSignal.set(`Names must be ${STARTER_NAME_MAX_LENGTH} characters or fewer.`);
      return false;
    }
    const key = nameKey(name);
    if (rows.some((row) => nameKey(row.name) === key)) {
      errorSignal.set(`A ${kind} with that name already exists.`);
      return false;
    }
    return true;
  }

  private clearAddErrors(): void {
    this.projectAddError.set('');
    this.labelAddError.set('');
    this.newProjectName.set('');
    this.newLabelName.set('');
  }

  private goToStep(step: WizardStep): void {
    if (step === this.step()) {
      return;
    }

    this.step.set(step);
    this.patchDraft({ step });
    this.syncStepParam(step);
    this.focusStepHeading();
  }

  private patchDraft(patch: Partial<WizardDraft>): void {
    this.draft.update((current) => ({ ...current, ...patch }));
    this.persistDraft();
  }

  private syncStepParam(step: WizardStep): void {
    if (this.route.snapshot.queryParamMap.get('step') === step) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private focusStepHeading(): void {
    queueMicrotask(() => this.stepHeading()?.nativeElement.focus());
  }

  private buildDefaultDraft(): WizardDraft {
    const user = this.authState.user();
    const userImage = user?.image ?? null;

    return {
      step: 'welcome',
      theme: this.themeService.theme() ?? DEFAULT_THEME,
      showLabelNames: this.preferences.showLabelNames(),
      colorFirstLabels: this.preferences.colorFirstLabels(),
      captureBehavior: user?.captureBehavior ?? 'quick',
      archiveAutoDelete: user?.archiveAutoDelete ?? true,
      // Ask-before-complete reflects PreferencesStore's skipCompleteConfirm
      // (false => confirmation dialog on, so askBeforeComplete defaults to true).
      askBeforeComplete: !this.preferences.skipCompleteConfirm(),
      actionNotifications: this.preferences.actionNotifications(),
      desktopNotifications:
        this.notificationService.isSupported && this.notificationService.permission() !== 'denied'
          ? this.preferences.desktopNotifications()
          : false,
      dailyInsights: !this.preferences.insightDismissed(),
      showLoginTips: !this.preferences.loginTipDismissed(),
      avatarDataUrl: userImage && isSafeAvatarImage(userImage) ? userImage : null,
      avatarTouched: false,
      starterProjects: defaultProjectDrafts(true),
      starterLabels: defaultLabelDrafts(true),
      firstTaskTitle: '',
    };
  }

  private mergeDraft(base: WizardDraft, stored: Partial<WizardDraft>): WizardDraft {
    const storedAvatar = stored.avatarDataUrl;
    const avatarDataUrl =
      typeof storedAvatar === 'string' && isSafeAvatarImage(storedAvatar)
        ? storedAvatar
        : stored.avatarTouched === true
          ? null
          : base.avatarDataUrl;

    return {
      step: this.isStep(stored.step) ? stored.step : base.step,
      theme: THEMES.some((option) => option.id === stored.theme)
        ? (stored.theme as Theme)
        : base.theme,
      showLabelNames: booleanOr(stored.showLabelNames, base.showLabelNames),
      colorFirstLabels: booleanOr(stored.colorFirstLabels, base.colorFirstLabels),
      captureBehavior: stored.captureBehavior === 'capture' ? 'capture' : base.captureBehavior,
      archiveAutoDelete: booleanOr(stored.archiveAutoDelete, base.archiveAutoDelete),
      askBeforeComplete: booleanOr(stored.askBeforeComplete, base.askBeforeComplete),
      actionNotifications: booleanOr(stored.actionNotifications, base.actionNotifications),
      desktopNotifications: booleanOr(stored.desktopNotifications, base.desktopNotifications),
      dailyInsights: booleanOr(stored.dailyInsights, base.dailyInsights),
      showLoginTips: booleanOr(stored.showLoginTips, base.showLoginTips),
      avatarDataUrl,
      avatarTouched: booleanOr(stored.avatarTouched, base.avatarTouched),
      starterProjects: mergeStarterProjects(stored.starterProjects),
      starterLabels: mergeStarterLabels(stored.starterLabels),
      firstTaskTitle:
        typeof stored.firstTaskTitle === 'string'
          ? stored.firstTaskTitle.slice(0, 200)
          : base.firstTaskTitle,
    };
  }

  private isStep(value: unknown): value is WizardStep {
    return WIZARD_STEPS.some((entry) => entry.id === value);
  }

  private draftStorageKey(): string | null {
    const userId = this.authState.currentUserId();
    return userId ? `yotara_wizard_draft:${userId}` : null;
  }

  private readDraft(): Partial<WizardDraft> | null {
    const key = this.draftStorageKey();
    if (!key) {
      return null;
    }

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as {
        version?: unknown;
        savedAt?: unknown;
        draft?: unknown;
      };

      const shapeValid =
        parsed.version === WIZARD_DRAFT_VERSION &&
        typeof parsed.savedAt === 'number' &&
        typeof parsed.draft === 'object' &&
        parsed.draft !== null;
      const fresh =
        typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt < WIZARD_DRAFT_TTL_MS;

      if (!shapeValid || !fresh) {
        // Only an expiry (not a version bump or corrupt JSON) is worth
        // mentioning; the person really did start this more than a day ago.
        if (shapeValid && !fresh) {
          this.draftExpired.set(true);
        }
        localStorage.removeItem(key);
        return null;
      }

      return parsed.draft as Partial<WizardDraft>;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  private persistDraft(): void {
    const key = this.draftStorageKey();
    if (!key) {
      return;
    }

    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: WIZARD_DRAFT_VERSION,
          savedAt: Date.now(),
          draft: this.draft(),
        }),
      );
    } catch (error) {
      this.logService.warn('Could not save the onboarding draft', error, 'StartupWizard');
    }
  }

  private clearDraft(): void {
    const key = this.draftStorageKey();
    if (key) {
      localStorage.removeItem(key);
    }
  }

  private isSessionError(error: unknown): boolean {
    if (error instanceof RequestError) {
      return error.status === 401 || error.status === 403;
    }
    return false;
  }
}

function buildStarterContent(draft: WizardDraft): StarterContent {
  return {
    projects: draft.starterProjects
      .filter((project) => project.selected)
      .map((project): StarterProjectInput => {
        const input: StarterProjectInput = { name: project.name };
        if (project.description) {
          input.description = project.description;
        }
        if (project.color) {
          input.color = project.color;
        }
        return input;
      }),
    labels: draft.starterLabels
      .filter((label) => label.selected)
      .map((label): StarterLabelInput => {
        const input: StarterLabelInput = { name: label.name };
        if (label.color) {
          input.color = label.color;
        }
        if (label.icon) {
          input.icon = label.icon;
        }
        return input;
      }),
  };
}

function defaultProjectDrafts(selected: boolean): StarterProjectDraft[] {
  return DEFAULT_PROJECTS.map((project) => ({
    name: project.name,
    description: project.description,
    color: project.color,
    selected,
    isDefault: true,
  }));
}

function defaultLabelDrafts(selected: boolean): StarterLabelDraft[] {
  return DEFAULT_LABELS.map((label) => ({
    name: label.name,
    color: label.color,
    icon: label.icon,
    selected,
    isDefault: true,
  }));
}

function mergeStarterProjects(stored: unknown): StarterProjectDraft[] {
  if (!Array.isArray(stored)) {
    return defaultProjectDrafts(true);
  }

  const selectedByName = new Map<string, boolean>();
  const custom: StarterProjectDraft[] = [];

  for (const entry of stored) {
    if (!isRecord(entry) || typeof entry['name'] !== 'string') {
      continue;
    }
    const name = entry['name'].trim();
    if (!name || name.length > STARTER_NAME_MAX_LENGTH) {
      continue;
    }
    if (entry['isDefault'] === true) {
      selectedByName.set(nameKey(name), entry['selected'] !== false);
    } else {
      const color = isProjectColor(entry['color']) ? entry['color'] : undefined;
      custom.push({ name, color, selected: entry['selected'] !== false, isDefault: false });
    }
  }

  const defaults = DEFAULT_PROJECTS.map((project) => ({
    name: project.name,
    description: project.description,
    color: project.color,
    selected: selectedByName.get(nameKey(project.name)) ?? true,
    isDefault: true,
  }));

  return [...defaults, ...dedupeCustoms(custom, defaults)];
}

function mergeStarterLabels(stored: unknown): StarterLabelDraft[] {
  if (!Array.isArray(stored)) {
    return defaultLabelDrafts(true);
  }

  const selectedByName = new Map<string, boolean>();
  const custom: StarterLabelDraft[] = [];

  for (const entry of stored) {
    if (!isRecord(entry) || typeof entry['name'] !== 'string') {
      continue;
    }
    const name = entry['name'].trim();
    if (!name || name.length > STARTER_NAME_MAX_LENGTH) {
      continue;
    }
    if (entry['isDefault'] === true) {
      selectedByName.set(nameKey(name), entry['selected'] !== false);
    } else {
      const color = typeof entry['color'] === 'string' ? entry['color'] : undefined;
      const icon = isLabelIcon(entry['icon']) ? entry['icon'] : undefined;
      custom.push({ name, color, icon, selected: entry['selected'] !== false, isDefault: false });
    }
  }

  const defaults = DEFAULT_LABELS.map((label) => ({
    name: label.name,
    color: label.color,
    icon: label.icon,
    selected: selectedByName.get(nameKey(label.name)) ?? true,
    isDefault: true,
  }));

  return [...defaults, ...dedupeCustoms(custom, defaults)];
}

function dedupeCustoms<T extends { name: string }>(
  custom: T[],
  defaults: readonly { name: string }[],
): T[] {
  const seen = new Set(defaults.map((row) => nameKey(row.name)));
  const deduped: T[] = [];

  for (const row of custom) {
    const key = nameKey(row.name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

function isChecked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deterministic project-color pick by name, mirroring `pickLabelColorForName`
 * from `@yotara/shared`. Keeps auto-assignment stable so the dot preview stays
 * consistent whether the user types quickly or pauses.
 */
function pickProjectColorForName(name: string): ProjectColor {
  const index =
    Math.abs(
      name
        .toLowerCase()
        .split('')
        .reduce((sum, ch) => sum + ch.charCodeAt(0), 0),
    ) % PROJECT_PALETTE.length;
  return PROJECT_PALETTE[index].value;
}
