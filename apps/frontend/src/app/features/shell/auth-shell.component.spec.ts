import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { AuthShellComponent } from './auth-shell.component';
import { AuthStateService } from '../../core/services/auth-state.service';

@Component({
  standalone: true,
  template: '<p>Dashboard</p>',
})
class DashboardStubComponent {}

describe('AuthShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthShellComponent, DashboardStubComponent],
      providers: [
        provideRouter([{ path: 'dashboard', component: DashboardStubComponent }]),
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

  it('toggles the mobile menu from the hamburger button', () => {
    const fixture = TestBed.createComponent(AuthShellComponent);
    fixture.detectChanges();

    const toggleButton = fixture.debugElement.query(By.css('.menu-toggle')).nativeElement;
    const sidebar = fixture.debugElement.query(By.css('.sidebar')).nativeElement;

    expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar.classList.contains('sidebar-open')).toBeFalse();

    toggleButton.click();
    fixture.detectChanges();

    expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar.classList.contains('sidebar-open')).toBeTrue();
    expect(fixture.debugElement.query(By.css('.mobile-backdrop'))).toBeTruthy();
  });

  it('closes the mobile menu when the backdrop is clicked', () => {
    const fixture = TestBed.createComponent(AuthShellComponent);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.menu-toggle')).nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.mobile-backdrop')).nativeElement.click();
    fixture.detectChanges();

    expect(
      fixture.debugElement
        .query(By.css('.sidebar'))
        .nativeElement.classList.contains('sidebar-open'),
    ).toBeFalse();
    expect(fixture.debugElement.query(By.css('.mobile-backdrop'))).toBeNull();
  });

  it('closes the mobile menu after navigation completes', fakeAsync(() => {
    const fixture = TestBed.createComponent(AuthShellComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.menu-toggle')).nativeElement.click();
    fixture.detectChanges();

    void router.navigateByUrl('/dashboard');
    tick();
    fixture.detectChanges();

    expect(
      fixture.debugElement
        .query(By.css('.sidebar'))
        .nativeElement.classList.contains('sidebar-open'),
    ).toBeFalse();
    expect(
      fixture.debugElement
        .query(By.css('.menu-toggle'))
        .nativeElement.getAttribute('aria-expanded'),
    ).toBe('false');
  }));
});
