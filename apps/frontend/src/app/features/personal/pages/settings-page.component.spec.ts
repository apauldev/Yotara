import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Task, Project, Label } from '@yotara/shared';
import { SettingsPageComponent } from './settings-page.component';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { LabelService } from '../../../core/services/label.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ThemeService } from '../../../core/services/theme.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { NotificationService } from '../../../core/services/notification.service';

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Work',
    ownerId: 'user-1',
    createdAt: '',
    updatedAt: '',
    taskCount: 2,
    completedTaskCount: 1,
    openTaskCount: 1,
  },
  {
    id: 'proj-2',
    name: 'Personal',
    ownerId: 'user-1',
    createdAt: '',
    updatedAt: '',
    taskCount: 1,
    completedTaskCount: 0,
    openTaskCount: 1,
  },
];

const mockLabels: Label[] = [
  { id: 'lbl-1', name: 'urgent', color: '#ff0000', userId: 'user-1' },
  { id: 'lbl-2', name: 'design', color: '#00ff00', userId: 'user-1' },
];

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Active task',
    status: 'inbox',
    priority: 'high',
    completed: false,
    order: 0,
    createdAt: '',
    updatedAt: '',
    projectId: 'proj-1',
    labels: ['lbl-1'],
  },
  {
    id: 'task-2',
    title: 'Completed task',
    status: 'done',
    priority: 'medium',
    completed: true,
    order: 1,
    createdAt: '',
    updatedAt: '',
    projectId: 'proj-1',
    labels: [],
  },
  {
    id: 'task-3',
    title: 'Subtask',
    status: 'inbox',
    priority: 'low',
    completed: false,
    order: 2,
    createdAt: '',
    updatedAt: '',
    parentId: 'task-1',
    labels: [],
  },
  {
    id: 'task-4',
    title: 'Archived task',
    status: 'done',
    priority: 'low',
    completed: true,
    order: 3,
    createdAt: '',
    updatedAt: '',
    archivedAt: '2026-01-01T00:00:00.000Z',
    labels: [],
    description: 'Long description with markdown',
    recurrenceRule: { frequency: 'weekly', interval: 1 },
  },
  {
    id: 'task-5',
    title: 'Upcoming task',
    status: 'upcoming',
    priority: 'medium',
    completed: false,
    order: 4,
    createdAt: '',
    updatedAt: '',
    dueDate: '2026-06-15',
    projectId: 'proj-2',
    labels: ['lbl-1', 'lbl-2'],
    recurrenceRule: { frequency: 'daily', interval: 1 },
    subtaskCount: 1,
    subtaskCompletedCount: 0,
  },
];

function findButtonByText(
  fixture: ComponentFixture<SettingsPageComponent>,
  text: string,
): HTMLButtonElement | null {
  const buttons = fixture.debugElement.queryAll(By.css('.settings-link'));
  for (const btn of buttons) {
    if (btn.nativeElement.textContent.includes(text)) {
      return btn.nativeElement;
    }
  }
  return null;
}

