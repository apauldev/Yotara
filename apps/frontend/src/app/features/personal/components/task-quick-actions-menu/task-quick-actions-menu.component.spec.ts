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
  });
});
