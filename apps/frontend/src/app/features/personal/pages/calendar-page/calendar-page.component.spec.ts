import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideMarkdown } from 'ngx-markdown';
import { DateTime } from 'luxon';
import { Task } from '@yotara/shared';
import { CalendarPageComponent } from './calendar-page.component';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import { LabelService } from '../../../../core/services/label.service';
import { PreferencesStore } from '../../../../core/services/preferences-store.service';
import { ProjectService } from '../../../../core/services/project.service';
import { StatusService } from '../../../../core/services/status.service';
import { TaskService } from '../../../../core/services/task.service';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'inbox',
    priority: 'medium',
    completed: false,
    order: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  } as Task;
}

describe('CalendarPageComponent', () => {
  let fixture: ComponentFixture<CalendarPageComponent>;
  let allActiveTasks: WritableSignal<Task[]>;
  let undatedTasks: WritableSignal<Task[]>;
  let taskService: {
    allActiveTasks: WritableSignal<Task[]>;
    undatedTasks: WritableSignal<Task[]>;
    loading: WritableSignal<boolean>;
    error: WritableSignal<string | null>;
    updateTask: jasmine.Spy;
    createTask: jasmine.Spy;
  };
  let statusService: jasmine.SpyObj<StatusService>;
  let workspace: PersonalTaskWorkspaceComponent;

  const today = DateTime.now();
  const todayISO = today.toISODate() as string;

  function element<T extends HTMLElement>(selector: string): T {
    const found = fixture.nativeElement.querySelector(selector) as T | null;
    if (!found) {
      throw new Error(`Element not found: ${selector}`);
    }
    return found;
  }

  function findByText(selector: string, text: string): HTMLElement {
    const matches = Array.from(fixture.nativeElement.querySelectorAll(selector)) as HTMLElement[];
    const found = matches.find((element) => element.textContent?.trim() === text);
    if (!found) {
      throw new Error(`No ${selector} with text "${text}"`);
    }
    return found;
  }

  /** The in-month cell whose day number matches. */
  function dayCell(dayNumber: number): HTMLElement {
    const cells = Array.from(fixture.nativeElement.querySelectorAll('.cal-cell')) as HTMLElement[];
    const found = cells.find(
      (cell) =>
        !cell.classList.contains('cal-cell-outside') &&
        cell.querySelector('.cal-day-number')?.textContent?.trim() === String(dayNumber),
    );
    if (!found) {
      throw new Error(`No in-month day cell for ${dayNumber}`);
    }
    return found;
  }

  function openNoDateList(): void {
    element<HTMLButtonElement>('.cal-nodate-btn').click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    allActiveTasks = signal<Task[]>([]);
    undatedTasks = signal<Task[]>([]);

    taskService = {
      allActiveTasks,
      undatedTasks,
      loading: signal(false),
      error: signal<string | null>(null),
      updateTask: jasmine.createSpy('updateTask').and.resolveTo({ id: 'task-1' }),
      createTask: jasmine.createSpy('createTask').and.resolveTo({ id: 'created-task' }),
    };

    statusService = jasmine.createSpyObj<StatusService>('StatusService', [
      'success',
      'error',
      'show',
      'remove',
    ]);

    await TestBed.configureTestingModule({
      imports: [CalendarPageComponent],
      providers: [
        provideMarkdown(),
        provideNoopAnimations(),
        { provide: TaskService, useValue: taskService },
        {
          provide: ProjectService,
          useValue: { projects: signal([]), refresh: jasmine.createSpy('refresh') },
        },
        { provide: StatusService, useValue: statusService },
        {
          provide: LabelService,
          useValue: { labels: signal([]), refresh: jasmine.createSpy('refresh') },
        },
        {
          provide: PreferencesStore,
          useValue: {
            actionNotifications: signal(true),
            setActionNotifications: jasmine.createSpy('setActionNotifications'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();

    workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;
  });

  describe('create with a pre-filled date', () => {
    it('selects the clicked day without opening the create editor', () => {
      spyOn(workspace, 'openCreateTaskModal');
      const otherDay = today.day === 1 ? 2 : 1;

      dayCell(otherDay).click();
      fixture.detectChanges();

      expect(workspace.openCreateTaskModal).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain(
        today.set({ day: otherDay }).toFormat('cccc, LLLL d, yyyy'),
      );
    });

    it('passes the selected date from the panel add action', () => {
      spyOn(workspace, 'openCreateTaskModal');

      element<HTMLButtonElement>('.cal-panel-add').click();

      expect(workspace.openCreateTaskModal).toHaveBeenCalledWith(
        undefined,
        jasmine.objectContaining({ value: todayISO, source: 'manual' }),
      );
    });

    it('passes the selected date from the header New task button', () => {
      spyOn(workspace, 'openCreateTaskModal');

      element<HTMLButtonElement>('.cal-new-btn').click();

      expect(workspace.openCreateTaskModal).toHaveBeenCalledWith(
        undefined,
        jasmine.objectContaining({ value: todayISO, source: 'manual' }),
      );
    });
  });

  describe('complete', () => {
    it('completes from the chip without opening the modal and announces it', async () => {
      allActiveTasks.set([task({ id: 'due-1', title: 'Ship the calendar', dueDate: todayISO })]);
      fixture.detectChanges();

      spyOn(workspace, 'openCreateTaskModal');
      spyOn(workspace, 'editTask');

      element<HTMLButtonElement>('.cal-chip-check').click();
      fixture.detectChanges();

      expect(taskService.updateTask).toHaveBeenCalledWith('due-1', { completed: true });
      expect(workspace.editTask).not.toHaveBeenCalled();
      expect(workspace.openCreateTaskModal).not.toHaveBeenCalled();

      // The chip reads as completed immediately, before the save resolves.
      expect(fixture.nativeElement.querySelector('.cal-chip-check-done')).toBeTruthy();

      // The completion raises the in-app toast (and no OS notification).
      await fixture.whenStable();
      expect(statusService.success).toHaveBeenCalledWith('Task completed');
    });

    it('rolls back the optimistic completion and surfaces an error when the save fails', async () => {
      allActiveTasks.set([task({ id: 'due-1', title: 'Ship the calendar', dueDate: todayISO })]);
      taskService.updateTask.and.returnValue(Promise.reject(new Error('boom')));
      fixture.detectChanges();

      element<HTMLButtonElement>('.cal-chip-check').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.cal-chip-check-done')).toBeTruthy();

      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.cal-chip-check-done')).toBeFalsy();
      expect(statusService.error).toHaveBeenCalledWith(
        'Could not complete the task. Please try again.',
      );
    });

    it('prunes optimistic completion ids once the refreshed list drops the task', () => {
      allActiveTasks.set([task({ id: 'due-1', title: 'Ship the calendar', dueDate: todayISO })]);
      fixture.detectChanges();

      element<HTMLButtonElement>('.cal-chip-check').click();
      fixture.detectChanges();

      const component = fixture.componentInstance as any;
      expect(component.completionIds().has('due-1')).toBe(true);

      allActiveTasks.set([]);
      fixture.detectChanges();

      expect(component.completionIds().has('due-1')).toBe(false);
    });
  });

  describe('quick schedule', () => {
    it('schedules an undated task for today and it leaves the list, then appears on the calendar', () => {
      undatedTasks.set([task({ id: 'undated-1', title: 'Read the brief' })]);
      fixture.detectChanges();

      openNoDateList();
      expect(fixture.nativeElement.textContent).toContain('Read the brief');

      findByText('.cal-quick-btn', 'Today').click();
      fixture.detectChanges();

      // Only dueDate is sent: the due time is never touched.
      expect(taskService.updateTask).toHaveBeenCalledWith('undated-1', { dueDate: todayISO });

      // The row leaves the No date list immediately.
      expect(fixture.nativeElement.querySelector('.cal-nodate-row')).toBeFalsy();

      // After the refresh it is a dated task, so it shows under the day.
      undatedTasks.set([]);
      allActiveTasks.set([task({ id: 'undated-1', title: 'Read the brief', dueDate: todayISO })]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Read the brief');
      expect(fixture.nativeElement.querySelector('.cal-nodate-row')).toBeFalsy();
    });

    it('schedules an undated task for a picked date', () => {
      undatedTasks.set([task({ id: 'undated-1', title: 'Read the brief' })]);
      fixture.detectChanges();
      openNoDateList();

      const picker = fixture.debugElement.query(By.directive(DatePickerComponent))
        .componentInstance as DatePickerComponent;
      picker.valueChange.emit('2026-11-30');
      fixture.detectChanges();

      expect(taskService.updateTask).toHaveBeenCalledWith('undated-1', { dueDate: '2026-11-30' });
    });

    it('rolls back the optimistic removal and surfaces an error when scheduling fails', async () => {
      undatedTasks.set([task({ id: 'undated-1', title: 'Read the brief' })]);
      taskService.updateTask.and.returnValue(Promise.reject(new Error('boom')));
      fixture.detectChanges();
      openNoDateList();

      findByText('.cal-quick-btn', 'Today').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.cal-nodate-row')).toBeFalsy();

      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Read the brief');
      expect(statusService.error).toHaveBeenCalledWith(
        'Could not schedule the task. Please try again.',
      );
    });

    it('schedules for tomorrow from the quick action', () => {
      undatedTasks.set([task({ id: 'undated-1', title: 'Read the brief' })]);
      fixture.detectChanges();
      openNoDateList();

      findByText('.cal-quick-btn', 'Tomorrow').click();
      fixture.detectChanges();

      expect(taskService.updateTask).toHaveBeenCalledWith('undated-1', {
        dueDate: today.plus({ days: 1 }).toISODate() as string,
      });
    });
  });
});
