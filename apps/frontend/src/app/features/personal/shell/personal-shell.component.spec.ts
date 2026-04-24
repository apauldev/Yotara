import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { PersonalShellComponent } from './personal-shell.component';
import { AuthStateService } from '../../../core/services/auth-state.service';

@Component({
  standalone: true,
  template: '<p>Inbox</p>',
})
class InboxStubComponent {}

@Component({
  standalone: true,
  template: '<p>Search</p>',
})
class SearchStubComponent {}

describe('PersonalShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalShellComponent, InboxStubComponent],
      providers: [
        provideRouter([
          { path: 'inbox', component: InboxStubComponent },
          { path: 'search', component: SearchStubComponent },
        ]),
        {
          provide: AuthStateService,
          useValue: {
            user: () => ({
              id: 'user-1',
              email: 'jordan@example.com',
              name: 'Jordan Doe',
              onboardingCompleted: true,
              workspaceMode: 'personal',
              createdAt: '2026-03-19T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the personal navigation in the planned order', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.nav-item'))
      .map((element) => element.nativeElement.textContent.replace(/\s+/g, ' ').trim());

    expect(labels).toEqual(['Inbox', 'Today', 'Upcoming', 'Projects', 'Labels']);
  });

  it('renders the top bar and quick add affordance', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('.topbar-brand')).nativeElement.textContent.trim(),
    ).toBe('Yotara');
    expect(
      fixture.debugElement.query(By.css('.quick-add-button')).nativeElement.textContent.trim(),
    ).toContain('Quick Add Task');
    expect(fixture.debugElement.query(By.css('.avatar')).nativeElement.textContent.trim()).toBe(
      'JD',
    );
  });

  it('opens and closes the mobile navigation drawer', fakeAsync(() => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    const toggleButton = fixture.debugElement.query(By.css('.menu-toggle')).nativeElement;
    toggleButton.click();
    fixture.detectChanges();

    expect(
      fixture.debugElement
        .query(By.css('.sidebar'))
        .nativeElement.classList.contains('sidebar-open'),
    ).toBeTrue();
    expect(fixture.debugElement.query(By.css('.mobile-backdrop'))).toBeTruthy();

    void router.navigateByUrl('/inbox');
    tick();
    fixture.detectChanges();

    expect(
      fixture.debugElement
        .query(By.css('.sidebar'))
        .nativeElement.classList.contains('sidebar-open'),
    ).toBeFalse();
  }));

  it('navigates to the search results page when the search form is submitted', fakeAsync(() => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    fixture.componentInstance['searchQuery'].set('Launch Yotara');
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.search-shell')).triggerEventHandler('ngSubmit', {});
    tick();
    fixture.detectChanges();

    expect(router.url).toBe('/search?q=Launch%20Yotara');
  }));
});
