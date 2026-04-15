import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProjectsPageComponent } from './projects-page.component';
import { ProjectService } from '../../../core/services/project.service';

describe('ProjectsPageComponent', () => {
  beforeEach(async () => {
    const projects = signal([
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
    expect(text).toContain('18 tasks');
    expect(text).toContain('New Project');
  });
});
