import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonalTaskModalComponent } from './personal-task-modal.component';

describe('PersonalTaskModalComponent', () => {
  let component: PersonalTaskModalComponent;
  let fixture: ComponentFixture<PersonalTaskModalComponent>;

  const pad = (value: number) => String(value).padStart(2, '0');
  const toIsoDate = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const addYears = (date: Date, years: number) => {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  };
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalTaskModalComponent],
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
        component['draftDueDate'].set(toIsoDate(addDays(new Date(), 1)));
        const isValid = component['validateDueDate']();

        expect(isValid).toBe(true);
        expect(component['dueDateError']()).toBeNull();
      });

      it('should show error for due date beyond 10 years', () => {
        component['draftSimpleMode'].set(false);
        component['draftDueDate'].set(toIsoDate(addYears(new Date(), 11)));
        const isValid = component['validateDueDate']();

        expect(isValid).toBe(false);
        expect(component['dueDateError']()).toBe('Due date must be within the next 10 years');
      });

      it('should show error for due date before today', () => {
        component['draftSimpleMode'].set(false);
        component['draftDueDate'].set(toIsoDate(addDays(new Date(), -1)));
        const isValid = component['validateDueDate']();

        expect(isValid).toBe(false);
        expect(component['dueDateError']()).toBe('Due date must be within the next 10 years');
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

        component['draftDueDate'].set(toIsoDate(addDays(new Date(), 1)));
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
        component['draftDueDate'].set(toIsoDate(addDays(new Date(), 1)));
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
        component['draftDueDate'].set(toIsoDate(addYears(new Date(), 1)));
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
      component['task'] = {
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
      };
      component['ngOnChanges']();

      expect(component['titleError']()).toBeNull();
    });
  });
});
