import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { DateTime } from 'luxon';
import { provideMarkdown } from 'ngx-markdown';
import { PersonalTaskCardComponent } from './personal-task-card.component';
import { Task } from '@yotara/shared';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { StatusService } from '../../../core/services/status.service';
import { LabelService } from '../../../core/services/label.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('PersonalTaskCardComponent', () => {
  let component: PersonalTaskCardComponent;
  let fixture: ComponentFixture<PersonalTaskCardComponent>;
  let taskServiceSpy: jasmine.SpyObj<TaskService>;
  let statusServiceSpy: jasmine.SpyObj<StatusService>;
  let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
  let preferences: PreferencesStore;

  function setTask(task: Task) {
    fixture.componentRef.setInput('task', task);
  }

  const mockTask: Task = {
    id: 'task-1',
    title: 'Write morning pages',
    description: 'Reflect on the day ahead',
    status: 'inbox',
    priority: 'medium',
    completed: false,
    createdAt: '2026-04-17T10:00:00Z',
    updatedAt: '2026-04-17T10:00:00Z',
    order: 0,
    dueDate: '2026-04-20T00:00:00Z',
    simpleMode: true,
  };

  const mockLabels = [
    { id: 'label-1', name: 'Urgent', color: '#d44d3c', userId: 'user-1' },
    { id: 'label-2', name: 'Errand', color: '#f1c582', userId: 'user-1' },
    { id: 'label-3', name: 'Idea', color: '#82d7a9', userId: 'user-1' },
    { id: 'label-deleted', name: 'Ghost', color: '#82d7a9', userId: 'user-1' },
  ];
  let labelServiceStub: {
    labels: ReturnType<typeof signal>;
    labelById: () => Map<string, unknown>;
  };

  beforeEach(async () => {
    taskServiceSpy = jasmine.createSpyObj<TaskService>('TaskService', ['updateTask']);
    statusServiceSpy = jasmine.createSpyObj<StatusService>('StatusService', [
      'success',
      'error',
      'show',
      'remove',
    ]);
    notificationServiceSpy = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'showBrowserNotification',
    ]);
    localStorage.clear();
    labelServiceStub = {
      labels: signal(mockLabels),
      labelById: () => new Map(mockLabels.map((label) => [label.id, label])),
    };

    await TestBed.configureTestingModule({
      imports: [PersonalTaskCardComponent],
      providers: [
        { provide: TaskService, useValue: taskServiceSpy },
        { provide: StatusService, useValue: statusServiceSpy },
        { provide: NotificationService, useValue: notificationServiceSpy },
        { provide: LabelService, useValue: labelServiceStub },
        { provide: ProjectService, useValue: { projects: signal([]) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        provideMarkdown(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalTaskCardComponent);
    component = fixture.componentInstance;
    preferences = TestBed.inject(PreferencesStore);
  });

  describe('Component initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should have default input values', () => {
      expect(component.tone).toBe('default');
      expect(component.showDescription).toBe(true);
      expect(component.showCompletionState).toBe(false);
      expect(component.interactive).toBe(false);
    });

    it('should throw error if task is not provided', () => {
      expect(() => {
        fixture.detectChanges();
      }).toThrow();
    });
  });

  describe('Task rendering', () => {
    beforeEach(() => {
      setTask(mockTask);
      fixture.detectChanges();
    });

    it('should render task title', () => {
      const titleEl = fixture.debugElement.query(By.css('h3'));
      expect(titleEl.nativeElement.textContent).toContain('Write morning pages');
    });

    it('should render priority chip', () => {
      const priorityChip = fixture.debugElement.query(By.css('.priority-chip'));
      expect(priorityChip.nativeElement.textContent).toContain('medium priority');
      expect(priorityChip.nativeElement.classList.contains('priority-chip-medium')).toBe(true);
    });

    it('should render task description when showDescription is true', async () => {
      component.showDescription = true;
      fixture.detectChanges();
      await fixture.whenStable();
      const description = fixture.debugElement.query(By.css('.task-description'));
      expect(description.nativeElement.textContent).toContain('Reflect on the day ahead');
    });

    it('should hide task description when showDescription is false', () => {
      component.showDescription = false;
      fixture.detectChanges();
      const description = fixture.debugElement.query(By.css('.task-description'));
      expect(description).toBeNull();
    });

    it('should render due date meta pill', () => {
      const datePills = fixture.debugElement.queryAll(By.css('.meta-pill'));
      const datePill = datePills.find((el) => el.nativeElement.textContent.includes('Apr'));
      expect(datePill).toBeTruthy();
      expect(datePill?.nativeElement.textContent).toContain('Apr 20');
    });

    it('should render status meta pill', () => {
      const statusPills = fixture.debugElement.queryAll(By.css('.meta-pill-muted'));
      expect(statusPills.length).toBeGreaterThan(0);
      expect(statusPills[0].nativeElement.textContent).toContain('Inbox');
    });

    it('should render simple mode meta pill when simpleMode is true', () => {
      const simpleModePill = fixture.debugElement.query(By.css('.meta-pill-simple'));
      expect(simpleModePill.nativeElement.textContent).toContain('Simple mode');
    });

    it('should not render simple mode pill when simpleMode is false', () => {
      setTask({ ...mockTask, simpleMode: false });
      fixture.detectChanges();
      const simpleModePill = fixture.debugElement.query(By.css('.meta-pill-simple'));
      expect(simpleModePill).toBeNull();
    });

    it('should not render completion pill when showCompletionState is false and task is complete', () => {
      setTask({ ...mockTask, completed: true });
      component.showCompletionState = false;
      fixture.detectChanges();
      const completePill = fixture.debugElement.query(By.css('.meta-pill-complete'));
      expect(completePill).toBeNull();
    });

    it('should render completion pill when showCompletionState is true and task is complete', () => {
      setTask({ ...mockTask, completed: true });
      component.showCompletionState = true;
      fixture.detectChanges();
      const completePill = fixture.debugElement.query(By.css('.meta-pill-complete'));
      expect(completePill.nativeElement.textContent).toContain('Done');
    });

    it('should not render due date when dueDate is not provided', () => {
      const { dueDate, ...taskWithoutDate } = mockTask;
      setTask(taskWithoutDate as Task);
      fixture.detectChanges();
      const datePills = fixture.debugElement.queryAll(By.css('.meta-pill'));
      const hasDatePill = datePills.some((el) => el.nativeElement.textContent.includes('Apr'));
      expect(hasDatePill).toBe(false);
    });
  });

  describe('Visual classes and styling', () => {
    beforeEach(() => {
      setTask(mockTask);
    });

    it('should add overdue class when tone is overdue', () => {
      component.tone = 'overdue';
      fixture.detectChanges();
      const card = fixture.debugElement.query(By.css('.task-card'));
      expect(card.nativeElement.classList.contains('task-card-overdue')).toBe(true);
    });

    it('should not add overdue class when tone is default', () => {
      component.tone = 'default';
      fixture.detectChanges();
      const card = fixture.debugElement.query(By.css('.task-card'));
      expect(card.nativeElement.classList.contains('task-card-overdue')).toBe(false);
    });

    it('should add complete class when task is completed', () => {
      setTask({ ...mockTask, completed: true });
      fixture.detectChanges();
      const card = fixture.debugElement.query(By.css('.task-card'));
      expect(card.nativeElement.classList.contains('task-card-complete')).toBe(true);
    });

    it('should add interactive class when interactive is true', () => {
      component.interactive = true;
      fixture.detectChanges();
      const card = fixture.debugElement.query(By.css('.task-card'));
      expect(card.nativeElement.classList.contains('task-card-interactive')).toBe(true);
    });

    it('should show checkmark when task is completed', () => {
      setTask({ ...mockTask, completed: true });
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.task-check-box'));
      expect(box).toBeTruthy();
      expect(box.nativeElement.querySelector('.task-check-mark')).toBeTruthy();
    });

    it('should add complete class to checkbox when task is completed', () => {
      setTask({ ...mockTask, completed: true });
      fixture.detectChanges();
      const checkbox = fixture.debugElement.query(By.css('.task-check'));
      expect(checkbox.nativeElement.classList.contains('task-check-complete')).toBe(true);
    });

    it('should add strikethrough to title when task is completed', () => {
      setTask({ ...mockTask, completed: true });
      fixture.detectChanges();
      const title = fixture.debugElement.query(By.css('h3'));
      const styles = window.getComputedStyle(title.nativeElement);
      expect(styles.textDecoration).toContain('line-through');
    });

    it('should have cursor pointer when interactive is true', () => {
      component.interactive = true;
      fixture.detectChanges();
      const card = fixture.debugElement.query(By.css('.task-card'));
      const styles = window.getComputedStyle(card.nativeElement);
      expect(styles.cursor).toBe('pointer');
    });
  });

  describe('Events', () => {
    beforeEach(() => {
      setTask(mockTask);
      fixture.detectChanges();
    });

    it('should emit select event when card is clicked', () => {
      spyOn(component.select, 'emit');
      const card = fixture.debugElement.query(By.css('.task-card'));
      card.nativeElement.click();
      expect(component.select.emit).toHaveBeenCalledWith();
    });

    it('gives keyboard users a title button instead of a role=button card', () => {
      component.interactive = true;
      fixture.detectChanges();
      spyOn(component.select, 'emit');

      const card = fixture.debugElement.query(By.css('.task-card'));
      expect(card.nativeElement.getAttribute('role')).toBeNull();
      expect(card.nativeElement.getAttribute('tabindex')).toBeNull();

      const titleButton = fixture.debugElement.query(By.css('.task-title-button'));
      expect(titleButton).toBeTruthy();
      titleButton.nativeElement.click();

      expect(component.select.emit).toHaveBeenCalledTimes(1);
    });

    it('should complete the task when the check button is clicked', () => {
      setTask(mockTask);
      fixture.detectChanges();

      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      checkButton.nativeElement.click();

      expect(fixture.debugElement.query(By.css('app-confirm-dialog'))).toBeTruthy();
      expect(taskServiceSpy.updateTask).not.toHaveBeenCalled();
    });

    it('should complete the task after confirming in the modal', async () => {
      setTask(mockTask);
      fixture.detectChanges();

      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      checkButton.nativeElement.click();
      fixture.detectChanges();

      const confirmButton = fixture.debugElement.query(By.css('.primary-button'));
      await confirmButton.nativeElement.click();
      fixture.detectChanges();

      expect(taskServiceSpy.updateTask).toHaveBeenCalledWith('task-1', { completed: true });
    });

    it('should open the restore modal when the completed checkmark is clicked', () => {
      setTask({ ...mockTask, completed: true });
      fixture.detectChanges();

      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      checkButton.nativeElement.click();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('app-confirm-dialog'))).toBeTruthy();
    });

    it('should not bubble the check click to the card', () => {
      setTask(mockTask);
      fixture.detectChanges();

      spyOn(component.select, 'emit');
      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      checkButton.nativeElement.click();

      expect(component.select.emit).not.toHaveBeenCalled();
    });

    it('should emit select event even when not interactive', () => {
      component.interactive = false;
      fixture.detectChanges();
      spyOn(component.select, 'emit');
      const card = fixture.debugElement.query(By.css('.task-card'));
      card.nativeElement.click();
      expect(component.select.emit).toHaveBeenCalledWith();
    });

    it('should skip the confirm dialog when localStorage skip flag is set', async () => {
      preferences.setSkipCompleteConfirm(true);
      setTask(mockTask);
      fixture.detectChanges();

      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      await checkButton.nativeElement.click();
      fixture.detectChanges();

      expect(taskServiceSpy.updateTask).toHaveBeenCalledWith('task-1', { completed: true });
      expect((component as any).completeConfirmOpen()).toBeFalse();
    });

    it('shows a completion notification when a task is completed', async () => {
      preferences.setSkipCompleteConfirm(true);
      setTask(mockTask);
      fixture.detectChanges();

      await component.completeTask();

      expect(statusServiceSpy.success).toHaveBeenCalledWith('Task completed');
    });

    it('names Archive when an Inbox task is completed', async () => {
      preferences.setSkipCompleteConfirm(true);
      setTask({ ...mockTask, status: 'inbox', dueDate: undefined, projectId: undefined });
      fixture.componentRef.setInput('fromInbox', true);
      fixture.detectChanges();

      await component.completeTask();

      expect(statusServiceSpy.success).toHaveBeenCalledWith(
        '"Write morning pages" completed and moved to Archive',
        3000,
        jasmine.objectContaining({
          key: 'task-movement:task-1',
          action: jasmine.objectContaining({ label: 'View' }),
        }),
      );
    });

    it('does not show a completion notification when action notifications are disabled', async () => {
      preferences.setSkipCompleteConfirm(true);
      preferences.setActionNotifications(false);
      setTask(mockTask);
      fixture.detectChanges();

      await component.completeTask();

      expect(statusServiceSpy.success).not.toHaveBeenCalled();
    });

    it('should save skip preference to localStorage when checkbox is checked and confirmed', async () => {
      preferences.setSkipCompleteConfirm(false);
      setTask(mockTask);
      fixture.detectChanges();

      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      checkButton.nativeElement.click();
      fixture.detectChanges();

      const checkbox = fixture.debugElement.query(
        By.css('.skip-confirm-label input[type="checkbox"]'),
      );
      checkbox.nativeElement.click();
      fixture.detectChanges();

      const confirmButton = fixture.debugElement.query(By.css('.primary-button'));
      await confirmButton.nativeElement.click();
      fixture.detectChanges();

      expect(preferences.skipCompleteConfirm()).toBeTrue();
      expect(taskServiceSpy.updateTask).toHaveBeenCalledWith('task-1', { completed: true });
    });

    it('should not save skip preference when checkbox is unchecked and confirmed', async () => {
      preferences.setSkipCompleteConfirm(false);
      setTask(mockTask);
      fixture.detectChanges();

      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      checkButton.nativeElement.click();
      fixture.detectChanges();

      const confirmButton = fixture.debugElement.query(By.css('.primary-button'));
      await confirmButton.nativeElement.click();
      fixture.detectChanges();

      expect(preferences.skipCompleteConfirm()).toBeFalse();
    });
  });

  describe('Label formatting', () => {
    beforeEach(() => {
      setTask(mockTask);
    });

    it('should format priority label correctly', () => {
      setTask({ ...mockTask, priority: 'high' });
      fixture.detectChanges();
      expect(component['priorityLabel']()).toBe('high priority');
    });

    it('should format status label for inbox', () => {
      setTask({ ...mockTask, status: 'inbox' });
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Inbox');
    });

    it('should format status label for today', () => {
      setTask({ ...mockTask, status: 'today' });
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Today');
    });

    it('should format status label for upcoming', () => {
      setTask({ ...mockTask, status: 'upcoming' });
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Upcoming');
    });

    it('should format status label for done', () => {
      setTask({ ...mockTask, status: 'done' });
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Complete');
    });

    it('should format status label for archived', () => {
      setTask({ ...mockTask, status: 'archived' });
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Archived');
    });

    it('should format status label as overdue when rendered in overdue tone', () => {
      component.tone = 'overdue';
      setTask({ ...mockTask, status: 'today' });
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Overdue');
    });

    it('should present an undated filed task as Unscheduled instead of Inbox', () => {
      setTask({ ...mockTask, status: 'inbox', projectId: 'project-1', dueDate: undefined });
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Unscheduled');
    });

    it('should derive a filed task status from its date', () => {
      setTask({
        ...mockTask,
        status: 'inbox',
        projectId: 'project-1',
        dueDate: DateTime.now().toISODate()!,
      });
      expect(component['statusLabel']()).toBe('Today');

      setTask({
        ...mockTask,
        status: 'inbox',
        projectId: 'project-1',
        dueDate: DateTime.now().plus({ days: 2 }).toISODate()!,
      });
      expect(component['statusLabel']()).toBe('Upcoming');

      setTask({
        ...mockTask,
        status: 'inbox',
        projectId: 'project-1',
        dueDate: DateTime.now().minus({ days: 2 }).toISODate()!,
      });
      expect(component['statusLabel']()).toBe('Overdue');
    });

    it('should format date label correctly', () => {
      setTask({ ...mockTask, dueDate: '2026-04-20T00:00:00Z' });
      fixture.detectChanges();
      const dateLabel = component['dateLabel']();
      expect(dateLabel).toContain('Apr');
      expect(dateLabel).toContain('20');
    });

    it('should show the due time only when one is set', () => {
      setTask({ ...mockTask, dueDate: '2026-04-20', dueTime: '15:30' });
      fixture.detectChanges();
      expect(component['dateLabel']()).toContain('Apr');
      expect(component['dateLabel']()).toContain('3:30 PM');

      setTask({ ...mockTask, dueDate: '2026-04-20' });
      fixture.detectChanges();
      expect(component['dateLabel']()).not.toContain('PM');
    });

    it('should return empty string for invalid date', () => {
      setTask({ ...mockTask, dueDate: 'invalid-date' });
      fixture.detectChanges();
      expect(component['dateLabel']()).toBe('');
    });

    it('should return empty string when dueDate is not provided', () => {
      const { dueDate, ...taskWithoutDate } = mockTask;
      setTask(taskWithoutDate as Task);
      fixture.detectChanges();
      expect(component['dateLabel']()).toBe('');
    });
  });

  describe('Priority chip styling', () => {
    beforeEach(() => {
      setTask(mockTask);
    });

    it('should apply high priority class', () => {
      setTask({ ...mockTask, priority: 'high' });
      fixture.detectChanges();
      const chip = fixture.debugElement.query(By.css('.priority-chip'));
      expect(chip.nativeElement.classList.contains('priority-chip-high')).toBe(true);
    });

    it('should apply medium priority class', () => {
      setTask({ ...mockTask, priority: 'medium' });
      fixture.detectChanges();
      const chip = fixture.debugElement.query(By.css('.priority-chip'));
      expect(chip.nativeElement.classList.contains('priority-chip-medium')).toBe(true);
    });

    it('should apply low priority class', () => {
      setTask({ ...mockTask, priority: 'low' });
      fixture.detectChanges();
      const chip = fixture.debugElement.query(By.css('.priority-chip'));
      expect(chip.nativeElement.classList.contains('priority-chip-low')).toBe(true);
    });
  });

  describe('Different task statuses', () => {
    beforeEach(() => {
      setTask(mockTask);
    });

    it('should render task with status today', () => {
      setTask({ ...mockTask, status: 'today' });
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });

    it('should render task with status upcoming', () => {
      setTask({ ...mockTask, status: 'upcoming' });
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });

    it('should render task with status done', () => {
      setTask({ ...mockTask, status: 'done' });
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });

    it('should render task with status archived', () => {
      setTask({ ...mockTask, status: 'archived' });
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('should render task with no description', () => {
      const { description, ...taskWithoutDescription } = mockTask;
      setTask(taskWithoutDescription as Task);
      fixture.detectChanges();
      const descElement = fixture.debugElement.query(By.css('.task-description'));
      expect(descElement).toBeNull();
    });

    it('should handle task title with special characters', () => {
      setTask({ ...mockTask, title: 'Task & "special" <characters>' });
      fixture.detectChanges();
      const title = fixture.debugElement.query(By.css('h3'));
      expect(title.nativeElement.textContent).toContain('Task & "special" <characters>');
    });

    it('should render task with all optional fields populated', () => {
      setTask(mockTask);
      component.showDescription = true;
      component.showCompletionState = true;
      component.interactive = true;
      component.tone = 'default';
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });

    it('should render task with minimal data', () => {
      const minimalTask: Task = {
        id: 'task-2',
        title: 'Minimal task',
        status: 'inbox',
        priority: 'low',
        completed: false,
        createdAt: '2026-04-17T10:00:00Z',
        updatedAt: '2026-04-17T10:00:00Z',
        order: 1,
        simpleMode: false,
      };
      setTask(minimalTask);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
      expect(fixture.debugElement.query(By.css('h3')).nativeElement.textContent).toContain(
        'Minimal task',
      );
    });
  });

  it('announces a completion with a toast but no browser notification', async () => {
    setTask({ ...mockTask });
    component.interactive = true;
    preferences.setSkipCompleteConfirm(true);
    taskServiceSpy.updateTask.and.resolveTo({ ...mockTask, completed: true });
    fixture.detectChanges();

    await component.completeTask();

    expect(statusServiceSpy.success).toHaveBeenCalledWith('Task completed');
    expect(notificationServiceSpy.showBrowserNotification).not.toHaveBeenCalled();
  });

  describe('Recurrence labels', () => {
    beforeEach(() => {
      setTask(mockTask);
    });

    it('returns empty string when no recurrence rule', () => {
      setTask({ ...mockTask, recurrenceRule: undefined });
      fixture.detectChanges();
      expect((component as any).recurrenceLabel()).toBe('');
    });

    it('returns Weekdays for weekday frequency', () => {
      setTask({
        ...mockTask,
        recurrenceRule: { frequency: 'weekdays', interval: 1, daysOfWeek: undefined },
      });
      fixture.detectChanges();
      expect((component as any).recurrenceLabel()).toBe('Weekdays');
    });

    it('returns weekly day names with interval 1', () => {
      setTask({
        ...mockTask,
        recurrenceRule: { frequency: 'weekly', interval: 1, daysOfWeek: [1, 3, 5] },
      });
      fixture.detectChanges();
      expect((component as any).recurrenceLabel()).toBe('Mon, Wed, Fri');
    });

    it('returns weekly with interval > 1', () => {
      setTask({
        ...mockTask,
        recurrenceRule: { frequency: 'weekly', interval: 2, daysOfWeek: [1, 3] },
      });
      fixture.detectChanges();
      expect((component as any).recurrenceLabel()).toBe('Every 2 weeks (Mon, Wed)');
    });

    it('returns capitalized frequency for non-weekly', () => {
      setTask({
        ...mockTask,
        recurrenceRule: { frequency: 'daily', interval: 1, daysOfWeek: undefined },
      });
      fixture.detectChanges();
      expect((component as any).recurrenceLabel()).toBe('Daily');
    });

    it('returns Every N frequency for non-weekly with interval > 1', () => {
      setTask({
        ...mockTask,
        recurrenceRule: { frequency: 'monthly', interval: 3, daysOfWeek: undefined },
      });
      fixture.detectChanges();
      expect((component as any).recurrenceLabel()).toBe('Every 3 monthly');
    });
  });

  describe('Truncated description', () => {
    beforeEach(() => {
      setTask(mockTask);
    });

    it('returns short description as-is', () => {
      setTask({ ...mockTask, description: 'Short desc' });
      fixture.detectChanges();
      expect((component as any).truncatedDescription()).toBe('Short desc');
    });

    it('truncates description longer than 500 chars', () => {
      const longDesc = 'A'.repeat(600);
      setTask({ ...mockTask, description: longDesc });
      fixture.detectChanges();
      const result = (component as any).truncatedDescription();
      expect(result.length).toBe(500);
      expect(result.endsWith('...')).toBeTrue();
    });

    it('returns undefined when no description', () => {
      const { description, ...taskNoDesc } = mockTask;
      setTask(taskNoDesc as Task);
      fixture.detectChanges();
      expect((component as any).truncatedDescription()).toBeUndefined();
    });
  });

  describe('Subtask computed', () => {
    it('subtaskAllDone is true when all subtasks are complete', () => {
      setTask({
        ...mockTask,
        subtaskCount: 3,
        subtaskCompletedCount: 3,
      });
      fixture.detectChanges();
      expect((component as any).subtaskAllDone()).toBeTrue();
    });

    it('subtaskAllDone is false when some subtasks are incomplete', () => {
      setTask({
        ...mockTask,
        subtaskCount: 3,
        subtaskCompletedCount: 1,
      });
      fixture.detectChanges();
      expect((component as any).subtaskAllDone()).toBeFalse();
    });

    it('subtaskAllDone is false when there are no subtasks', () => {
      setTask({ ...mockTask });
      fixture.detectChanges();
      expect((component as any).subtaskAllDone()).toBeFalse();
    });

    it('updates the subtask counts when the task input changes', () => {
      setTask({ ...mockTask, subtaskCount: 3, subtaskCompletedCount: 1 });
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css('.subtask-pill-partial')).nativeElement.textContent,
      ).toContain('1 / 3');

      setTask({ ...mockTask, subtaskCount: 3, subtaskCompletedCount: 3 });
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css('.subtask-pill-done')).nativeElement.textContent,
      ).toContain('3 / 3');
    });
  });

  describe('closeCompleteConfirm', () => {
    it('closes the confirm dialog', () => {
      setTask(mockTask);
      fixture.detectChanges();

      (component as any).completeConfirmOpen.set(true);
      (component as any).closeCompleteConfirm();
      expect((component as any).completeConfirmOpen()).toBeFalse();
    });
  });

  describe('non-interactive cards', () => {
    it('renders the title as text without a keyboard control', () => {
      setTask(mockTask);
      component.interactive = false;
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.task-title-button'))).toBeNull();
    });
  });

  describe('label chip filtering', () => {
    it('emits labelSelect from a chip without opening the card', () => {
      setTask({ ...mockTask, labels: ['label-1'] });
      fixture.detectChanges();
      spyOn(component.labelSelect, 'emit');
      spyOn(component.select, 'emit');

      const chipButton = fixture.debugElement.query(
        By.css('.task-badges-labels app-label-chip button'),
      );
      chipButton.nativeElement.click();

      expect(component.labelSelect.emit).toHaveBeenCalledTimes(1);
      expect(component.labelSelect.emit).toHaveBeenCalledWith(
        jasmine.objectContaining({ id: 'label-1' }),
      );
      expect(component.select.emit).not.toHaveBeenCalled();
    });

    it('uses compact icon chips and a reveal control when names are off', () => {
      preferences.setShowLabelNames(false);
      setTask({ ...mockTask, labels: ['label-1', 'label-2'] });
      fixture.detectChanges();

      const chips = fixture.debugElement.queryAll(By.css('.task-badges-labels app-label-chip'));
      expect(chips.length).toBe(2);
      expect(chips[0].componentInstance.mode).toBe('compact');
      expect(chips[0].nativeElement.textContent).toContain('Label: Urgent');

      const reveal = fixture.debugElement.query(By.css('.task-label-reveal'));
      expect(reveal).toBeTruthy();
      expect(reveal.nativeElement.getAttribute('aria-label')).toContain('Show all 2 labels');
    });

    it('fills chips with the label color when color-first is on', () => {
      preferences.setColorFirstLabels(true);
      setTask({ ...mockTask, labels: ['label-1'] });
      fixture.detectChanges();

      const chip = fixture.debugElement.query(By.css('.task-badges-labels app-label-chip'));
      expect(chip.componentInstance.colorFirst).toBeTrue();
      expect(chip.nativeElement.classList).toContain('label-chip-color-first');
    });

    it('suppresses every active filter label', () => {
      setTask({ ...mockTask, labels: ['label-1', 'label-2', 'label-3'] });
      fixture.componentRef.setInput('suppressLabelIds', ['label-1', 'label-3']);
      fixture.detectChanges();

      const names = fixture.debugElement
        .queryAll(By.css('.task-badges-labels app-label-chip .label-chip-name'))
        .map((chip) => chip.nativeElement.textContent.trim());
      expect(names).toEqual(['Errand']);
    });

    it('re-renders chips when the task input changes', () => {
      setTask({ ...mockTask, labels: [] });
      fixture.detectChanges();
      expect(
        fixture.debugElement.queryAll(By.css('.task-badges-labels app-label-chip')).length,
      ).toBe(0);

      setTask({ ...mockTask, labels: ['label-1'] });
      fixture.detectChanges();
      const names = fixture.debugElement
        .queryAll(By.css('.task-badges-labels app-label-chip .label-chip-name'))
        .map((chip) => chip.nativeElement.textContent.trim());
      expect(names).toEqual(['Urgent']);
    });

    it('re-renders chips when the suppression input changes', () => {
      setTask({ ...mockTask, labels: ['label-1', 'label-2'] });
      fixture.detectChanges();
      expect(
        fixture.debugElement
          .queryAll(By.css('.task-badges-labels app-label-chip .label-chip-name'))
          .map((chip) => chip.nativeElement.textContent.trim()),
      ).toEqual(['Urgent', 'Errand']);

      fixture.componentRef.setInput('suppressLabelIds', ['label-1']);
      fixture.detectChanges();
      const names = fixture.debugElement
        .queryAll(By.css('.task-badges-labels app-label-chip .label-chip-name'))
        .map((chip) => chip.nativeElement.textContent.trim());
      expect(names).toEqual(['Errand']);
    });
  });

  describe('Narrow-card wrapping', () => {
    beforeEach(() => {
      setTask({
        ...mockTask,
        title: 'A very long task title without any spaces whatsoeverjustkeepsgoingandgoing',
        labels: ['label-1'],
      });
      fixture.detectChanges();
    });

    it('allows long titles to wrap instead of forcing overflow', () => {
      const title = fixture.debugElement.query(By.css('h3'));
      const styles = window.getComputedStyle(title.nativeElement);
      expect(styles.whiteSpace).not.toBe('nowrap');
    });

    it('wraps badge groups instead of overflowing', () => {
      const badges = fixture.debugElement.query(By.css('.task-badges'));
      expect(window.getComputedStyle(badges.nativeElement).flexWrap).toBe('wrap');
    });

    it('keeps full metadata in the DOM for modal use', () => {
      expect(fixture.debugElement.query(By.css('.meta-pill-simple'))).toBeTruthy();
    });
  });

  describe('Label chips', () => {
    type ChipOverrides = Partial<Task> & {
      suppressLabelId?: string | null;
      showContextMetadata?: boolean;
    };

    function setup({ suppressLabelId, showContextMetadata, ...taskOverrides }: ChipOverrides) {
      setTask({ ...mockTask, ...taskOverrides } as unknown as Task);
      fixture.componentRef.setInput('suppressLabelId', suppressLabelId ?? null);
      component.showContextMetadata = showContextMetadata ?? true;
      fixture.detectChanges();
      return fixture;
    }

    it('caps inline chips at two and moves the rest behind +N', () => {
      setup({ labels: ['label-1', 'label-2', 'label-3'] });
      expect(
        fixture.debugElement.queryAll(By.css('.task-badges-labels app-label-chip')).length,
      ).toBe(2);
      const overflow = fixture.debugElement.query(By.css('.task-label-overflow'));
      expect(overflow).toBeTruthy();
      expect(overflow.nativeElement.textContent.trim()).toBe('+1');
    });

    it('renders no chips for unknown label IDs', () => {
      setup({ labels: ['label-deleted', 'label-missing'] });
      expect(
        fixture.debugElement.queryAll(By.css('.task-badges-labels app-label-chip')).length,
      ).toBe(1);
    });

    it('suppresses the label being viewed via suppressLabelId', () => {
      setup({ labels: ['label-1', 'label-2'], suppressLabelId: 'label-1' });
      const chipNames = fixture.debugElement
        .queryAll(By.css('.task-badges-labels app-label-chip .label-chip-name'))
        .map((chip) => chip.nativeElement.textContent.trim());
      expect(chipNames).toEqual(['Errand']);
    });

    it('toggles a popover that lists every label name', () => {
      setup({ labels: ['label-1', 'label-2', 'label-3'] });
      expect(fixture.debugElement.query(By.css('.task-label-overflow-menu'))).toBeNull();

      const overflow = fixture.debugElement.query(By.css('.task-label-overflow'));
      overflow.nativeElement.click();
      fixture.detectChanges();

      const menu = fixture.debugElement.query(By.css('.task-label-overflow-menu'));
      expect(menu).toBeTruthy();
      const names = menu
        .queryAll(By.css('app-label-chip .label-chip-name'))
        .map((chip) => chip.nativeElement.textContent.trim());
      expect(names).toEqual(['Urgent', 'Errand', 'Idea']);
    });

    it('keeps the overflow click from opening the task card', () => {
      setup({ labels: ['label-1', 'label-2', 'label-3'] });
      spyOn(component.select, 'emit');

      // A real click event bubbles up to the card's select handler unless the
      // button stops propagation.
      fixture.debugElement.query(By.css('.task-label-overflow')).nativeElement.click();
      fixture.detectChanges();

      expect(component.select.emit).not.toHaveBeenCalled();
    });

    it('handlers: closeLabelOverflow hides the popover', () => {
      setup({ labels: ['label-1', 'label-2', 'label-3'] });
      fixture.debugElement.query(By.css('.task-label-overflow')).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-label-overflow-menu'))).toBeTruthy();

      (component as unknown as { closeLabelOverflow(): void }).closeLabelOverflow();
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-label-overflow-menu'))).toBeNull();
    });

    it('showContextMetadata=false hides status and simple-mode pills', () => {
      setup({ showContextMetadata: false });
      expect(fixture.debugElement.query(By.css('.meta-pill-muted'))).toBeNull();
      expect(fixture.debugElement.query(By.css('.meta-pill-simple'))).toBeNull();
      // Non-ambient metadata stays.
      expect(fixture.debugElement.query(By.css('.priority-chip'))).toBeTruthy();
    });
  });
});
