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

  it('renders priority, project and label pills', () => {
    component.task = task({ priority: 'high' });
    component.projectName = 'Work';
    component.projectAccent = '#123456';
    component.labelNames = ['urgent', 'home'];
    fixture.detectChanges();

    expect(el('.priority-chip-high').textContent).toContain('High');
    expect(fixture.nativeElement.textContent).toContain('Work');
    expect(fixture.nativeElement.textContent).toContain('urgent');
    expect(fixture.nativeElement.textContent).toContain('home');
  });

  it('renders only the priority pill when there is no project or label', () => {
    component.task = task({ priority: 'low' });
    fixture.detectChanges();

    expect(el('.priority-chip-low')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.meta-pill').length).toBe(1);
  });
});
