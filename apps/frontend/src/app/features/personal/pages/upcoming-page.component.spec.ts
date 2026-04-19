import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Task } from '@yotara/shared';
import { UpcomingPageComponent } from './upcoming-page.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { TaskService } from '../../../core/services/task.service';

describe('UpcomingPageComponent', () => {
  let fixture: ComponentFixture<UpcomingPageComponent>;
  let taskService: {
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    upcomingTaskGroups: ReturnType<typeof signal<{ label: string; tasks: Task[] }[]>>;
  };

  const task: Task = {
    id: 'task-1',
    title: 'Plan next review',
    description: 'Set aside time for follow-up',
    status: 'upcoming',
    priority: 'low',
    completed: false,
    createdAt: '2026-04-18T08:00:00.000Z',
    updatedAt: '2026-04-18T08:00:00.000Z',
    order: 1,
    dueDate: '2026-04-25T00:00:00.000Z',
    simpleMode: false,
    bucket: 'home',
  };

  beforeEach(async () => {
    taskService = {
      loading: signal(false),
      error: signal<string | null>(null),
      upcomingTaskGroups: signal([{ label: 'This Week', tasks: [task] }]),
    };

    await TestBed.configureTestingModule({
      imports: [UpcomingPageComponent],
      providers: [
        {
          provide: TaskService,
          useValue: taskService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UpcomingPageComponent);
  });

  it('renders the empty state when there are no upcoming tasks', () => {
    taskService.upcomingTaskGroups.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nothing is crowding the horizon');
  });

  it('renders loading and error states', () => {
    taskService.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading your upcoming plans...');

    taskService.loading.set(false);
    taskService.error.set('Could not load upcoming tasks.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Could not load upcoming tasks.');
  });

  it('renders grouped tasks and forwards clicks to the workspace', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('This Week');
    expect(fixture.nativeElement.textContent).toContain('Plan next review');
    expect(fixture.nativeElement.textContent).toContain('1 tasks');

    const workspace = fixture.debugElement.query(By.directive(PersonalTaskWorkspaceComponent))
      .componentInstance as PersonalTaskWorkspaceComponent;
    spyOn(workspace, 'editTask');

    const taskCardHost = fixture.debugElement.query(By.directive(PersonalTaskCardComponent));
    taskCardHost.query(By.css('.task-card')).nativeElement.click();

    expect(workspace.editTask).toHaveBeenCalledWith(task);
  });
});
