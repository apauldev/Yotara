import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { InboxPageComponent } from './inbox-page.component';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';

describe('InboxPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InboxPageComponent],
      providers: [
        {
          provide: TaskService,
          useValue: {
            loading: signal(false),
            creating: signal(false),
            error: signal<string | null>(null),
            inboxTasks: () => [],
            createTask: jasmine.createSpy().and.resolveTo(undefined),
            updateTask: jasmine.createSpy().and.resolveTo(undefined),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the inbox empty state when there are no tasks', () => {
    const fixture = TestBed.createComponent(InboxPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Clear skies');
  });

  it('opens task workspace modal from the inbox input', () => {
    const fixture = TestBed.createComponent(InboxPageComponent);
    fixture.detectChanges();
    const workspaceDebugEl = fixture.debugElement.query(
      By.directive(PersonalTaskWorkspaceComponent),
    );
    const workspace = workspaceDebugEl.componentInstance as PersonalTaskWorkspaceComponent;
    spyOn(workspace, 'openCreateTaskModal');

    fixture.componentInstance['captureTitle'].set('Write morning pages');
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();

    expect(workspace.openCreateTaskModal).toHaveBeenCalled();
  });

  it('ships at least 30 rotating prompts for both promo cards', () => {
    const fixture = TestBed.createComponent(InboxPageComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance['dailyClarityPrompts'].length).toBeGreaterThanOrEqual(30);
    expect(fixture.componentInstance['journalPrompts'].length).toBeGreaterThanOrEqual(30);
    expect(fixture.nativeElement.textContent).toContain('Daily clarity');
    expect(fixture.nativeElement.textContent).toContain('The Yotara Journal');
  });
});
