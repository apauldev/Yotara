import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { PersonalShellComponent } from './personal-shell.component';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';

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
  let preferences: PreferencesStore;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PersonalShellComponent, InboxStubComponent, SearchStubComponent],
      providers: [
        provideRouter([
          { path: 'tasks', component: InboxStubComponent },
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
        PreferencesStore,
      ],
    }).compileComponents();

    preferences = TestBed.inject(PreferencesStore);
  });

  it('renders the personal navigation in the planned order', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    const labels = fixture.debugElement
      .queryAll(By.css('.nav-item'))
      .map((element) => element.nativeElement.textContent.replace(/\s+/g, ' ').trim());

    expect(labels).toEqual(['Inbox', 'Today', 'Upcoming', 'Projects', 'Labels', 'Archive']);
  });

  it('renders the top bar branding and user avatar', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('.topbar-brand')).nativeElement.textContent.trim(),
    ).toBe('Yotara');
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

    void router.navigateByUrl('/tasks');
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

    expect(router.url).toContain('/search?q=Launch%20Yotara');
  }));

  describe('Login tip popup', () => {
    it('shows a random tip when not previously dismissed', () => {
      const fixture = TestBed.createComponent(PersonalShellComponent);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tip-popup'))).toBeTruthy();
      expect(
        fixture.debugElement.query(By.css('.tip-text')).nativeElement.textContent.trim(),
      ).toBeTruthy();
    });

    it('does not show tip when previously dismissed', () => {
      preferences.setLoginTipDismissed(true);

      const fixture = TestBed.createComponent(PersonalShellComponent);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tip-popup'))).toBeNull();
    });

    it('dismisses the tip when Got it is clicked', () => {
      const fixture = TestBed.createComponent(PersonalShellComponent);
      fixture.detectChanges();

      fixture.debugElement.query(By.css('.tip-gotit')).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tip-popup'))).toBeNull();
      expect(preferences.isLoginTipDismissed()).toBeFalse();
    });

    it("persists dismissal when Don't show again is checked before clicking Got it", () => {
      const fixture = TestBed.createComponent(PersonalShellComponent);
      fixture.detectChanges();

      const checkbox = fixture.debugElement.query(By.css('.tip-checkbox')).nativeElement;
      checkbox.click();
      fixture.detectChanges();

      fixture.debugElement.query(By.css('.tip-gotit')).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tip-popup'))).toBeNull();
      expect(preferences.isLoginTipDismissed()).toBeTrue();
    });

    it('dismisses the tip when backdrop is clicked', () => {
      const fixture = TestBed.createComponent(PersonalShellComponent);
      fixture.detectChanges();

      fixture.debugElement.query(By.css('.tip-backdrop')).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tip-popup'))).toBeNull();
    });

    it('dismisses the tip when X button is clicked', () => {
      const fixture = TestBed.createComponent(PersonalShellComponent);
      fixture.detectChanges();

      fixture.debugElement.query(By.css('.tip-close')).nativeElement.click();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tip-popup'))).toBeNull();
    });
  });
});
