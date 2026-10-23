import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Project } from '@yotara/shared';
import { ProjectsPageComponent } from './projects-page.component';
import { ProjectService } from '../../../core/services/project.service';

describe('ProjectsPageComponent', () => {
  let projects: WritableSignal<Project[]>;

  beforeEach(async () => {
    projects = signal<Project[]>([
      {
        id: 'project-1',
        name: 'Launch Yotara MVP',
        description: 'Core release scope',
        color: 'sage' as const,
        ownerId: 'user-1',
        taskCount: 18,
        completedTaskCount: 11,
        openTaskCount: 7,
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-03T10:00:00.000Z',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ProjectsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ProjectService,
          useValue: {
            projects,
            loading: signal(false),
            saving: signal(false),
            error: signal(null),
            createProject: jasmine.createSpy('createProject'),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders real project cards and the create affordance', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Launch Yotara MVP');
    expect(text).toContain('Core release scope');
    expect(text).toContain('61%');
    expect(text.toLowerCase()).toContain('active');
    expect(text).toContain('New Project');

    // Check for edit button by aria-label since text 'Edit' is gone
    const editBtn = fixture.nativeElement.querySelector('[aria-label*="Edit project"]');
    expect(editBtn).toBeTruthy();
  });

  it('shows open task counts in the always-visible project cell', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.open-task-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe('7 open tasks');
    expect(badge.closest('.col-identification')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('61%');
  });

  it('uses singular copy when one task is open', () => {
    const [project] = projects();
    projects.set([{ ...project, openTaskCount: 1 }]);

    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.open-task-badge');
    expect(badge.textContent.trim()).toBe('1 open task');
  });
});
