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
    status: 'archived',
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
      user: signal({ id: 'user-1', archiveAutoDelete: true, captureBehavior: 'quick' }),
      loading: signal(false),
      updateProfile: jasmine.createSpy('updateProfile').and.resolveTo({}),
      signOut: jasmine.createSpy('signOut').and.resolveTo(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        {
          provide: TaskService,
          useValue: { tasks: tasksSignal, fetchAllTasks: () => Promise.resolve([...mockTasks]) },
        },
        { provide: ProjectService, useValue: { projects: projectsSignal } },
        { provide: LabelService, useValue: { labels: labelsSignal } },
        { provide: AuthStateService, useValue: mockAuthState },
        {
          provide: ThemeService,
          useValue: { theme: signal('light-forest'), setTheme: jasmine.createSpy() },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy().and.resolveTo(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPageComponent);
    comp = fixture.componentInstance as any;
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
});
