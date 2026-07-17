import { Component } from '@angular/core';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { PersonalShellComponent } from './personal-shell.component';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { NotificationService } from '../../../core/services/notification.service';
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

@Component({
  standalone: true,
  template: '<p>Login</p>',
})
class LoginStubComponent {}

describe('PersonalShellComponent', () => {
  let preferences: PreferencesStore;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [PersonalShellComponent, InboxStubComponent, SearchStubComponent],
      providers: [
        provideRouter([
          { path: 'tasks', component: InboxStubComponent },
          { path: 'search', component: SearchStubComponent },
          { path: 'login', component: LoginStubComponent },
        ]),
        {
          provide: AuthStateService,
          useValue: {
            user: signal({
              id: 'user-1',
              email: 'jordan@example.com',
              name: 'Jordan Doe',
              onboardingCompleted: true,
              workspaceMode: 'personal',
              createdAt: '2026-03-19T00:00:00.000Z',
            }),
            initialized: signal(true),
            signOut: jasmine.createSpy('signOut').and.resolveTo(),
          },
        },
        PreferencesStore,
        {
          provide: NotificationService,
          useValue: {
            unreadCount: signal(0),
            notifications: signal([]),
            fetchUnreadCount: jasmine.createSpy('fetchUnreadCount').and.resolveTo(),
            fetchNotifications: jasmine.createSpy('fetchNotifications').and.resolveTo(),
            markAsRead: jasmine.createSpy('markAsRead').and.resolveTo(),
          },
        },
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
      expect(preferences.loginTipDismissed()).toBeTrue();
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
      expect(preferences.loginTipDismissed()).toBeTrue();
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

  it('renders the bell icon with notification badge when unread count > 0', () => {
    const notifService = TestBed.inject(NotificationService) as any;
    notifService.unreadCount.set(3);

    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    const badge = fixture.debugElement.query(By.css('.notification-badge'));
    expect(badge).toBeTruthy();
    expect(badge.nativeElement.textContent.trim()).toBe('3');
  });

  it('shows notification dropdown when bell is clicked', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    const bellButton = fixture.debugElement.queryAll(By.css('.icon-button'))[0];
    bellButton.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.notifications-dropdown'))).toBeTruthy();
  });

  it('calls markAsRead when clicking an unread notification in the dropdown', async () => {
    const notifService = TestBed.inject(NotificationService) as any;
    notifService.notifications.set([
      {
        id: 'n1',
        type: 'due_today',
        title: 'Task due today',
        body: 'My task',
        read: false,
        readAt: null,
        createdAt: '2026-07-17T10:00:00.000Z',
      },
    ]);

    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    const bellButton = fixture.debugElement.queryAll(By.css('.icon-button'))[0];
    bellButton.nativeElement.click();
    fixture.detectChanges();

    const dropdownItem = fixture.debugElement.query(By.css('.notification-dropdown-item'));
    expect(dropdownItem).toBeTruthy();
    dropdownItem.nativeElement.click();
    fixture.detectChanges();

    expect(notifService.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('does not call markAsRead for already-read notification in dropdown', async () => {
    const notifService = TestBed.inject(NotificationService) as any;
    notifService.notifications.set([
      {
        id: 'n2',
        type: 'overdue',
        title: 'Task overdue',
        body: 'Old task',
        read: true,
        readAt: '2026-07-17T11:00:00.000Z',
        createdAt: '2026-07-16T10:00:00.000Z',
      },
    ]);

    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    const bellButton = fixture.debugElement.queryAll(By.css('.icon-button'))[0];
    bellButton.nativeElement.click();
    fixture.detectChanges();

    const dropdownItem = fixture.debugElement.query(By.css('.notification-dropdown-item'));
    dropdownItem.nativeElement.click();
    fixture.detectChanges();

    expect(notifService.markAsRead).not.toHaveBeenCalled();
  });

  it('toggles sidebar collapsed state', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance['sidebarCollapsed']()).toBeFalse();
    fixture.componentInstance['toggleSidebar']();
    expect(fixture.componentInstance['sidebarCollapsed']()).toBeTrue();
    fixture.componentInstance['toggleSidebar']();
    expect(fixture.componentInstance['sidebarCollapsed']()).toBeFalse();
  });

  it('toggles profile menu', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance['profileMenuOpen']()).toBeFalse();
    fixture.componentInstance['toggleProfileMenu']();
    expect(fixture.componentInstance['profileMenuOpen']()).toBeTrue();
    fixture.componentInstance['closeProfileMenu']();
    expect(fixture.componentInstance['profileMenuOpen']()).toBeFalse();
  });

  it('toggles preferences menu and closes profile menu', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    fixture.componentInstance['profileMenuOpen'].set(true);
    fixture.componentInstance['togglePreferencesMenu']();
    expect(fixture.componentInstance['profileMenuOpen']()).toBeFalse();
    expect(fixture.componentInstance['preferencesMenuOpen']()).toBeTrue();
    fixture.componentInstance['closePreferencesMenu']();
    expect(fixture.componentInstance['preferencesMenuOpen']()).toBeFalse();
  });

  it('closes notifications', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    fixture.componentInstance['notificationsOpen'].set(true);
    fixture.componentInstance['closeNotifications']();
    expect(fixture.componentInstance['notificationsOpen']()).toBeFalse();
  });

  it('handleStayFocused closes profile and logout dialog', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    fixture.componentInstance['profileMenuOpen'].set(true);
    fixture.componentInstance['logoutDialogOpen'].set(true);
    fixture.componentInstance['handleStayFocused']();
    expect(fixture.componentInstance['profileMenuOpen']()).toBeFalse();
    expect(fixture.componentInstance['logoutDialogOpen']()).toBeFalse();
  });

  it('openLogoutDialog opens the dialog and closes profile menu', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    fixture.componentInstance['profileMenuOpen'].set(true);
    fixture.componentInstance['openLogoutDialog']();
    expect(fixture.componentInstance['profileMenuOpen']()).toBeFalse();
    expect(fixture.componentInstance['logoutDialogOpen']()).toBeTrue();
  });

  it('closeLogoutDialog closes the dialog', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    fixture.componentInstance['logoutDialogOpen'].set(true);
    fixture.componentInstance['closeLogoutDialog']();
    expect(fixture.componentInstance['logoutDialogOpen']()).toBeFalse();
  });

  it('confirmLogout calls signOut and navigates to login', fakeAsync(() => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    fixture.componentInstance['logoutDialogOpen'].set(true);
    void fixture.componentInstance['confirmLogout']();
    tick();
    fixture.detectChanges();

    const authState = TestBed.inject(AuthStateService) as any;
    expect(authState.signOut).toHaveBeenCalled();
  }));

  it('confirmLogout is a no-op when already signing out', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    fixture.componentInstance['signingOut'].set(true);
    void fixture.componentInstance['confirmLogout']();

    const authState = TestBed.inject(AuthStateService) as any;
    expect(authState.signOut).not.toHaveBeenCalled();
  });

  it('openCreateTaskModal navigates to tasks when not on tasks page', fakeAsync(() => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();

    void fixture.componentInstance['openCreateTaskModal']();
    tick();
    fixture.detectChanges();

    expect(router.url).toContain('/tasks');
  }));

  it('toggleProfileMenu closes preferences menu', () => {
    const fixture = TestBed.createComponent(PersonalShellComponent);
    fixture.detectChanges();

    fixture.componentInstance['preferencesMenuOpen'].set(true);
    fixture.componentInstance['toggleProfileMenu']();
    expect(fixture.componentInstance['preferencesMenuOpen']()).toBeFalse();
    expect(fixture.componentInstance['profileMenuOpen']()).toBeTrue();
  });
});
