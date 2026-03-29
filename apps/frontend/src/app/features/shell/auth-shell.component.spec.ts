import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AuthShellComponent } from './auth-shell.component';
import { AuthStateService } from '../../core/services/auth-state.service';

describe('AuthShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthShellComponent],
      providers: [
        provideRouter([{ path: 'dashboard', component: AuthShellComponent }]),
        {
          provide: AuthStateService,
          useValue: {
            user: () => ({
              id: 'user-1',
              email: 'alex@example.com',
              name: 'Alex Rivers',
              onboardingCompleted: true,
              workspaceMode: 'team',
              createdAt: '2026-03-19T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the sidebar nav items in the planned order', () => {
    const fixture = TestBed.createComponent(AuthShellComponent);
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.nav-item'))
      .map((element) =>
        element.queryAll(By.css('span'))[1]?.nativeElement.textContent.replace(/\s+/g, ' ').trim(),
      );

    expect(labels).toEqual(['Dashboard', 'My Tasks', 'Workspaces', 'Calendar', 'Team Settings']);
  });

  it('renders the workspace and user summary details from auth state', () => {
    const fixture = TestBed.createComponent(AuthShellComponent);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('.workspace-label')).nativeElement.textContent.trim(),
    ).toBe('TEAM WORKSPACE');
    expect(
      fixture.debugElement.query(By.css('.profile-name')).nativeElement.textContent.trim(),
    ).toBe('Alex Rivers');
    expect(
      fixture.debugElement.query(By.css('.profile-meta')).nativeElement.textContent.trim(),
    ).toBe('alex@example.com');
  });
});
