import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PersonalTaskCardComponent } from './personal-task-card.component';
import { Task } from '@yotara/shared';
import { TaskService } from '../../../core/services/task.service';

describe('PersonalTaskCardComponent', () => {
  let component: PersonalTaskCardComponent;
  let fixture: ComponentFixture<PersonalTaskCardComponent>;
  let taskServiceSpy: jasmine.SpyObj<TaskService>;

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
    bucket: 'personal-sanctuary',
    simpleMode: true,
  };

  beforeEach(async () => {
    taskServiceSpy = jasmine.createSpyObj<TaskService>('TaskService', ['updateTask']);

    await TestBed.configureTestingModule({
      imports: [PersonalTaskCardComponent],
      providers: [{ provide: TaskService, useValue: taskServiceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalTaskCardComponent);
    component = fixture.componentInstance;
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
      component.task = mockTask;
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

    it('should render task description when showDescription is true', () => {
      component.showDescription = true;
      fixture.detectChanges();
      const description = fixture.debugElement.query(By.css('.task-description'));
      expect(description.nativeElement.textContent).toContain('Reflect on the day ahead');
    });

    it('should hide task description when showDescription is false', () => {
      component.showDescription = false;
      fixture.detectChanges();
      const description = fixture.debugElement.query(By.css('.task-description'));
      expect(description).toBeNull();
    });

    it('should render bucket meta pill', () => {
      const bucketPill = fixture.debugElement.query(By.css('.meta-pill-bucket'));
      expect(bucketPill.nativeElement.textContent).toContain('Personal Sanctuary');
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
      component.task = { ...mockTask, simpleMode: false };
      fixture.detectChanges();
      const simpleModePill = fixture.debugElement.query(By.css('.meta-pill-simple'));
      expect(simpleModePill).toBeNull();
    });

    it('should not render completion pill when showCompletionState is false and task is complete', () => {
      component.task = { ...mockTask, completed: true };
      component.showCompletionState = false;
      fixture.detectChanges();
      const completePill = fixture.debugElement.query(By.css('.meta-pill-complete'));
      expect(completePill).toBeNull();
    });

    it('should render completion pill when showCompletionState is true and task is complete', () => {
      component.task = { ...mockTask, completed: true };
      component.showCompletionState = true;
      fixture.detectChanges();
      const completePill = fixture.debugElement.query(By.css('.meta-pill-complete'));
      expect(completePill.nativeElement.textContent).toContain('Done');
    });

    it('should not render bucket pill when bucket is not provided', () => {
      const { bucket, ...taskWithoutBucket } = mockTask;
      component.task = taskWithoutBucket as Task;
      fixture.detectChanges();
      const bucketPill = fixture.debugElement.query(By.css('.meta-pill-bucket'));
      expect(bucketPill).toBeNull();
    });

    it('should not render due date when dueDate is not provided', () => {
      const { dueDate, ...taskWithoutDate } = mockTask;
      component.task = taskWithoutDate as Task;
      fixture.detectChanges();
      const datePills = fixture.debugElement.queryAll(By.css('.meta-pill'));
      const hasDatePill = datePills.some((el) => el.nativeElement.textContent.includes('Apr'));
      expect(hasDatePill).toBe(false);
    });
  });

  describe('Visual classes and styling', () => {
    beforeEach(() => {
      component.task = mockTask;
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
      component.task = { ...mockTask, completed: true };
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
      component.task = { ...mockTask, completed: true };
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.task-check-box'));
      expect(box).toBeTruthy();
      expect(box.nativeElement.querySelector('.task-check-mark')).toBeTruthy();
    });

    it('should add complete class to checkbox when task is completed', () => {
      component.task = { ...mockTask, completed: true };
      fixture.detectChanges();
      const checkbox = fixture.debugElement.query(By.css('.task-check'));
      expect(checkbox.nativeElement.classList.contains('task-check-complete')).toBe(true);
    });

    it('should add strikethrough to title when task is completed', () => {
      component.task = { ...mockTask, completed: true };
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
      component.task = mockTask;
      fixture.detectChanges();
    });

    it('should emit select event when card is clicked', () => {
      spyOn(component.select, 'emit');
      const card = fixture.debugElement.query(By.css('.task-card'));
      card.nativeElement.click();
      expect(component.select.emit).toHaveBeenCalledWith();
    });

    it('should complete the task when the check button is clicked', () => {
      component.task = mockTask;
      fixture.detectChanges();

      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      checkButton.nativeElement.click();

      expect(fixture.debugElement.query(By.css('app-confirm-dialog'))).toBeTruthy();
      expect(taskServiceSpy.updateTask).not.toHaveBeenCalled();
    });

    it('should complete the task after confirming in the modal', async () => {
      component.task = mockTask;
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
      component.task = { ...mockTask, completed: true };
      fixture.detectChanges();

      const checkButton = fixture.debugElement.query(By.css('.task-check'));
      checkButton.nativeElement.click();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('app-confirm-dialog'))).toBeTruthy();
    });

    it('should not bubble the check click to the card', () => {
      component.task = mockTask;
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
  });

  describe('Label formatting', () => {
    beforeEach(() => {
      component.task = mockTask;
    });

    it('should format priority label correctly', () => {
      component.task = { ...mockTask, priority: 'high' };
      fixture.detectChanges();
      expect(component['priorityLabel']()).toBe('high priority');
    });

    it('should format status label for inbox', () => {
      component.task = { ...mockTask, status: 'inbox' };
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Inbox');
    });

    it('should format status label for today', () => {
      component.task = { ...mockTask, status: 'today' };
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Today');
    });

    it('should format status label for upcoming', () => {
      component.task = { ...mockTask, status: 'upcoming' };
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Upcoming');
    });

    it('should format status label for done', () => {
      component.task = { ...mockTask, status: 'done' };
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Complete');
    });

    it('should format status label for archived', () => {
      component.task = { ...mockTask, status: 'archived' };
      fixture.detectChanges();
      expect(component['statusLabel']()).toBe('Archived');
    });

    it('should format date label correctly', () => {
      component.task = { ...mockTask, dueDate: '2026-04-20T00:00:00Z' };
      fixture.detectChanges();
      const dateLabel = component['dateLabel']();
      expect(dateLabel).toContain('Apr');
      expect(dateLabel).toContain('20');
    });

    it('should return empty string for invalid date', () => {
      component.task = { ...mockTask, dueDate: 'invalid-date' };
      fixture.detectChanges();
      expect(component['dateLabel']()).toBe('');
    });

    it('should return empty string when dueDate is not provided', () => {
      const { dueDate, ...taskWithoutDate } = mockTask;
      component.task = taskWithoutDate as Task;
      fixture.detectChanges();
      expect(component['dateLabel']()).toBe('');
    });

    it('should format bucket label for personal-sanctuary', () => {
      component.task = { ...mockTask, bucket: 'personal-sanctuary' };
      fixture.detectChanges();
      expect(component['bucketLabel']()).toBe('Personal Sanctuary');
    });

    it('should format bucket label for deep-work', () => {
      component.task = { ...mockTask, bucket: 'deep-work' };
      fixture.detectChanges();
      expect(component['bucketLabel']()).toBe('Deep Work');
    });

    it('should format bucket label for home', () => {
      component.task = { ...mockTask, bucket: 'home' };
      fixture.detectChanges();
      expect(component['bucketLabel']()).toBe('Home');
    });

    it('should format bucket label for health', () => {
      component.task = { ...mockTask, bucket: 'health' };
      fixture.detectChanges();
      expect(component['bucketLabel']()).toBe('Health');
    });

    it('should return empty string when bucket is not provided', () => {
      const { bucket, ...taskWithoutBucket } = mockTask;
      component.task = taskWithoutBucket as Task;
      fixture.detectChanges();
      expect(component['bucketLabel']()).toBe('');
    });
  });

  describe('Priority chip styling', () => {
    beforeEach(() => {
      component.task = mockTask;
    });

    it('should apply high priority class', () => {
      component.task = { ...mockTask, priority: 'high' };
      fixture.detectChanges();
      const chip = fixture.debugElement.query(By.css('.priority-chip'));
      expect(chip.nativeElement.classList.contains('priority-chip-high')).toBe(true);
    });

    it('should apply medium priority class', () => {
      component.task = { ...mockTask, priority: 'medium' };
      fixture.detectChanges();
      const chip = fixture.debugElement.query(By.css('.priority-chip'));
      expect(chip.nativeElement.classList.contains('priority-chip-medium')).toBe(true);
    });

    it('should apply low priority class', () => {
      component.task = { ...mockTask, priority: 'low' };
      fixture.detectChanges();
      const chip = fixture.debugElement.query(By.css('.priority-chip'));
      expect(chip.nativeElement.classList.contains('priority-chip-low')).toBe(true);
    });
  });

  describe('Different task statuses', () => {
    beforeEach(() => {
      component.task = mockTask;
    });

    it('should render task with status today', () => {
      component.task = { ...mockTask, status: 'today' };
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });

    it('should render task with status upcoming', () => {
      component.task = { ...mockTask, status: 'upcoming' };
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });

    it('should render task with status done', () => {
      component.task = { ...mockTask, status: 'done' };
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });

    it('should render task with status archived', () => {
      component.task = { ...mockTask, status: 'archived' };
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('should render task with no description', () => {
      const { description, ...taskWithoutDescription } = mockTask;
      component.task = taskWithoutDescription as Task;
      fixture.detectChanges();
      const descElement = fixture.debugElement.query(By.css('.task-description'));
      expect(descElement).toBeNull();
    });

    it('should handle task title with special characters', () => {
      component.task = { ...mockTask, title: 'Task & "special" <characters>' };
      fixture.detectChanges();
      const title = fixture.debugElement.query(By.css('h3'));
      expect(title.nativeElement.textContent).toContain('Task & "special" <characters>');
    });

    it('should render task with all optional fields populated', () => {
      component.task = mockTask;
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
      component.task = minimalTask;
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.task-card'))).toBeTruthy();
      expect(fixture.debugElement.query(By.css('h3')).nativeElement.textContent).toContain(
        'Minimal task',
      );
    });
  });
});
