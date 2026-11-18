import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { Label, LabelIcon, Project, Task } from '@yotara/shared';
import { LabelService } from '../../../../core/services/label.service';
import { ProjectService } from '../../../../core/services/project.service';
import { TaskQuickActionsCoordinatorService } from '../../../../core/services/task-quick-actions-coordinator.service';
import {
  TaskQuickActionsMenuComponent,
  TaskQuickActionsSaveEvent,
} from './task-quick-actions-menu.component';
import { startOfToday } from '../../../../shared/utils/timestamps';

describe('TaskQuickActionsMenuComponent', () => {
  let component: TaskQuickActionsMenuComponent;
  let fixture: ComponentFixture<TaskQuickActionsMenuComponent>;
  let coordinator: TaskQuickActionsCoordinatorService;

  const mockLabels: Label[] = [
    {
      id: 'label-1',
      name: 'Work',
      color: '#4a8a63',
      icon: 'briefcase' as LabelIcon,
      pinned: false,
      userId: 'user-1',
    },
    {
      id: 'label-2',
      name: 'Personal',
      color: '#b86e51',
      icon: 'tag' as LabelIcon,
      pinned: false,
      userId: 'user-1',
    },
  ];

  const mockProjects: Project[] = [
    {
      id: 'project-1',
      name: 'Website Redesign',
      color: 'sage',
      kind: 'project',
      sortOrder: 0,
      pinned: false,
      ownerId: 'user-1',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      taskCount: 5,
      completedTaskCount: 2,
      openTaskCount: 3,
    },
    {
      id: 'project-2',
      name: 'Mobile App',
      color: 'deep-ocean',
      kind: 'project',
      sortOrder: 1,
      pinned: false,
      ownerId: 'user-1',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      taskCount: 2,
      completedTaskCount: 0,
      openTaskCount: 2,
    },
  ];

  const baseTask: Task = {
    id: 'task-100',
    title: 'Review proposal',
    status: 'inbox',
    priority: 'medium',
    completed: false,
    dueDate: undefined,
    labels: ['label-1'],
    projectId: 'project-1',
    order: 0,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskQuickActionsMenuComponent],
      providers: [
        TaskQuickActionsCoordinatorService,
        {
          provide: LabelService,
          useValue: {
            labels: signal(mockLabels),
          },
        },
        {
          provide: ProjectService,
          useValue: {
            projects: signal(mockProjects),
          },
        },
      ],
    }).compileComponents();

    coordinator = TestBed.inject(TaskQuickActionsCoordinatorService);
    fixture = TestBed.createComponent(TaskQuickActionsMenuComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('task', baseTask);
    fixture.detectChanges();
  });

  it('renders trigger button with correct accessible label', () => {
    const trigger = fixture.nativeElement.querySelector('.quick-action-trigger');
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('aria-label')).toBe('Quick actions for Review proposal');
  });

  it('exposes label selection and project accents for the options list', () => {
    component['initializeDraft']();
    expect(component['isLabelSelected']('label-1')).toBeTrue();
    expect(component['isLabelSelected']('label-2')).toBeFalse();
    expect(component['getProjectAccent']('sage')).toBeTruthy();
  });

  it('delegates programmatic open and close to the popover', () => {
    const popover = (component as any).popover();
    spyOn(popover, 'open');
    spyOn(popover, 'close');

    component.open();
    component.close();

    expect(popover.open).toHaveBeenCalled();
    expect(popover.close).toHaveBeenCalled();
  });

  describe('Draft staging and dirty state', () => {
    it('initializes draft from task values on open', () => {
      // Trigger open state
      component['onStateChanged']('open');

      expect(component['draftDueDate']()).toBeNull();
      expect(component['draftPriority']()).toBe('medium');
      expect(component['draftLabels']()).toEqual(['label-1']);
      expect(component['draftProjectId']()).toBe('project-1');
      expect(component.isDirty()).toBeFalse();
    });

    it('updates schedule and marks dirty when a date preset is selected', () => {
      component['onStateChanged']('open');
      const today = startOfToday().toFormat('yyyy-MM-dd');

      component['setSchedule'](today);

      expect(component['draftDueDate']()).toBe(today);
      expect(component.isDirty()).toBeTrue();
    });

    it('computes tomorrow and next-week presets and identifies custom dates', () => {
      expect(component['tomorrowDate']()).toBe(
        startOfToday().plus({ days: 1 }).toFormat('yyyy-MM-dd'),
      );
      expect(component['nextWeekDate']()).toBeTruthy();

      component['draftDueDate'].set(component['tomorrowDate']());
      expect(component['isTomorrowSelected']()).toBeTrue();
      expect(component['isCustomDateSelected']()).toBeFalse();

      component['draftDueDate'].set(component['nextWeekDate']());
      expect(component['isNextWeekSelected']()).toBeTrue();

      const customDate = startOfToday().plus({ days: 10 }).toFormat('yyyy-MM-dd');
      component['draftDueDate'].set(customDate);
      expect(component['isCustomDateSelected']()).toBeTrue();
      expect(component['customDateLabel']()).toBe(
        startOfToday().plus({ days: 10 }).toFormat('MMM d, yyyy'),
      );
    });

    it('updates priority and marks dirty', () => {
      component['onStateChanged']('open');

      component['setPriority']('high');

      expect(component['draftPriority']()).toBe('high');
      expect(component.isDirty()).toBeTrue();
    });

    it('toggles labels and updates draft correctly', () => {
      component['onStateChanged']('open');

      // Add label-2
      component['toggleLabel']('label-2');
      expect(component['draftLabels']()).toEqual(['label-1', 'label-2']);
      expect(component.isDirty()).toBeTrue();

      // Remove label-1
      component['toggleLabel']('label-1');
      expect(component['draftLabels']()).toEqual(['label-2']);
      expect(component.isDirty()).toBeTrue();

      // Re-add label-1 and remove label-2 (restoring original)
      component['toggleLabel']('label-1');
      component['toggleLabel']('label-2');
      expect(component['draftLabels']()).toEqual(['label-1']);
      expect(component.isDirty()).toBeFalse();
    });

    it('updates project and supports "No project"', () => {
      component['onStateChanged']('open');

      // Change project
      component['setProject']('project-2');
      expect(component['draftProjectId']()).toBe('project-2');
      expect(component.isDirty()).toBeTrue();

      // Set to No project
      component['setProject'](null);
      expect(component['draftProjectId']()).toBeNull();
      expect(component.isDirty()).toBeTrue();

      // Restore
      component['setProject']('project-1');
      expect(component.isDirty()).toBeFalse();
    });

    it('resets changes when resetDraft is called', () => {
      component['onStateChanged']('open');

      component['setPriority']('low');
      component['toggleLabel']('label-2');
      component['setProject'](null);
      expect(component.isDirty()).toBeTrue();

      component['resetDraft']();

      expect(component['draftPriority']()).toBe('medium');
      expect(component['draftLabels']()).toEqual(['label-1']);
      expect(component['draftProjectId']()).toBe('project-1');
      expect(component.isDirty()).toBeFalse();
    });
  });

  describe('Dismissal and Save Diffing', () => {
    it('emits saveChanges with diff on dismissal when dirty', () => {
      let savedEvent: TaskQuickActionsSaveEvent | undefined;
      component.saveChanges.subscribe((event) => {
        savedEvent = event;
      });

      component['onStateChanged']('open');
      component['setPriority']('high');
      component['toggleLabel']('label-2'); // draftLabels: ['label-1', 'label-2']

      component['onStateChanged']('closed');

      expect(savedEvent).toBeDefined();
      expect(savedEvent?.taskId).toBe('task-100');
      expect(savedEvent?.diff).toEqual({
        priority: 'high',
        labels: ['label-1', 'label-2'],
      });
      expect(savedEvent?.draft.priority).toBe('high');
      expect(savedEvent?.draft.labels).toEqual(['label-1', 'label-2']);
    });

    it('includes changed schedule and project values in the update diff', () => {
      let savedEvent: TaskQuickActionsSaveEvent | undefined;
      component.saveChanges.subscribe((event) => {
        savedEvent = event;
      });

      component['onStateChanged']('open');
      component['setSchedule'](component['tomorrowDate']());
      component['setProject'](null);
      component['onStateChanged']('closed');

      expect(savedEvent?.diff).toEqual({
        dueDate: component['tomorrowDate'](),
        projectId: null,
      });
    });

    it('ignores label reordering but includes same-size label replacements', () => {
      fixture.componentRef.setInput('task', {
        ...baseTask,
        labels: ['label-1', 'label-2'],
      });
      fixture.detectChanges();
      component['initializeDraft']();

      component['draftLabels'].set(['label-2', 'label-1']);
      expect(component['computeDiff']().labels).toBeUndefined();

      component['draftLabels'].set(['label-2', 'label-3']);
      expect(component['computeDiff']().labels).toEqual(['label-2', 'label-3']);
    });

    it('does not emit saveChanges on dismissal if nothing changed', () => {
      let savedEvent: TaskQuickActionsSaveEvent | undefined;
      component.saveChanges.subscribe((event) => {
        savedEvent = event;
      });

      component['onStateChanged']('open');
      // No changes made
      component['onStateChanged']('closed');

      expect(savedEvent).toBeUndefined();
    });

    it('discards draft changes and does not emit saveChanges on Escape', () => {
      let savedEvent: TaskQuickActionsSaveEvent | undefined;
      let discardCalled = false;
      component.saveChanges.subscribe((event) => {
        savedEvent = event;
      });
      component.discard.subscribe(() => {
        discardCalled = true;
      });

      component['onStateChanged']('open');
      component['setPriority']('high');
      expect(component.isDirty()).toBeTrue();

      // User hits Escape
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      spyOn(event, 'stopPropagation');
      component['onEscape'](event);

      expect(event.stopPropagation).toHaveBeenCalled();

      // When popover closes
      component['onStateChanged']('closed');

      expect(discardCalled).toBeTrue();
      expect(savedEvent).toBeUndefined();
    });

    it('routes Escape from a filter through the discard handler and stops other keys', () => {
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      spyOn(component as any, 'onEscape');

      component['onFilterKeydown'](escapeEvent);

      expect((component as any).onEscape).toHaveBeenCalledWith(escapeEvent);

      const typingEvent = new KeyboardEvent('keydown', { key: 'a' });
      spyOn(typingEvent, 'stopPropagation');
      component['onFilterKeydown'](typingEvent);

      expect(typingEvent.stopPropagation).toHaveBeenCalled();
      expect((component as any).onEscape).toHaveBeenCalledTimes(1);
    });
  });

  describe('Direct actions (Footer)', () => {
    it('emits openDetails and does not save draft', () => {
      let detailsOpened = false;
      let savedEvent: TaskQuickActionsSaveEvent | undefined;
      component.openDetails.subscribe(() => {
        detailsOpened = true;
      });
      component.saveChanges.subscribe((event) => {
        savedEvent = event;
      });

      component['onStateChanged']('open');
      component['setPriority']('high');

      const mouseEvent = new MouseEvent('click');
      spyOn(mouseEvent, 'stopPropagation');
      component['handleOpenDetails'](mouseEvent);

      expect(mouseEvent.stopPropagation).toHaveBeenCalled();
      expect(detailsOpened).toBeTrue();

      component['onStateChanged']('closed');
      expect(savedEvent).toBeUndefined();
    });

    it('emits deleteTask and does not save draft', () => {
      let taskDeleted = false;
      let savedEvent: TaskQuickActionsSaveEvent | undefined;
      component.deleteTask.subscribe(() => {
        taskDeleted = true;
      });
      component.saveChanges.subscribe((event) => {
        savedEvent = event;
      });

      component['onStateChanged']('open');
      component['setPriority']('high');

      const mouseEvent = new MouseEvent('click');
      spyOn(mouseEvent, 'stopPropagation');
      component['handleDeleteTask'](mouseEvent);

      expect(mouseEvent.stopPropagation).toHaveBeenCalled();
      expect(taskDeleted).toBeTrue();

      component['onStateChanged']('closed');
      expect(savedEvent).toBeUndefined();
    });
  });

  describe('Coordinator synchronization', () => {
    it('registers with coordinator on open and unregisters on close', () => {
      expect(coordinator.activeTaskId()).toBeNull();

      component['onStateChanged']('open');
      expect(coordinator.activeTaskId()).toBe('task-100');

      component['onStateChanged']('closed');
      expect(coordinator.activeTaskId()).toBeNull();
    });

    it('closes menu automatically when another task opens in coordinator', () => {
      component['onStateChanged']('open');
      expect(component['isOpen']()).toBeTrue();

      spyOn(component, 'close');

      // Another task opens
      coordinator.open('task-200');
      fixture.detectChanges();

      expect(component.close).toHaveBeenCalled();
    });
  });

  describe('Search filters', () => {
    it('filters labels according to labelSearch', () => {
      expect(component['filteredLabels']().length).toBe(2);

      component['labelSearch'].set('work');
      expect(component['filteredLabels']().map((l) => l.name)).toEqual(['Work']);

      component['labelSearch'].set('nomatch');
      expect(component['filteredLabels']().length).toBe(0);
    });

    it('filters projects according to projectSearch', () => {
      expect(component['filteredProjects']().length).toBe(2);

      component['projectSearch'].set('app');
      expect(component['filteredProjects']().map((p) => p.name)).toEqual(['Mobile App']);

      component['projectSearch'].set('xyz');
      expect(component['filteredProjects']().length).toBe(0);
    });

    it('shows No project when the filter matches and hides it otherwise', () => {
      expect(component['shouldShowNoProjectOption']()).toBeTrue();

      component['projectSearch'].set('no project');
      expect(component['shouldShowNoProjectOption']()).toBeTrue();

      component['projectSearch'].set('finance');
      expect(component['shouldShowNoProjectOption']()).toBeFalse();
    });
  });

  describe('Schedule presets and date helpers', () => {
    it('evaluates schedule selection states correctly', () => {
      // Null due date
      component['draftDueDate'].set(null);
      expect(component['isNoDateSelected']()).toBeTrue();
      expect(component['isTodaySelected']()).toBeFalse();
      expect(component['isTomorrowSelected']()).toBeFalse();
      expect(component['isNextWeekSelected']()).toBeFalse();
      expect(component['isCustomDateSelected']()).toBeFalse();
      expect(component['customDateLabel']()).toBe('');

      // Today
      component['draftDueDate'].set(component['todayDate']());
      expect(component['isTodaySelected']()).toBeTrue();
      expect(component['isNoDateSelected']()).toBeFalse();
      expect(component['isCustomDateSelected']()).toBeFalse();

      // Tomorrow
      component['draftDueDate'].set(component['tomorrowDate']());
      expect(component['isTomorrowSelected']()).toBeTrue();
      expect(component['isCustomDateSelected']()).toBeFalse();

      // Next week
      component['draftDueDate'].set(component['nextWeekDate']());
      expect(component['isNextWeekSelected']()).toBeTrue();
      expect(component['isCustomDateSelected']()).toBeFalse();

      // Custom date
      component['draftDueDate'].set('2030-05-15');
      expect(component['isCustomDateSelected']()).toBeTrue();
      expect(component['customDateLabel']()).toBe('May 15, 2030');
    });

    it('handles initialTask null guard in isDirty and computeDiff', () => {
      component['initialTask'].set(null);
      expect(component.isDirty()).toBeFalse();
      expect(component['computeDiff']()).toEqual({});
    });

    it('handles tasks with undefined optional fields (labels, projectId, dueDate)', () => {
      const bareTask: Task = {
        id: 'task-bare',
        title: 'Bare task',
        completed: false,
        order: 0,
        priority: 'medium',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        status: 'inbox',
      };
      fixture.componentRef.setInput('task', bareTask);
      fixture.detectChanges();

      component['initializeDraft']();
      expect(component['draftLabels']()).toEqual([]);
      expect(component['draftProjectId']()).toBeNull();
      expect(component['draftDueDate']()).toBeNull();
      expect(component.isDirty()).toBeFalse();

      component['draftProjectId'].set('project-1');
      expect(component.isDirty()).toBeTrue();
      const diff = component['computeDiff']();
      expect(diff.projectId).toBe('project-1');
    });
  });
});
