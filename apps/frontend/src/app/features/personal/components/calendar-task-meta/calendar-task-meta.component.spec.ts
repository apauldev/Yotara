import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Task } from '@yotara/shared';
import { CalendarTaskMetaComponent } from './calendar-task-meta.component';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Task',
    status: 'inbox',
    priority: 'medium',
    completed: false,
    order: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  } as Task;
}

describe('CalendarTaskMetaComponent', () => {
  let fixture: ComponentFixture<CalendarTaskMetaComponent>;
  let component: CalendarTaskMetaComponent;

  function el<T extends HTMLElement>(selector: string): T {
    const found = fixture.nativeElement.querySelector(selector) as T | null;
    if (!found) {
      throw new Error(`Element not found: ${selector}`);
    }
    return found;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarTaskMetaComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarTaskMetaComponent);
    component = fixture.componentInstance;
  });

  it('renders the priority flag, project and labels', () => {
    component.task = task({ priority: 'high' });
    component.projectName = 'Work';
    component.projectAccent = '#123456';
    component.labelNames = ['urgent', 'home'];
    fixture.detectChanges();

    expect(el('.priority-chip-high').getAttribute('aria-label')).toBe('High');
    expect(fixture.nativeElement.textContent).toContain('Work');
    expect(fixture.nativeElement.textContent).toContain('urgent');
    expect(fixture.nativeElement.textContent).toContain('home');
  });

  it('renders only the priority flag when there is no project or label', () => {
    component.task = task({ priority: 'low' });
    fixture.detectChanges();

    expect(el('.priority-chip-low').getAttribute('aria-label')).toBe('Low');
    expect(fixture.nativeElement.querySelector('.project-inline')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.meta-pill').length).toBe(0);
  });
});
