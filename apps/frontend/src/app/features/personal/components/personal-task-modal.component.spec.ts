import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMarkdown } from 'ngx-markdown';
import { Label, Project, Task } from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';
import { PersonalTaskModalComponent } from './personal-task-modal.component';

const testLabel: Label = {
  id: 'label-1',
  name: 'Urgent',
  color: '#d44d3c',
  userId: 'user-1',
};

describe('PersonalTaskModalComponent', () => {
  let component: PersonalTaskModalComponent;
  let fixture: ComponentFixture<PersonalTaskModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalTaskModalComponent],
      providers: [
        provideMarkdown(),
        { provide: LabelService, useValue: { labels: signal([testLabel]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalTaskModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('Form Validation', () => {
    describe('Title Validation', () => {
      it('should show error when title is empty', () => {
        component['draftTitle'].set('');
        const isValid = component['validateTitle']();

        expect(isValid).toBe(false);
        expect(component['titleError']()).toBe('Title is required');
      });

      it('should show error when title is only whitespace', () => {
        component['draftTitle'].set('   ');
        const isValid = component['validateTitle']();

        expect(isValid).toBe(false);
        expect(component['titleError']()).toBe('Title is required');
      });

      it('should show error when title exceeds 200 characters', () => {
        const longTitle = 'a'.repeat(201);
        component['draftTitle'].set(longTitle);
        const isValid = component['validateTitle']();

        expect(isValid).toBe(false);
        expect(component['titleError']()).toBe('Title must be less than 200 characters');
      });

      it('should pass validation when title is valid', () => {
        component['draftTitle'].set('My Task');
        const isValid = component['validateTitle']();

        expect(isValid).toBe(true);
        expect(component['titleError']()).toBeNull();
      });

      it('should pass validation when title is at maximum length (200 characters)', () => {
        const maxTitle = 'a'.repeat(200);
        component['draftTitle'].set(maxTitle);
        const isValid = component['validateTitle']();

        expect(isValid).toBe(true);
        expect(component['titleError']()).toBeNull();
      });

      it('should clear error message on valid title', () => {
        component['draftTitle'].set('');
        component['validateTitle']();
        expect(component['titleError']()).toBe('Title is required');

        component['draftTitle'].set('Valid Title');
        component['validateTitle']();
        expect(component['titleError']()).toBeNull();
      });
    });

    describe('Due Date Validation', () => {
      it('should not require due date in simple mode', () => {
        component['draftSimpleMode'].set(true);
        const isValid = component['validateDueDate']();

        expect(isValid).toBe(true);
        expect(component['dueDateError']()).toBeNull();
      });

      it('should allow empty due date when not in simple mode', () => {
        component['draftSimpleMode'].set(false);
        component['draftDueDate'].set('');
        const isValid = component['validateDueDate']();

        expect(isValid).toBe(true);
        expect(component['dueDateError']()).toBeNull();
      });

      it('should validate valid date format', () => {
        component['draftSimpleMode'].set(false);
        component['draftDueDate'].set('2025-12-25');
        const isValid = component['validateDueDate']();

        expect(isValid).toBe(true);
        expect(component['dueDateError']()).toBeNull();
      });

      it('should show error for invalid date format', () => {
        component['draftSimpleMode'].set(false);
        component['draftDueDate'].set('invalid-date');
        const isValid = component['validateDueDate']();

        expect(isValid).toBe(false);
        expect(component['dueDateError']()).toBe('Please enter a valid date');
      });

      it('should clear error when valid date is entered', () => {
        component['draftSimpleMode'].set(false);
        component['draftDueDate'].set('invalid');
        component['validateDueDate']();
        expect(component['dueDateError']()).toBe('Please enter a valid date');

        component['draftDueDate'].set('2025-12-25');
        component['validateDueDate']();
        expect(component['dueDateError']()).toBeNull();
      });
    });

    describe('Description Validation', () => {
      it('should allow empty description', () => {
        component['draftDescription'].set('');
        const isValid = component['validateDescription']();

        expect(isValid).toBe(true);
        expect(component['descriptionError']()).toBeNull();
      });

      it('should allow description with content', () => {
        component['draftDescription'].set('My description');
        const isValid = component['validateDescription']();

        expect(isValid).toBe(true);
        expect(component['descriptionError']()).toBeNull();
      });
    });

    describe('Form Validation (All Fields)', () => {
      it('should fail when title is empty', () => {
        component['draftTitle'].set('');
        component['draftDueDate'].set('2025-12-25');
        const isValid = component['validateForm']();

        expect(isValid).toBe(false);
      });

      it('should fail when due date is invalid', () => {
        component['draftTitle'].set('My Task');
        component['draftSimpleMode'].set(false);
        component['draftDueDate'].set('invalid-date');
        const isValid = component['validateForm']();

        expect(isValid).toBe(false);
      });

      it('should pass when all fields are valid', () => {
        component['draftTitle'].set('My Task');
        component['draftSimpleMode'].set(true);
        const isValid = component['validateForm']();

        expect(isValid).toBe(true);
      });

      it('should pass with valid title and date', () => {
        component['draftTitle'].set('My Task');
        component['draftSimpleMode'].set(false);
        component['draftDueDate'].set('2025-12-25');
        const isValid = component['validateForm']();

        expect(isValid).toBe(true);
      });
    });

    describe('Submit Behavior', () => {
      it('should not emit save event when validation fails', () => {
        spyOn(component['save'], 'emit');

        component['draftTitle'].set('');
        component['submit']();

        expect(component['save'].emit).not.toHaveBeenCalled();
      });

      it('should emit save event when validation passes', () => {
        spyOn(component['save'], 'emit');

        component['draftTitle'].set('New Task');
        component['submit']();

        expect(component['save'].emit).toHaveBeenCalledWith(
          jasmine.objectContaining({
            mode: 'create',
          }),
        );
      });

      it('should show validation error on submit with empty title', () => {
        component['draftTitle'].set('');
        component['submit']();

        expect(component['titleError']()).toBe('Title is required');
      });
    });
  });

  describe('Error Clearing', () => {
    it('should clear errors when modal hydrates with new task', () => {
      component['draftTitle'].set('');
      component['validateTitle']();
      expect(component['titleError']()).toBe('Title is required');

      // Simulate opening with a task
      fixture.componentRef.setInput('task', {
        id: '1',
        title: 'Existing Task',
        description: '',
        status: 'inbox',
        priority: 'medium',
        completed: false,
        simpleMode: true,
        bucket: 'personal-sanctuary',
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      fixture.detectChanges();

      expect(component['titleError']()).toBeNull();
    });

    it('does not wipe in-progress drafts when late inputs arrive', () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();

      component['draftTitle'].set('In-progress title');
      component['draftPriority'].set('high');
      component['showAdvanced'].set(true);

      // Late-arriving projects must not rehydrate and wipe drafts.
      fixture.componentRef.setInput('projects', [
        { id: 'project-1', name: 'Launch Plan' } as Project,
      ]);
      fixture.detectChanges();

      expect(component['draftTitle']()).toBe('In-progress title');
      expect(component['draftPriority']()).toBe('high');
      expect(component['showAdvanced']()).toBe(true);
    });
  });

  describe('Completion Toggle', () => {
    it('should render a Font Awesome icon for the completion toggle', () => {
      component.open = true;
      fixture.detectChanges();

      const checkbox = fixture.debugElement.query(By.css('.checkbox-control'));
      expect(checkbox).toBeTruthy();
      expect(checkbox.nativeElement.querySelector('.checkbox-box')).toBeTruthy();
    });
  });

  describe('Modal shell', () => {
    it('uses app-modal with the full-height layout and forwards close', () => {
      component.open = true;
      fixture.detectChanges();

      const modal = fixture.debugElement.query(By.css('app-modal'));
      expect(modal).toBeTruthy();
      expect(modal.componentInstance.layout).toBe('full-height');
      expect(modal.componentInstance.open).toBe(true);

      const closeSpy = spyOn(component.close, 'emit');
      modal.componentInstance.close.emit();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('delegates the overlay shell to app-modal instead of a custom shell', () => {
      component.open = true;
      fixture.detectChanges();

      // One shared overlay shell (from app-modal), not a task-local one.
      expect(fixture.debugElement.queryAll(By.css('app-modal')).length).toBe(1);
      expect(fixture.debugElement.query(By.css('.task-layout'))).toBeTruthy();
      // Legacy custom shell internals are gone.
      expect(fixture.debugElement.query(By.css('.modal-main'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.modal-sidebar'))).toBeFalsy();
      expect(fixture.debugElement.query(By.css('.sidebar-scroll'))).toBeFalsy();
    });

    it('keeps an explicit desktop two-pane composition with a projected footer', () => {
      component.open = true;
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.task-main'))).toBeTruthy();
      expect(fixture.debugElement.query(By.css('.task-details'))).toBeTruthy();

      const footer = fixture.debugElement.query(By.css('[modal-footer]'));
      expect(footer).toBeTruthy();
      expect(footer.nativeElement.querySelector('.primary-button')).toBeTruthy();
      expect(footer.nativeElement.querySelector('.secondary-button')).toBeTruthy();
    });

    it('focuses the title input instead of using native subtask autofocus', () => {
      component.open = true;
      fixture.detectChanges();

      const titleInput = fixture.debugElement.query(By.css('input[name="taskTitle"]'));
      expect(titleInput.nativeElement.hasAttribute('autofocus')).toBe(true);

      component['subtaskEntryMode'].set(true);
      fixture.detectChanges();

      const subtaskInput = fixture.debugElement.query(By.css('.subtask-entry input'));
      expect(subtaskInput.nativeElement.hasAttribute('autofocus')).toBe(false);
    });

    it('does not close on document-level Escape (handled locally by app-modal)', () => {
      component.open = true;
      fixture.detectChanges();

      const closeSpy = spyOn(component.close, 'emit');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(closeSpy).not.toHaveBeenCalled();
    });
  });

  describe('Field labeling', () => {
    it('should label the project select', () => {
      component.open = true;
      fixture.detectChanges();

      const projectLabel = fixture.debugElement.query(By.css('label[for="task-project"]'));
      const projectSelect = fixture.debugElement.query(By.css('#task-project'));

      expect(projectLabel.nativeElement.textContent).toContain('Project');
      expect(projectSelect).toBeTruthy();
    });

    it('should label the status select', () => {
      component.open = true;
      fixture.detectChanges();

      const statusLabel = fixture.debugElement.query(By.css('label[for="task-status"]'));
      const statusSelect = fixture.debugElement.query(By.css('#task-status'));

      expect(statusLabel.nativeElement.textContent).toContain('Status');
      expect(statusSelect).toBeTruthy();
    });

    it('should not nest labels in the completion toggle', () => {
      component.open = true;
      fixture.detectChanges();

      const completionToggle = fixture.debugElement.query(By.css('.toggle-row'));
      expect(completionToggle.nativeElement.querySelectorAll('label').length).toBe(0);
    });
  });

  describe('Progressive disclosure', () => {
    it('collapses advanced metadata for a new task', () => {
      component.open = true;
      fixture.detectChanges();

      expect(component['showAdvanced']()).toBe(false);

      const toggle = fixture.debugElement.query(By.css('.details-toggle'));
      expect(toggle.nativeElement.getAttribute('aria-expanded')).toBe('false');
      expect(toggle.nativeElement.getAttribute('aria-controls')).toBe('task-advanced-section');

      const details = fixture.debugElement.query(By.css('#task-advanced-section'));
      expect(details.nativeElement.classList.contains('details-collapsed')).toBe(true);
    });

    it('expands the toggle when activated', () => {
      component.open = true;
      fixture.detectChanges();

      fixture.debugElement.query(By.css('.details-toggle')).nativeElement.click();
      fixture.detectChanges();

      expect(component['showAdvanced']()).toBe(true);
      const details = fixture.debugElement.query(By.css('#task-advanced-section'));
      expect(details.nativeElement.classList.contains('details-collapsed')).toBe(false);
    });

    it('auto-expands when editing a task with meaningful metadata', () => {
      fixture.componentRef.setInput('task', {
        id: '1',
        title: 'Existing Task',
        description: '',
        status: 'today',
        priority: 'high',
        dueDate: '2025-12-25',
        completed: false,
        simpleMode: false,
        bucket: 'personal-sanctuary',
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Task);
      fixture.detectChanges();

      expect(component['showAdvanced']()).toBe(true);
    });

    it('stays collapsed when editing a task without meaningful metadata', () => {
      fixture.componentRef.setInput('task', {
        id: '1',
        title: 'Plain Task',
        description: '',
        status: 'inbox',
        priority: 'medium',
        completed: false,
        simpleMode: true,
        bucket: 'personal-sanctuary',
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Task);
      fixture.detectChanges();

      expect(component['showAdvanced']()).toBe(false);
    });

    it('preserves draft values while collapsed', () => {
      component.open = true;
      fixture.detectChanges();

      component['draftDueDate'].set('2025-12-25');
      component['showAdvanced'].set(false);
      fixture.detectChanges();

      component['showAdvanced'].set(true);
      fixture.detectChanges();

      expect(component['draftDueDate']()).toBe('2025-12-25');
      const trigger = fixture.debugElement.query(By.css('.schedule-picker .date-picker-trigger'));
      expect(trigger).toBeTruthy();
    });
  });

  describe('Selected-state semantics', () => {
    it('exposes aria-pressed on label choices within a labeled group', () => {
      component.open = true;
      component['showAdvanced'].set(true);
      fixture.detectChanges();

      const group = fixture.debugElement.query(By.css('.label-chip-grid'));
      expect(group.nativeElement.getAttribute('role')).toBe('group');

      const chip = fixture.debugElement.query(By.css('.label-chip'));
      expect(chip.nativeElement.getAttribute('aria-pressed')).toBe('false');

      component['toggleLabel'](testLabel);
      fixture.detectChanges();

      expect(chip.nativeElement.getAttribute('aria-pressed')).toBe('true');
    });

    it('exposes aria-pressed on priority choices within a labeled group', () => {
      component.open = true;
      component['showAdvanced'].set(true);
      fixture.detectChanges();

      const group = fixture.debugElement.query(By.css('.priority-dots'));
      expect(group.nativeElement.getAttribute('role')).toBe('group');

      const dots = fixture.debugElement.queryAll(By.css('.priority-dot'));
      expect(dots[0].nativeElement.getAttribute('aria-pressed')).toBe('false');
      expect(dots[1].nativeElement.getAttribute('aria-pressed')).toBe('true');

      component['draftPriority'].set('high');
      fixture.detectChanges();

      expect(dots[0].nativeElement.getAttribute('aria-pressed')).toBe('true');
    });

    it('exposes aria-pressed on weekday choices within a labeled group', () => {
      component.open = true;
      component['showAdvanced'].set(true);
      component['draftRecurrenceFrequency'].set('weekly');
      fixture.detectChanges();

      const group = fixture.debugElement.query(
        By.css('.day-picker-row[aria-label="Repeat on weekdays"]'),
      );
      expect(group.nativeElement.getAttribute('role')).toBe('group');

      const days = fixture.debugElement.queryAll(By.css('.day-chip'));
      expect(days[1].nativeElement.getAttribute('aria-pressed')).toBe('false');

      component['toggleDay'](1);
      fixture.detectChanges();

      expect(days[1].nativeElement.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('Field error semantics', () => {
    it('associates the title error with the title field', () => {
      component.open = true;
      component['draftTitle'].set('');
      component['submit']();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('#task-title-input'));
      expect(input.nativeElement.getAttribute('aria-invalid')).toBe('true');
      expect(input.nativeElement.getAttribute('aria-describedby')).toBe('task-title-error');
      expect(fixture.debugElement.query(By.css('#task-title-error'))).toBeTruthy();
    });

    it('associates the due-date error with the date-picker trigger', () => {
      component.open = true;
      component['draftTitle'].set('Valid title');
      component['draftSimpleMode'].set(false);
      component['draftDueDate'].set('invalid-date');
      component['submit']();
      fixture.detectChanges();

      // The collapsed advanced section expands before focusing.
      expect(component['showAdvanced']()).toBe(true);

      const trigger = fixture.debugElement.query(By.css('.schedule-picker .date-picker-trigger'));
      expect(trigger.nativeElement.getAttribute('aria-invalid')).toBe('true');
      expect(trigger.nativeElement.getAttribute('aria-describedby')).toBe('task-due-date-error');
      expect(fixture.debugElement.query(By.css('#task-due-date-error'))).toBeTruthy();
      expect(document.activeElement).toBe(trigger.nativeElement);
    });

    it('focuses the title on failed submit when the title is invalid', () => {
      component.open = true;
      component['draftTitle'].set('');
      component['submit']();
      fixture.detectChanges();

      expect(document.activeElement).toBe(
        fixture.debugElement.query(By.css('#task-title-input')).nativeElement,
      );
    });
  });

  describe('Save error announcement', () => {
    it('announces save failures as blocking errors', () => {
      fixture.componentRef.setInput('error', 'Could not save your task right now.');
      component.open = true;
      fixture.detectChanges();

      const errorCopy = fixture.debugElement.query(By.css('.error-copy'));
      expect(errorCopy.nativeElement.getAttribute('role')).toBe('alert');
      expect(errorCopy.nativeElement.textContent).toContain('Could not save');
    });
  });

  describe('Subtask focus management', () => {
    it('names each draft removal after its subtask', () => {
      component.open = true;
      component['draftSubtasks'].set([{ title: 'Draft one', completed: false }]);
      fixture.detectChanges();

      const removeButton = fixture.debugElement.query(By.css('.remove-draft-button'));
      expect(removeButton.nativeElement.getAttribute('aria-label')).toBe(
        'Remove draft subtask Draft one',
      );
    });

    it('focuses the subtask input when entry opens', () => {
      component.open = true;
      fixture.detectChanges();

      component['toggleSubtaskEntry']();
      fixture.detectChanges();

      expect(document.activeElement).toBe(
        fixture.debugElement.query(By.css('.subtask-entry input')).nativeElement,
      );
    });

    it('returns focus to Add subtask after cancellation', () => {
      component.open = true;
      fixture.detectChanges();

      component['toggleSubtaskEntry']();
      fixture.detectChanges();
      component['toggleSubtaskEntry']();
      fixture.detectChanges();

      expect(document.activeElement).toBe(
        fixture.debugElement.query(By.css('.add-subtask-button')).nativeElement,
      );
    });

    it('focuses the title when the modal opens', () => {
      component.open = true;
      fixture.detectChanges();

      const modal = fixture.debugElement.query(By.css('app-modal'));
      modal.componentInstance.afterOpen.emit();
      fixture.detectChanges();

      expect(document.activeElement).toBe(
        fixture.debugElement.query(By.css('#task-title-input')).nativeElement,
      );
    });
  });
});