describe('SettingsPageComponent', () => {
  let fixture: ComponentFixture<SettingsPageComponent>;
  let comp: any;
  let preferences: PreferencesStore;

  beforeEach(() => {
    localStorage.clear();
  });
  let tasksSignal: ReturnType<typeof signal<Task[]>>;
  const originalCreateElement = document.createElement.bind(document);
  let projectsSignal: ReturnType<typeof signal<Project[]>>;
  let labelsSignal: ReturnType<typeof signal<Label[]>>;
  let createObjectURLSpy: jasmine.Spy;
  let anchor: { href: string; download: string; click: jasmine.Spy };

  function lastBlobContent(): Promise<string> {
    const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
    return blob.text();
  }

  function openExportOptions() {
    const summary = fixture.debugElement.query(By.css('.export-options-summary'));
    if (summary) {
      summary.nativeElement.click();
      fixture.detectChanges();
    }
  }

  beforeEach(async () => {
    tasksSignal = signal([...mockTasks]);
    projectsSignal = signal([...mockProjects]);
    labelsSignal = signal([...mockLabels]);

    anchor = { href: '', download: '', click: jasmine.createSpy('click') };
    createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
    spyOn(URL, 'revokeObjectURL').and.returnValue();
    spyOn(document, 'createElement').and.callFake((tag: string) =>
      tag === 'a' ? (anchor as unknown as HTMLElement) : originalCreateElement(tag),
    );

    const mockAuthState = {
      user: signal({
        id: 'user-1',
        email: 'test@example.com',
        archiveAutoDelete: true,
        captureBehavior: 'quick',
      }),
      loading: signal(false),
      updateProfile: jasmine.createSpy('updateProfile').and.resolveTo({}),
      signOut: jasmine.createSpy('signOut').and.resolveTo(),
      getCounts: jasmine.createSpy('getCounts').and.resolveTo({ tasks: 5, projects: 3, labels: 2 }),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        {
          provide: TaskService,
          useValue: {
            tasks: tasksSignal,
            allActiveTasks: tasksSignal,
            fetchAllTasks: () => Promise.resolve([...mockTasks]),
          },
        },
        { provide: ProjectService, useValue: { projects: projectsSignal } },
        { provide: LabelService, useValue: { labels: labelsSignal } },
        { provide: AuthStateService, useValue: mockAuthState },
        {
          provide: ThemeService,
          useValue: { theme: signal('light-forest'), setTheme: jasmine.createSpy() },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy().and.resolveTo(true) } },
        {
          provide: NotificationService,
          useValue: {
            isSupported: true,
            permission: signal('default' as NotificationPermission),
            requestPermission: jasmine.createSpy('requestPermission').and.resolveTo('default'),
            showBrowserNotification: jasmine.createSpy('showBrowserNotification'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPageComponent);
    comp = fixture.componentInstance as any;
    preferences = TestBed.inject(PreferencesStore);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('export tasks', () => {
    it('triggers a CSV download when Export tasks is clicked', async () => {
      const btn = findButtonByText(fixture, 'Export tasks');
      expect(btn).not.toBeNull();
      btn!.click();
      await fixture.whenStable();

      expect(anchor.download).toBe('yotara-tasks.csv');
      expect(anchor.click).toHaveBeenCalledTimes(1);
      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('includes all task types by default', async () => {
      await comp.exportTasks();
      const content = await lastBlobContent();
      const lines = content.trim().split('\n');

      expect(lines.length - 1).toBe(5);
      expect(content).toContain('Active task');
      expect(content).toContain('Completed task');
      expect(content).toContain('Subtask');
      expect(content).toContain('Archived task');
      expect(content).toContain('Upcoming task');
    });

    it('excludes completed tasks when toggle is off', async () => {
      comp.includeCompleted.set(false);
      await comp.exportTasks();
      const content = await lastBlobContent();

      expect(content).toContain('Active task');
      expect(content).not.toContain('Completed task');
      expect(content).not.toContain('Archived task');
    });

    it('excludes subtasks when toggle is off', async () => {
      comp.includeSubtasks.set(false);
      await comp.exportTasks();
      const content = await lastBlobContent();
      const dataLines = content.trim().split('\n').slice(1);

      expect(content).toContain('Active task');
      expect(dataLines.find((l) => l.includes(',Subtask,'))).toBeUndefined();
    });

    it('excludes archived items when toggle is off', async () => {
      comp.includeArchived.set(false);
      await comp.exportTasks();
      const content = await lastBlobContent();

      expect(content).toContain('Active task');
      expect(content).not.toContain('Archived task');
    });

    it('omits the description column when toggle is off', async () => {
      comp.includeDescriptions.set(false);
      await comp.exportTasks();

      const content = await lastBlobContent();
      expect(content).not.toContain('Description');
    });

    it('omits the recurrence column when toggle is off', async () => {
      comp.includeRecurrence.set(false);
      await comp.exportTasks();

      const content = await lastBlobContent();
      expect(content).not.toContain('Recurrence');
    });

    it('resolves project IDs to project names', async () => {
      await comp.exportTasks();
      const content = await lastBlobContent();
      const lines = content.trim().split('\n');

      const activeTaskLine = lines.find((l) => l.includes(',Active task,'));
      expect(activeTaskLine).toBeTruthy();
      expect(activeTaskLine).toContain('Work');
    });

    it('resolves label IDs to label names', async () => {
      await comp.exportTasks();
      const content = await lastBlobContent();
      const lines = content.trim().split('\n');

      const upcomingLine = lines.find((l) => l.includes(',Upcoming task,'));
      expect(upcomingLine).toBeTruthy();
      expect(upcomingLine).toContain('urgent; design');
    });

    it('writes a header row matching the toggled columns', async () => {
      comp.includeDescriptions.set(false);
      comp.includeRecurrence.set(false);
      await comp.exportTasks();

      const content = await lastBlobContent();
      const header = content.trim().split('\n')[0];

      expect(header).toContain('ID');
      expect(header).toContain('Title');
      expect(header).not.toContain('Description');
      expect(header).toContain('Status');
      expect(header).toContain('Priority');
      expect(header).toContain('Completed');
      expect(header).toContain('Due Date');
      expect(header).toContain('Project');
      expect(header).toContain('Labels');
      expect(header).toContain('Bucket');
      expect(header).toContain('Parent Task ID');
      expect(header).toContain('Subtasks');
      expect(header).toContain('Subtasks Done');
      expect(header).not.toContain('Recurrence');
      expect(header).toContain('Archived At');
      expect(header).toContain('Created At');
      expect(header).toContain('Updated At');
    });

    it('formats the completed column as Yes/No', async () => {
      await comp.exportTasks();
      const content = await lastBlobContent();
      const lines = content.trim().split('\n');

      const activeLine = lines.find((l) => l.includes(',Active task,'));
      const completedLine = lines.find((l) => l.includes(',Completed task,'));

      expect(activeLine).toBeTruthy();
      expect(completedLine).toBeTruthy();

      const activeColumns = activeLine!.split(',');
      const completedColumns = completedLine!.split(',');

      expect(activeColumns[5]).toBe('No');
      expect(completedColumns[5]).toBe('Yes');
    });
  });

  describe('export projects', () => {
    it('triggers a CSV download with project data', async () => {
      const btn = findButtonByText(fixture, 'Export projects');
      expect(btn).not.toBeNull();
      btn!.click();

      expect(anchor.download).toBe('yotara-projects.csv');
      const content = await lastBlobContent();

      expect(content).toContain('Name');
      expect(content).toContain('Work');
      expect(content).toContain('Personal');
      expect(content).toContain('Total Tasks');
      expect(content).toContain('Completed Tasks');
      expect(content).toContain('Open Tasks');
    });
  });

  describe('export labels', () => {
    it('triggers a CSV download with label data', async () => {
      const btn = findButtonByText(fixture, 'Export labels');
      expect(btn).not.toBeNull();
      btn!.click();

      expect(anchor.download).toBe('yotara-labels.csv');
      const content = await lastBlobContent();

      expect(content).toContain('Name');
      expect(content).toContain('urgent');
      expect(content).toContain('design');
      expect(content).toContain('Tasks');
    });
  });

  describe('export options toggles', () => {
    it('renders five toggle checkboxes when expanded', () => {
      openExportOptions();
      const checkboxes = fixture.debugElement.queryAll(
        By.css('.export-checkbox input[type="checkbox"]'),
      );
      expect(checkboxes.length).toBe(5);
    });

    it('defaults all toggles to checked', () => {
      openExportOptions();
      const checkboxes = fixture.debugElement.queryAll(
        By.css('.export-checkbox input[type="checkbox"]'),
      );
      for (const cb of checkboxes) {
        expect(cb.nativeElement.checked).toBeTrue();
      }
    });

    it('clicking a toggle updates the component signal', () => {
      openExportOptions();
      const checkboxes = fixture.debugElement.queryAll(
        By.css('.export-checkbox input[type="checkbox"]'),
      );

      checkboxes[0].nativeElement.click();
      fixture.detectChanges();
      expect(comp.includeCompleted()).toBeFalse();

      checkboxes[1].nativeElement.click();
      fixture.detectChanges();
      expect(comp.includeSubtasks()).toBeFalse();

      checkboxes[2].nativeElement.click();
      fixture.detectChanges();
      expect(comp.includeDescriptions()).toBeFalse();
    });

    it('checkboxes reflect signal state after programmatic toggle', () => {
      comp.includeCompleted.set(false);
      comp.includeArchived.set(false);
      fixture.detectChanges();

      openExportOptions();
      const checkboxes = fixture.debugElement.queryAll(
        By.css('.export-checkbox input[type="checkbox"]'),
      );
      expect(checkboxes[0].nativeElement.checked).toBeFalse();
      expect(checkboxes[3].nativeElement.checked).toBeFalse();
      expect(checkboxes[1].nativeElement.checked).toBeTrue();
    });
  });

  function getCompleteConfirmToggle(): HTMLInputElement | null {
    const toggles = fixture.debugElement.queryAll(By.css('.settings-toggle'));
    for (const toggle of toggles) {
      const strong = toggle.query(By.css('.settings-item-copy strong'));
      if (strong?.nativeElement.textContent.includes('Complete task confirmation')) {
        return toggle.query(By.css('input[type="checkbox"]'))?.nativeElement ?? null;
      }
    }
    return null;
  }

  describe('Complete task confirmation toggle', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('renders the complete task confirmation toggle', () => {
      expect(getCompleteConfirmToggle()).toBeTruthy();
    });

    it('defaults to showing confirmation when no localStorage key is set', () => {
      expect(getCompleteConfirmToggle()?.checked).toBeFalse();
    });

    it('reflects localStorage key when already set before component creation', () => {
      preferences.setSkipCompleteConfirm(true);
      fixture = TestBed.createComponent(SettingsPageComponent);
      comp = fixture.componentInstance as any;
      fixture.detectChanges();

      expect(getCompleteConfirmToggle()?.checked).toBeTrue();
    });

    it('saves to localStorage when toggled on', () => {
      getCompleteConfirmToggle()?.click();
      fixture.detectChanges();

      expect(preferences.skipCompleteConfirm()).toBeTrue();
      expect(getCompleteConfirmToggle()?.checked).toBeTrue();
    });

    it('removes from localStorage when toggled off', () => {
      preferences.setSkipCompleteConfirm(true);
      fixture = TestBed.createComponent(SettingsPageComponent);
      comp = fixture.componentInstance as any;
      fixture.detectChanges();

      getCompleteConfirmToggle()?.click();
      fixture.detectChanges();

      expect(preferences.skipCompleteConfirm()).toBeFalse();
      expect(getCompleteConfirmToggle()?.checked).toBeFalse();
    });
  });

  function getLoginTipsToggle(): HTMLInputElement | null {
    const toggles = fixture.debugElement.queryAll(By.css('.settings-toggle'));
    for (const toggle of toggles) {
      const strong = toggle.query(By.css('.settings-item-copy strong'));
      if (strong?.nativeElement.textContent.includes('Show login tips')) {
        return toggle.query(By.css('input[type="checkbox"]'))?.nativeElement ?? null;
      }
    }
    return null;
  }

  function getActionNotificationsToggle(): HTMLInputElement | null {
    const toggles = fixture.debugElement.queryAll(By.css('.settings-toggle'));
    for (const toggle of toggles) {
      const strong = toggle.query(By.css('.settings-item-copy strong'));
      if (strong?.nativeElement.textContent.includes('Task completion notifications')) {
        return toggle.query(By.css('input[type="checkbox"]'))?.nativeElement ?? null;
      }
    }
    return null;
  }

  describe('Task completion notifications toggle', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('renders the notifications toggle', () => {
      expect(getActionNotificationsToggle()).toBeTruthy();
    });

    it('defaults to on when no localStorage key is set', () => {
      expect(getActionNotificationsToggle()?.checked).toBeTrue();
    });

    it('reflects localStorage key when already set before component creation', () => {
      preferences.setActionNotifications(false);
      fixture = TestBed.createComponent(SettingsPageComponent);
      comp = fixture.componentInstance as any;
      fixture.detectChanges();

      expect(getActionNotificationsToggle()?.checked).toBeFalse();
    });

    it('saves to localStorage when toggled off', () => {
      getActionNotificationsToggle()?.click();
      fixture.detectChanges();

      expect(preferences.actionNotifications()).toBeFalse();
      expect(getActionNotificationsToggle()?.checked).toBeFalse();
    });

    it('saves to localStorage when toggled back on', () => {
      preferences.setActionNotifications(false);
      fixture = TestBed.createComponent(SettingsPageComponent);
      comp = fixture.componentInstance as any;
      fixture.detectChanges();

      getActionNotificationsToggle()?.click();
      fixture.detectChanges();

      expect(preferences.actionNotifications()).toBeTrue();
      expect(getActionNotificationsToggle()?.checked).toBeTrue();
    });
  });

  describe('Show login tips toggle', () => {
    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    it('renders the login tips toggle', () => {
      expect(getLoginTipsToggle()).toBeTruthy();
    });

    it('defaults to on when no localStorage key is set', () => {
      expect(comp.showLoginTips()).toBeTrue();
      expect(getLoginTipsToggle()?.checked).toBeTrue();
    });

    it('reflects localStorage key when already set before component creation', () => {
      localStorage.setItem('yotara_loginTipDismissed', 'true');
      fixture = TestBed.createComponent(SettingsPageComponent);
      comp = fixture.componentInstance as any;
      fixture.detectChanges();

      expect(getLoginTipsToggle()?.checked).toBeFalse();
    });

    it('persists to localStorage when toggled off', () => {
      getLoginTipsToggle()?.click();
      fixture.detectChanges();

      expect(localStorage.getItem('yotara_loginTipDismissed')).toBe('true');
      expect(getLoginTipsToggle()?.checked).toBeFalse();
    });

    it('persists to localStorage when toggled back on', () => {
      localStorage.setItem('yotara_loginTipDismissed', 'true');
      fixture = TestBed.createComponent(SettingsPageComponent);
      comp = fixture.componentInstance as any;
      fixture.detectChanges();

      getLoginTipsToggle()?.click();
      fixture.detectChanges();

      expect(localStorage.getItem('yotara_loginTipDismissed')).toBe('false');
      expect(getLoginTipsToggle()?.checked).toBeTrue();
    });

    it('is not affected by session-only dismissal', () => {
      preferences.setLoginTipDismissed(true, false);
      fixture.detectChanges();

      expect(getLoginTipsToggle()?.checked).toBeTrue();
    });
  });

  describe('delete account modal', () => {
    it('fetches counts and opens modal when openDeleteAccountModal is called', async () => {
      await comp.openDeleteAccountModal();
      fixture.detectChanges();

      expect(comp.isDeleteAccountOpen()).toBeTrue();
      expect(comp.dataCounts()).toEqual({ tasks: 5, projects: 3, labels: 2 });
    });

    it('sets zero counts on error and still opens modal', async () => {
      const mockAuthState = TestBed.inject(AuthStateService) as any;
      mockAuthState.getCounts.and.rejectWith(new Error('network error'));

      await comp.openDeleteAccountModal();
      fixture.detectChanges();

      expect(comp.isDeleteAccountOpen()).toBeTrue();
      expect(comp.dataCounts()).toEqual({ tasks: 0, projects: 0, labels: 0 });
    });

    it('closes modal when onDeleteAccount is called', async () => {
      await comp.openDeleteAccountModal();
      fixture.detectChanges();

      expect(comp.isDeleteAccountOpen()).toBeTrue();

      await comp.onDeleteAccount();
      fixture.detectChanges();

      expect(comp.isDeleteAccountOpen()).toBeFalse();
    });
  });

  it('desktop notifications toggle is rendered', () => {
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('.settings-toggle'));
    const desktopItem = items.find((el) =>
      el.nativeElement.textContent.includes('Desktop notifications'),
    );
    expect(desktopItem).toBeTruthy();
  });

  it('desktop notifications toggle requests permission when turned on from default', async () => {
    const notifService = TestBed.inject(NotificationService) as any;
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('.settings-toggle'));
    const desktopItem = items.find((el) =>
      el.nativeElement.textContent.includes('Desktop notifications'),
    );
    const checkbox = desktopItem?.query(By.css('input[type="checkbox"]'));
    expect(checkbox).toBeTruthy();

    // Simulate checking the box
    checkbox!.nativeElement.checked = true;
    checkbox!.nativeElement.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // Wait for async requestPermission call
    await fixture.whenStable();
    expect(notifService.requestPermission).toHaveBeenCalled();
    expect(preferences.desktopNotifications()).toBeTrue();
  });

  describe('export tasks as JSON', () => {
    it('downloads a JSON file when export format is json', async () => {
      comp.exportFormat.set('json');
      await comp.exportTasks();

      expect(anchor.download).toBe('yotara-tasks.json');
      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('includes project and label mappings in JSON output', async () => {
      comp.exportFormat.set('json');
      await comp.exportTasks();
      const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
      const json = JSON.parse(await blob.text());

      expect(json.length).toBe(5);
      const active = json.find((t: any) => t.title === 'Active task');
      expect(active.project).toBe('Work');
      expect(active.labels).toEqual(['urgent']);
    });

    it('respects includeDescriptions toggle in JSON output', async () => {
      comp.exportFormat.set('json');
      comp.includeDescriptions.set(false);
      await comp.exportTasks();
      const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
      const json = JSON.parse(await blob.text());

      for (const task of json) {
        expect(task.description).toBeUndefined();
      }
    });

    it('includes recurrence field when toggled on in JSON output', async () => {
      comp.exportFormat.set('json');
      comp.includeRecurrence.set(true);
      await comp.exportTasks();
      const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
      const json = JSON.parse(await blob.text());
      const archived = json.find((t: any) => t.title === 'Archived task');

      expect(archived.recurrence).toBe('weekly every 1');
    });
  });

  describe('export projects as JSON', () => {
    it('downloads a JSON file when export format is json', async () => {
      comp.exportFormat.set('json');
      comp.exportProjects();

      expect(anchor.download).toBe('yotara-projects.json');
      const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
      const json = JSON.parse(await blob.text());

      expect(json.length).toBe(2);
      expect(json[0].name).toBe('Work');
      expect(json[0].taskCount).toBe(2);
    });
  });

  describe('export labels as JSON', () => {
    it('downloads a JSON file when export format is json', async () => {
      comp.exportFormat.set('json');
      comp.exportLabels();

      expect(anchor.download).toBe('yotara-labels.json');
      const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
      const json = JSON.parse(await blob.text());

      expect(json.length).toBe(2);
      expect(json[0].name).toBe('urgent');
      expect(json[0].color).toBe('#ff0000');
    });
  });

  describe('onThemeChange', () => {
    it('delegates to themeService.setTheme', () => {
      const themeService = TestBed.inject(ThemeService) as any;
      const event = { target: { value: 'dark-ocean' } } as unknown as Event;

      comp.onThemeChange(event);

      expect(themeService.setTheme).toHaveBeenCalledWith('dark-ocean');
    });
  });

  describe('onArchiveCleanupChange', () => {
    it('saves checkbox state via authState.updateProfile', async () => {
      const authState = TestBed.inject(AuthStateService) as any;
      const event = { target: { checked: false } } as unknown as Event;

      await comp.onArchiveCleanupChange(event);

      expect(authState.updateProfile).toHaveBeenCalledWith({ archiveAutoDelete: false });
    });
  });

  describe('onCaptureBehaviorChange', () => {
    it('saves select value via authState.updateProfile', async () => {
      const authState = TestBed.inject(AuthStateService) as any;
      const event = { target: { value: 'capture' } } as unknown as Event;

      await comp.onCaptureBehaviorChange(event);

      expect(authState.updateProfile).toHaveBeenCalledWith({ captureBehavior: 'capture' });
    });
  });

  describe('onShowInsightsChange', () => {
    it('persists the insights preference', () => {
      const event = { target: { checked: false } } as unknown as Event;

      comp.onShowInsightsChange(event);

      expect(preferences.insightDismissed()).toBeTrue();
    });
  });

  describe('onLogout', () => {
    it('calls signOut and navigates to login', async () => {
      const authState = TestBed.inject(AuthStateService) as any;
      const router = TestBed.inject(Router);

      await comp.onLogout();

      expect(authState.signOut).toHaveBeenCalled();
      expect(comp.isLoggingOut()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
