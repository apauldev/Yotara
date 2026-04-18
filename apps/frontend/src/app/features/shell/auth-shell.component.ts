import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBars,
  faChartColumn,
  faCalendarDays,
  faLeaf,
  faSquareCheck,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { filter } from 'rxjs';
import { AuthStateService } from '../../core/services/auth-state.service';
import { LogoutConfirmModalComponent } from '../../shared/ui/logout-confirm-modal/logout-confirm-modal.component';

type SidebarIcon = 'dashboard' | 'tasks' | 'workspaces' | 'calendar' | 'team';

interface SidebarItem {
  label: string;
  icon: SidebarIcon;
  route: string | null;
  disabled?: boolean;
}

@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LogoutConfirmModalComponent,
  ],
  template: `
    <div class="shell">
      @if (mobileMenuOpen()) {
        <button
          type="button"
          class="mobile-backdrop"
          aria-label="Close navigation menu"
          (click)="closeMobileMenu()"
        ></button>
      }

      <aside class="sidebar" aria-label="Primary" [class.sidebar-open]="mobileMenuOpen()">
        <div class="sidebar-top">
          <div class="brand">
            <div class="brand-mark" aria-hidden="true">
              <fa-icon [icon]="faLeaf" aria-hidden="true"></fa-icon>
            </div>
            <div>
              <div class="brand-name">Yotara</div>
              <div class="workspace-label">{{ workspaceLabel() }}</div>
            </div>
          </div>

          <nav id="primary-navigation" class="nav-list">
            @for (item of navItems; track item.label) {
              @if (item.route) {
                <a
                  [routerLink]="item.route"
                  routerLinkActive="nav-item-active"
                  [routerLinkActiveOptions]="{ exact: true }"
                  class="nav-item"
                >
                  <span class="nav-icon" aria-hidden="true">
                    @switch (item.icon) {
                      @case ('dashboard') {
                        <fa-icon [icon]="faChartColumn"></fa-icon>
                      }
                      @case ('tasks') {
                        <fa-icon [icon]="faSquareCheck"></fa-icon>
                      }
                      @case ('workspaces') {
                        <fa-icon [icon]="faUsers"></fa-icon>
                      }
                      @case ('calendar') {
                        <fa-icon [icon]="faCalendarDays"></fa-icon>
                      }
                      @case ('team') {
                        <fa-icon [icon]="faUsers"></fa-icon>
                      }
                    }
                  </span>
                  <span>{{ item.label }}</span>
                </a>
              } @else {
                <button type="button" class="nav-item nav-item-disabled" disabled>
                  <span class="nav-icon" aria-hidden="true">
                    @switch (item.icon) {
                      @case ('dashboard') {
                        <fa-icon [icon]="faChartColumn"></fa-icon>
                      }
                      @case ('tasks') {
                        <fa-icon [icon]="faSquareCheck"></fa-icon>
                      }
                      @case ('workspaces') {
                        <fa-icon [icon]="faUsers"></fa-icon>
                      }
                      @case ('calendar') {
                        <fa-icon [icon]="faCalendarDays"></fa-icon>
                      }
                      @case ('team') {
                        <fa-icon [icon]="faUsers"></fa-icon>
                      }
                    }
                  </span>
                  <span>{{ item.label }}</span>
                  <span class="nav-badge">Soon</span>
                </button>
              }
            }
          </nav>
        </div>

        <div class="sidebar-bottom">
          <button type="button" class="invite-button">Invite Member</button>

          <div class="profile-menu">
            @if (profileMenuOpen()) {
              <button
                type="button"
                class="profile-menu-backdrop"
                aria-label="Close profile menu"
                (click)="closeProfileMenu()"
              ></button>
            }

            <button
              type="button"
              class="profile-card profile-card-button"
              [attr.aria-expanded]="profileMenuOpen()"
              aria-label="Open account menu"
              (click)="toggleProfileMenu()"
            >
              <div class="avatar" aria-hidden="true">{{ userInitials() }}</div>
              <div class="profile-copy">
                <div class="profile-name">{{ displayName() }}</div>
                <div class="profile-meta">{{ profileMeta() }}</div>
              </div>
            </button>

            @if (profileMenuOpen()) {
              <div class="profile-menu-card" role="menu" aria-label="Account actions">
                <button
                  type="button"
                  class="profile-menu-item"
                  role="menuitem"
                  (click)="handleStayFocused()"
                >
                  Stay and Focus
                </button>
                <button
                  type="button"
                  class="profile-menu-item profile-menu-item-danger"
                  role="menuitem"
                  (click)="openLogoutDialog()"
                >
                  Logout
                </button>
              </div>
            }
          </div>
        </div>
      </aside>

      <main class="content">
        <header class="mobile-header">
          <button
            type="button"
            class="menu-toggle"
            [attr.aria-expanded]="mobileMenuOpen()"
            aria-controls="primary-navigation"
            aria-label="Toggle navigation menu"
            (click)="toggleMobileMenu()"
          >
            <fa-icon [icon]="faBars" aria-hidden="true"></fa-icon>
          </button>

          <div class="mobile-brand">
            <div class="mobile-brand-title">Yotara</div>
            <div class="mobile-brand-subtitle">{{ workspaceLabel() }}</div>
          </div>
        </header>

        <div class="content-inner">
          <router-outlet />
        </div>
      </main>
    </div>

    <app-logout-confirm-modal
      [open]="logoutDialogOpen()"
      [loading]="signingOut()"
      (close)="closeLogoutDialog()"
      (stay)="handleStayFocused()"
      (confirm)="confirmLogout()"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100dvh;
        background:
          radial-gradient(circle at top left, rgba(241, 244, 236, 0.9), transparent 28%), #f4f1e7;
        color: #1f2937;
        font-family: 'Avenir Next', 'Manrope', 'Segoe UI', sans-serif;
      }

      .shell {
        min-height: 100dvh;
        display: grid;
        grid-template-columns: minmax(15.5rem, 17rem) minmax(0, 1fr);
        position: relative;
      }

      .mobile-backdrop {
        display: none;
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 1.15rem 1rem 1rem;
        background: rgba(255, 255, 255, 0.84);
        border-right: 1px solid rgba(128, 146, 126, 0.2);
        backdrop-filter: blur(12px);
        position: relative;
        z-index: 2;
      }

      .sidebar-top {
        display: grid;
        gap: 2rem;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 0.1rem 0.35rem;
      }

      .brand-mark {
        width: 2.15rem;
        height: 2.15rem;
        border-radius: 999px;
        background: #e7efe5;
        color: #4f986f;
        display: grid;
        place-items: center;
      }

      .brand-mark fa-icon {
        font-size: 1.02rem;
      }

      .brand-name {
        font-size: 1.6rem;
        line-height: 1;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: #203027;
      }

      .workspace-label {
        margin-top: 0.28rem;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #6ea288;
      }

      .nav-list {
        display: grid;
        gap: 0.4rem;
      }

      .nav-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.78rem;
        border: 0;
        border-radius: 0.7rem;
        background: transparent;
        color: #55657d;
        text-decoration: none;
        text-align: left;
        padding: 0.9rem 0.85rem;
        font-size: 0.97rem;
        font-weight: 600;
        cursor: pointer;
        transition:
          background-color 140ms ease,
          color 140ms ease,
          transform 140ms ease;
      }

      .nav-item:hover {
        background: rgba(79, 152, 111, 0.08);
        color: #355e4b;
      }

      .nav-item-active {
        background: #4f986f;
        color: #f7f7f2;
        box-shadow: 0 10px 22px rgba(69, 127, 92, 0.18);
      }

      .nav-item-active .nav-icon {
        color: currentColor;
      }

      .nav-item-disabled {
        opacity: 0.78;
        cursor: not-allowed;
      }

      .nav-item-disabled:hover {
        background: transparent;
        color: #55657d;
        transform: none;
      }

      .nav-icon {
        width: 1.15rem;
        height: 1.15rem;
        color: #5d6d86;
        flex: 0 0 auto;
      }

      .nav-icon :is(svg) {
        width: 100%;
        height: 100%;
        display: block;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .nav-icon fa-icon,
      .menu-toggle fa-icon {
        width: 100%;
        height: 100%;
        display: block;
      }

      .nav-badge {
        margin-left: auto;
        border-radius: 999px;
        background: rgba(79, 152, 111, 0.1);
        color: #5b896f;
        padding: 0.18rem 0.45rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .sidebar-bottom {
        display: grid;
        gap: 1rem;
      }

      .invite-button {
        width: 100%;
        border: 0;
        border-radius: 0.78rem;
        background: #eef4ed;
        color: #4f986f;
        padding: 0.95rem 1rem;
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: -0.01em;
      }

      .profile-menu {
        position: relative;
      }

      .profile-menu-backdrop {
        position: fixed;
        inset: 0;
        border: 0;
        background: transparent;
        z-index: 4;
      }

      .profile-menu-card {
        position: absolute;
        bottom: calc(100% + 0.4rem);
        left: 0;
        right: 0;
        border-radius: 0.9rem;
        background: rgba(255, 251, 243, 0.97);
        border: 1px solid rgba(226, 219, 204, 0.95);
        box-shadow: 0 14px 30px rgba(64, 62, 51, 0.18);
        padding: 0.3rem;
        display: grid;
        gap: 0.2rem;
        z-index: 5;
      }

      .profile-menu-item {
        border: 0;
        border-radius: 0.64rem;
        background: transparent;
        color: #3d423b;
        text-align: left;
        font-weight: 600;
        padding: 0.58rem 0.66rem;
        cursor: pointer;
      }

      .profile-menu-item:hover {
        background: rgba(207, 225, 214, 0.45);
      }

      .profile-menu-item-danger {
        color: #8a453a;
      }

      .profile-card {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.82rem;
        padding: 0.9rem 0.35rem 0;
        border-top: 1px solid rgba(120, 138, 143, 0.18);
      }

      .profile-card-button {
        border-left: 0;
        border-right: 0;
        border-bottom: 0;
        background: transparent;
        cursor: pointer;
      }

      .avatar {
        width: 2.7rem;
        height: 2.7rem;
        border-radius: 999px;
        background: linear-gradient(135deg, #f4c7a1, #8bb49a);
        color: #fffdf8;
        display: grid;
        place-items: center;
        font-size: 0.92rem;
        font-weight: 700;
        flex: 0 0 auto;
      }

      .profile-copy {
        min-width: 0;
      }

      .profile-name,
      .profile-meta {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .profile-name {
        font-size: 0.95rem;
        font-weight: 700;
        color: #223128;
      }

      .profile-meta {
        margin-top: 0.12rem;
        font-size: 0.79rem;
        color: #6f7f91;
      }

      .content {
        min-width: 0;
        padding: 1.6rem;
      }

      .mobile-header {
        display: none;
      }

      .menu-toggle {
        border: 1px solid rgba(128, 146, 126, 0.28);
        border-radius: 0.9rem;
        background: rgba(255, 255, 255, 0.92);
        width: 3rem;
        height: 3rem;
        padding: 0;
        color: #2f4b3d;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 8px 22px rgba(51, 79, 61, 0.08);
      }

      .menu-toggle svg {
        width: 1.35rem;
        height: 1.35rem;
        display: block;
        stroke: currentColor;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
      }

      .mobile-brand-title {
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: #203027;
      }

      .mobile-brand-subtitle {
        margin-top: 0.15rem;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #6ea288;
      }

      .content-inner {
        min-height: calc(100dvh - 3.2rem);
        border-radius: 1.6rem;
        background: rgba(255, 251, 242, 0.5);
        border: 1px solid rgba(214, 221, 208, 0.7);
        padding: 1.75rem;
      }

      @media (max-width: 920px) {
        .shell {
          grid-template-columns: 1fr;
        }

        .mobile-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 1;
          border: 0;
          background: rgba(25, 37, 33, 0.3);
        }

        .sidebar {
          gap: 1.25rem;
          border-right: 0;
          border-bottom: 1px solid rgba(128, 146, 126, 0.2);
          position: fixed;
          inset: 0 auto 0 0;
          width: min(85vw, 20rem);
          transform: translateX(-100%);
          transition: transform 180ms ease;
          box-shadow: 18px 0 36px rgba(45, 65, 57, 0.18);
        }

        .sidebar.sidebar-open {
          transform: translateX(0);
        }

        .sidebar-top {
          gap: 1.25rem;
        }

        .mobile-header {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          margin-bottom: 1rem;
        }

        .menu-toggle {
          display: inline-flex;
        }

        .nav-list {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 680px) {
        .content {
          padding: 1rem;
        }

        .content-inner {
          min-height: auto;
          padding: 1rem;
          border-radius: 1rem;
        }

        .mobile-header {
          margin-bottom: 0.85rem;
        }

        .nav-list {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AuthShellComponent {
  private authState = inject(AuthStateService);
  private router = inject(Router);

  protected readonly faBars = faBars;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faChartColumn = faChartColumn;
  protected readonly faLeaf = faLeaf;
  protected readonly faSquareCheck = faSquareCheck;
  protected readonly faUsers = faUsers;

  protected readonly mobileMenuOpen = signal(false);
  protected readonly profileMenuOpen = signal(false);
  protected readonly logoutDialogOpen = signal(false);
  protected readonly signingOut = signal(false);

  protected readonly navItems: SidebarItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'My Tasks', icon: 'tasks', route: null, disabled: true },
    { label: 'Workspaces', icon: 'workspaces', route: null, disabled: true },
    { label: 'Calendar', icon: 'calendar', route: null, disabled: true },
    { label: 'Team Settings', icon: 'team', route: null, disabled: true },
  ];

  protected readonly user = this.authState.user;
  protected readonly workspaceLabel = computed(() => {
    const mode = this.user()?.workspaceMode;

    if (mode === 'team') {
      return 'TEAM WORKSPACE';
    }

    if (mode === 'personal') {
      return 'PERSONAL WORKSPACE';
    }

    return 'WORKSPACE';
  });

  protected readonly displayName = computed(() => {
    const user = this.user();
    return user?.name?.trim() || user?.email || 'Yotara Member';
  });

  protected readonly profileMeta = computed(() => {
    const user = this.user();

    if (!user) {
      return 'Signed in';
    }

    return user.email || this.workspaceLabel().replace(' WORKSPACE', '');
  });

  protected readonly userInitials = computed(() => {
    const source = this.displayName().trim();
    if (!source) {
      return 'YT';
    }

    const parts = source.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.mobileMenuOpen.set(false);
      this.profileMenuOpen.set(false);
    });
  }

  protected toggleMobileMenu() {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  protected toggleProfileMenu() {
    this.profileMenuOpen.update((open) => !open);
  }

  protected closeProfileMenu() {
    this.profileMenuOpen.set(false);
  }

  protected handleStayFocused() {
    this.profileMenuOpen.set(false);
    this.logoutDialogOpen.set(false);
  }

  protected openLogoutDialog() {
    this.profileMenuOpen.set(false);
    this.logoutDialogOpen.set(true);
  }

  protected closeLogoutDialog() {
    this.logoutDialogOpen.set(false);
  }

  protected async confirmLogout() {
    if (this.signingOut()) {
      return;
    }

    this.signingOut.set(true);
    try {
      await this.authState.signOut();
      this.logoutDialogOpen.set(false);
      await this.router.navigateByUrl('/login');
    } finally {
      this.signingOut.set(false);
    }
  }
}
