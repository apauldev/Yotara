import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth-state.service';

type PersonalIcon = 'inbox' | 'today' | 'upcoming' | 'projects' | 'labels';

interface PersonalNavItem {
  label: string;
  route: string;
  icon: PersonalIcon;
}

@Component({
  selector: 'app-personal-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="personal-shell">
      @if (mobileMenuOpen()) {
        <button
          type="button"
          class="mobile-backdrop"
          aria-label="Close personal navigation"
          (click)="closeMobileMenu()"
        ></button>
      }

      <aside class="sidebar" [class.sidebar-open]="mobileMenuOpen()">
        <div class="sidebar-top">
          <div class="sidebar-brand">
            <h1>Personal Sanctuary</h1>
            <p>Focus Mode Active</p>
          </div>

          <nav class="nav-list" aria-label="Personal navigation">
            @for (item of navItems; track item.route) {
              <a
                [routerLink]="item.route"
                routerLinkActive="nav-item-active"
                [routerLinkActiveOptions]="{ exact: true }"
                class="nav-item"
              >
                <span class="nav-icon" aria-hidden="true">
                  @switch (item.icon) {
                    @case ('inbox') {
                      <svg viewBox="0 0 24 24">
                        <path d="M4 6h16v10H4z" />
                        <path d="M8 12h8" />
                      </svg>
                    }
                    @case ('today') {
                      <svg viewBox="0 0 24 24">
                        <path d="M7 3v4" />
                        <path d="M17 3v4" />
                        <path d="M4 9h16" />
                        <rect x="4" y="5" width="16" height="15" rx="2" />
                      </svg>
                    }
                    @case ('upcoming') {
                      <svg viewBox="0 0 24 24">
                        <path d="M3 12h9" />
                        <path d="m9 6 6 6-6 6" />
                        <path d="M19 5v14" />
                      </svg>
                    }
                    @case ('projects') {
                      <svg viewBox="0 0 24 24">
                        <path d="M3 7h18v11H3z" />
                        <path d="M8 7V5h8v2" />
                      </svg>
                    }
                    @case ('labels') {
                      <svg viewBox="0 0 24 24">
                        <path d="M11 4H4v7l9 9 7-7z" />
                        <circle cx="8.5" cy="8.5" r="1" />
                      </svg>
                    }
                  }
                </span>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>
        </div>

        <div class="sidebar-bottom">
          <a routerLink="/inbox" fragment="capture" class="quick-add-button">
            <span class="quick-add-icon">+</span>
            Quick Add Task
          </a>

          <div class="mode-switcher">
            <button type="button" class="mode-button mode-button-active">Simple Mode</button>
            <button type="button" class="mode-button" disabled>Team Mode</button>
          </div>
        </div>
      </aside>

      <main class="content">
        <header class="topbar">
          <div class="topbar-left">
            <button
              type="button"
              class="menu-toggle"
              [attr.aria-expanded]="mobileMenuOpen()"
              aria-label="Toggle navigation menu"
              (click)="toggleMobileMenu()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </button>

            <a routerLink="/inbox" class="topbar-brand">Yotara</a>

            <label class="search-shell">
              <span class="search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="6"></circle>
                  <path d="m20 20-3.5-3.5"></path>
                </svg>
              </span>
              <input type="search" placeholder="Search your sanctuary..." />
            </label>
          </div>

          <div class="topbar-actions">
            <button type="button" class="icon-button" aria-label="Notifications">
              <svg viewBox="0 0 24 24">
                <path d="M15 17H9" />
                <path d="M18 17V11a6 6 0 1 0-12 0v6l-2 2h16z" />
              </svg>
            </button>
            <button type="button" class="icon-button" aria-label="Preferences">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"
                />
              </svg>
            </button>
            <div class="avatar">{{ userInitials() }}</div>
          </div>
        </header>

        <div class="page-surface">
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
          radial-gradient(circle at top left, rgba(246, 243, 231, 0.98), transparent 22%), #f8f4e8;
        color: #20211d;
        font-family: 'Avenir Next', 'Manrope', 'Segoe UI', sans-serif;
      }

      .personal-shell {
        min-height: 100dvh;
        display: grid;
        grid-template-columns: 13.5rem minmax(0, 1fr);
        position: relative;
      }

      .mobile-backdrop {
        display: none;
      }

      .sidebar {
        background: rgba(255, 255, 255, 0.72);
        border-right: 1px solid rgba(226, 219, 201, 0.8);
        padding: 1rem 0.95rem 0.95rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        backdrop-filter: blur(14px);
        z-index: 2;
      }

      .sidebar-top {
        display: grid;
        gap: 1.75rem;
      }

      .sidebar-brand h1 {
        margin: 0;
        font-size: 1.65rem;
        line-height: 1.05;
        letter-spacing: -0.04em;
      }

      .sidebar-brand p {
        margin: 0.35rem 0 0;
        font-size: 0.82rem;
        color: #73a08a;
      }

      .nav-list {
        display: grid;
        gap: 0.5rem;
      }

      .nav-item {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        text-decoration: none;
        color: #5c635c;
        padding: 0.82rem 0.9rem;
        border-radius: 0.95rem;
        font-weight: 600;
        font-size: 0.95rem;
        transition:
          background-color 140ms ease,
          color 140ms ease;
      }

      .nav-item:hover {
        background: rgba(167, 230, 204, 0.2);
        color: #315946;
      }

      .nav-item-active {
        background: #dbf5e7;
        color: #255944;
      }

      .nav-icon {
        width: 1.15rem;
        height: 1.15rem;
        flex: 0 0 auto;
      }

      .nav-icon svg {
        width: 100%;
        height: 100%;
        display: block;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .sidebar-bottom {
        display: grid;
        gap: 1.4rem;
      }

      .quick-add-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.7rem;
        min-height: 3.2rem;
        border-radius: 1rem;
        background: #256c47;
        color: #f5f8f2;
        text-decoration: none;
        font-weight: 700;
        box-shadow: 0 18px 28px rgba(27, 90, 57, 0.2);
      }

      .quick-add-icon {
        font-size: 1.35rem;
        line-height: 1;
      }

      .mode-switcher {
        display: grid;
        gap: 0.45rem;
      }

      .mode-button {
        border: 0;
        background: transparent;
        color: #7a7d73;
        text-align: left;
        padding: 0.3rem 0.4rem;
        font-size: 0.92rem;
      }

      .mode-button-active {
        color: #255944;
        font-weight: 700;
      }

      .content {
        min-width: 0;
        padding: 0 1.2rem 1.5rem;
      }

      .topbar {
        min-height: 5.2rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        max-width: 74rem;
        margin: 0 auto;
      }

      .topbar-left {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
      }

      .topbar-brand {
        color: #1e6f49;
        text-decoration: none;
        font-size: 1.8rem;
        font-weight: 700;
        letter-spacing: -0.04em;
      }

      .search-shell {
        flex: 1;
        min-width: 0;
        max-width: 20rem;
        display: flex;
        align-items: center;
        gap: 0.55rem;
        border-radius: 999px;
        padding: 0.78rem 1rem;
        background: rgba(255, 251, 242, 0.88);
        border: 1px solid rgba(232, 224, 208, 0.85);
      }

      .search-shell input {
        width: 100%;
        border: 0;
        outline: none;
        background: transparent;
        color: #4f534b;
        font-size: 0.92rem;
      }

      .search-shell input::placeholder {
        color: #b1aa9e;
      }

      .search-icon {
        width: 1rem;
        height: 1rem;
        color: #b1aa9e;
      }

      .search-icon svg,
      .topbar-actions svg,
      .menu-toggle svg {
        width: 100%;
        height: 100%;
        display: block;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .topbar-actions {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }

      .icon-button,
      .menu-toggle {
        width: 2.7rem;
        height: 2.7rem;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #6e7267;
        cursor: pointer;
      }

      .menu-toggle {
        display: none;
        border-radius: 0.9rem;
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(228, 220, 202, 0.9);
      }

      .avatar {
        width: 2.7rem;
        height: 2.7rem;
        border-radius: 999px;
        background: #3d8b61;
        color: #f5f8f2;
        display: grid;
        place-items: center;
        font-size: 0.9rem;
        font-weight: 700;
      }

      .page-surface {
        min-height: calc(100dvh - 5.2rem);
        max-width: 74rem;
        margin: 0 auto;
        width: 100%;
      }

      @media (max-width: 920px) {
        .personal-shell {
          grid-template-columns: 1fr;
        }

        .mobile-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 1;
          border: 0;
          background: rgba(37, 39, 34, 0.28);
        }

        .sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: min(80vw, 19rem);
          transform: translateX(-100%);
          transition: transform 180ms ease;
          box-shadow: 18px 0 38px rgba(58, 57, 45, 0.14);
        }

        .sidebar-open {
          transform: translateX(0);
        }

        .content {
          padding: 0 1rem 1rem;
        }

        .menu-toggle {
          display: inline-grid;
          place-items: center;
        }
      }

      @media (max-width: 720px) {
        .topbar {
          min-height: auto;
          padding: 0.9rem 0 0.75rem;
          align-items: stretch;
          flex-direction: column;
        }

        .topbar-left {
          width: 100%;
          flex-wrap: wrap;
        }

        .search-shell {
          order: 3;
          max-width: none;
          flex-basis: 100%;
        }

        .topbar-actions {
          width: 100%;
          justify-content: flex-end;
        }

        .topbar-brand {
          font-size: 1.7rem;
        }
      }
    `,
  ],
})
export class PersonalShellComponent {
  private router = inject(Router);
  private authState = inject(AuthStateService);

  protected readonly navItems: PersonalNavItem[] = [
    { label: 'Inbox', route: '/inbox', icon: 'inbox' },
    { label: 'Today', route: '/today', icon: 'today' },
    { label: 'Upcoming', route: '/upcoming', icon: 'upcoming' },
    { label: 'Projects', route: '/projects', icon: 'projects' },
    { label: 'Labels', route: '/labels', icon: 'labels' },
  ];
  protected readonly mobileMenuOpen = signal(false);
  protected readonly userInitials = computed(() => {
    const fallback = 'PS';
    const source = this.authState.user()?.name?.trim() || this.authState.user()?.email || fallback;
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return fallback;
    }

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
