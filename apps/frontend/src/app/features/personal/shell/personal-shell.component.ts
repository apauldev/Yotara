import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBars,
  faBell,
  faCalendarDays,
  faBoxArchive,
  faInbox,
  faArrowRightLong,
  faRocket,
  faPlus,
  faSliders,
  faTag,
  faChevronLeft,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { TaskService } from '../../../core/services/task.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LogoutConfirmModalComponent } from '../../../shared/ui/logout-confirm-modal/logout-confirm-modal.component';
import { AppStatusComponent } from '../../../shared/ui/app-status/app-status.component';

type PersonalIcon = 'inbox' | 'today' | 'upcoming' | 'projects' | 'labels' | 'archive';

interface PersonalNavItem {
  label: string;
  route: string;
  icon: PersonalIcon;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-personal-shell',
  standalone: true,
  styleUrl: './personal-shell.component.css',
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    LogoutConfirmModalComponent,
    AppStatusComponent,
  ],
  templateUrl: './personal-shell.component.html',
})
export class PersonalShellComponent {
  protected readonly faBars = faBars;
  protected readonly faBell = faBell;
  protected readonly faArrowRightLong = faArrowRightLong;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faBoxArchive = faBoxArchive;
  protected readonly faInbox = faInbox;
  protected readonly faRocket = faRocket;
  protected readonly faPlus = faPlus;
  protected readonly faSliders = faSliders;
  protected readonly faTag = faTag;
  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faChevronRight = faChevronRight;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authState = inject(AuthStateService);
  protected readonly taskService = inject(TaskService);
  protected readonly themeService = inject(ThemeService);
  protected readonly searchQuery = signal(this.route.snapshot.queryParamMap.get('q') ?? '');

  protected readonly navItems: PersonalNavItem[] = [
    { label: 'Inbox', route: '/tasks', icon: 'inbox', queryParams: { view: 'inbox' } },
    { label: 'Today', route: '/tasks', icon: 'today', queryParams: { view: 'today' } },
    { label: 'Upcoming', route: '/tasks', icon: 'upcoming', queryParams: { view: 'upcoming' } },
    { label: 'Projects', route: '/projects', icon: 'projects' },
    { label: 'Labels', route: '/labels', icon: 'labels' },
    { label: 'Archive', route: '/archive', icon: 'archive' },
  ];
  protected readonly mobileMenuOpen = signal(false);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly profileMenuOpen = signal(false);
  protected readonly preferencesMenuOpen = signal(false);
  protected readonly logoutDialogOpen = signal(false);
  protected readonly signingOut = signal(false);
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
      this.profileMenuOpen.set(false);
      this.preferencesMenuOpen.set(false);
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.searchQuery.set(params.get('q') ?? '');
    });
  }

  protected async submitSearch() {
    const query = this.searchQuery().trim();

    await this.router.navigate(['/tasks'], {
      queryParams: query ? { view: 'search', q: query } : { view: 'search' },
    });
  }

  protected toggleMobileMenu() {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  protected toggleSidebar() {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  protected toggleProfileMenu() {
    this.preferencesMenuOpen.set(false);
    this.profileMenuOpen.update((open) => !open);
  }

  protected closeProfileMenu() {
    this.profileMenuOpen.set(false);
  }

  protected togglePreferencesMenu() {
    this.profileMenuOpen.set(false);
    this.preferencesMenuOpen.update((open) => !open);
  }

  protected closePreferencesMenu() {
    this.preferencesMenuOpen.set(false);
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

  protected async openCreateTaskModal() {
    const currentUrl = this.router.url;
    if (!currentUrl.includes('/tasks')) {
      await this.router.navigate(['/tasks'], {
        queryParams: { view: 'inbox', fragment: 'capture' },
      });
      return;
    }

    const captureEl = document.getElementById('capture');
    if (captureEl) {
      captureEl.scrollIntoView({ behavior: 'smooth' });
      captureEl.querySelector('input')?.focus();
    }
  }
}
