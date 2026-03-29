import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStateService } from '../../core/services/auth-state.service';

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
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
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
              <svg viewBox="0 0 24 24">
                <path
                  d="M20 4C11 4 4 10.3 4 18c0 .9.1 1.8.4 2.6A9.8 9.8 0 0 0 12 24c6.6 0 12-5.4 12-12V4h-4Z"
                />
                <path
                  class="brand-vein"
                  d="M7.5 16.8a1 1 0 1 0 1.5 1.4c1.6-1.7 4-3.4 7.4-4.5a1 1 0 1 0-.6-1.9c-3.8 1.3-6.6 3.2-8.3 5Z"
                />
              </svg>
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
                        <svg viewBox="0 0 24 24">
                          <path d="M4 4h6v6H4zM14 4h6v4h-6zM14 10h6v10h-6zM4 14h6v6H4z" />
                        </svg>
                      }
                      @case ('tasks') {
                        <svg viewBox="0 0 24 24">
                          <path d="M7 12.5 10 15l7-7" />
                          <path d="M5 6h14" />
                          <path d="M5 18h14" />
                        </svg>
                      }
                      @case ('workspaces') {
                        <svg viewBox="0 0 24 24">
                          <path d="M8 7a2.5 2.5 0 1 0 0 .01" />
                          <path d="M16 7a2.5 2.5 0 1 0 0 .01" />
                          <path d="M8 17a2.5 2.5 0 1 0 0 .01" />
                          <path d="M16 17a2.5 2.5 0 1 0 0 .01" />
                        </svg>
                      }
                      @case ('calendar') {
                        <svg viewBox="0 0 24 24">
                          <path d="M7 3v4" />
                          <path d="M17 3v4" />
                          <path d="M4 9h16" />
                          <rect x="4" y="5" width="16" height="15" rx="2" />
                        </svg>
                      }
                      @case ('team') {
                        <svg viewBox="0 0 24 24">
                          <path d="M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
                          <circle cx="10" cy="8" r="3" />
                          <path d="M20 20v-1a4 4 0 0 0-3-3.87" />
                          <path d="M14 5.13a3 3 0 0 1 0 5.74" />
                        </svg>
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
                        <svg viewBox="0 0 24 24">
                          <path d="M4 4h6v6H4zM14 4h6v4h-6zM14 10h6v10h-6zM4 14h6v6H4z" />
                        </svg>
                      }
                      @case ('tasks') {
                        <svg viewBox="0 0 24 24">
                          <path d="M7 12.5 10 15l7-7" />
                          <path d="M5 6h14" />
                          <path d="M5 18h14" />
                        </svg>
                      }
                      @case ('workspaces') {
                        <svg viewBox="0 0 24 24">
                          <path d="M8 7a2.5 2.5 0 1 0 0 .01" />
                          <path d="M16 7a2.5 2.5 0 1 0 0 .01" />
                          <path d="M8 17a2.5 2.5 0 1 0 0 .01" />
                          <path d="M16 17a2.5 2.5 0 1 0 0 .01" />
                        </svg>
                      }
                      @case ('calendar') {
                        <svg viewBox="0 0 24 24">
                          <path d="M7 3v4" />
                          <path d="M17 3v4" />
                          <path d="M4 9h16" />
                          <rect x="4" y="5" width="16" height="15" rx="2" />
                        </svg>
                      }
                      @case ('team') {
                        <svg viewBox="0 0 24 24">
                          <path d="M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
                          <circle cx="10" cy="8" r="3" />
                          <path d="M20 20v-1a4 4 0 0 0-3-3.87" />
                          <path d="M14 5.13a3 3 0 0 1 0 5.74" />
                        </svg>
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

          <div class="profile-card">
            <div class="avatar" aria-hidden="true">{{ userInitials() }}</div>
            <div class="profile-copy">
              <div class="profile-name">{{ displayName() }}</div>
              <div class="profile-meta">{{ profileMeta() }}</div>
            </div>
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
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
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
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        background: #e7efe5;
        color: #4f986f;
        display: grid;
        place-items: center;
      }

      .brand-mark svg {
        width: 1.1rem;
        height: 1.1rem;
        display: block;
        fill: currentColor;
      }

      .brand-vein {
        fill: #f7f8f4;
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

      .profile-card {
        display: flex;
        align-items: center;
        gap: 0.82rem;
        padding: 0.9rem 0.35rem 0;
        border-top: 1px solid rgba(120, 138, 143, 0.18);
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

  protected readonly mobileMenuOpen = signal(false);

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
    });
  }

  protected toggleMobileMenu() {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }
}
