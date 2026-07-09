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
  faLightbulb,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { APP_VERSION } from '../../../core/constants/version';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { TaskService } from '../../../core/services/task.service';
import { ThemeService } from '../../../core/services/theme.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { LogoutConfirmModalComponent } from '../../../shared/ui/logout-confirm-modal/logout-confirm-modal.component';
import { AppStatusComponent } from '../../../shared/ui/app-status/app-status.component';

const TIPS = [
  'Press `#` in the task input to quickly add labels to any task.',
  'Use projects to group related tasks together into meaningful collections.',
  'Mark tasks as "Today" to focus on what matters right now.',
  'Completed tasks move to your archive automatically for a clean workspace.',
  'Recurring tasks repeat daily, weekly, monthly, or yearly — no need to recreate them.',
  'Use the search bar to find any task across all your projects instantly.',
  'Break big tasks into smaller subtasks to make progress feel achievable.',
  'Dark mode reduces eye strain during late-night productivity sessions.',
  'Your data stays private — everything is stored securely and never shared.',
  'Labels help you categorize tasks across different projects and views.',
  'Use the Inbox to capture ideas quickly before organizing them into projects.',
  'The Today view shows everything due or marked for today in one place.',
  'The Upcoming view helps you plan your week and spot busy days ahead.',
  'Archive old tasks to keep your workspace focused on what is active.',
  'Press Enter to quickly add a task from the capture bar without touching your mouse.',
  'Batch-complete several tasks at once to clear your list faster.',
  'Overdue tasks are highlighted so nothing slips through the cracks.',
  'Schedule tasks for specific dates to plan your work ahead of time.',
  'The sidebar collapses to give you a distraction-free writing and planning area.',
  'Review your completed tasks to reflect on progress and celebrate wins.',
  'Use batch actions to update multiple tasks at once and save clicks.',
  'Projects support custom colors to make them easy to spot at a glance.',
  'You can reorder tasks with drag and drop to prioritize your day.',
  'Empty states show encouraging messages instead of blank screens.',
  'The app adapts to seven themes so you can match your mood or environment.',
  'Keyboard shortcuts speed up navigation — try `?` to see the full list.',
  'Focus on a single task at a time to reduce cognitive load.',
  'Set due dates to track deadlines rather than just start dates.',
  'Your preferences sync across sessions so your setup stays consistent.',
  'Take breaks between tasks — sustained focus works best with short rests.',
];

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
  protected readonly appVersion = APP_VERSION;
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
  protected readonly faLightbulb = faLightbulb;
  protected readonly faXmark = faXmark;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authState = inject(AuthStateService);
  protected readonly taskService = inject(TaskService);
  protected readonly themeService = inject(ThemeService);
  protected readonly searchQuery = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  protected readonly showTip = signal<string | null>(null);
  protected readonly tipDontShowAgain = signal(false);
  private preferences = inject(PreferencesStore);

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

    if (!this.preferences.loginTipDismissed()) {
      this.showTip.set(TIPS[Math.floor(Math.random() * TIPS.length)]);
    }
  }

  protected onTipCheckboxChange(event: Event) {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.tipDontShowAgain.set(target.checked);
    }
  }

  protected dismissTip() {
    this.preferences.setLoginTipDismissed(true, this.tipDontShowAgain());
    this.showTip.set(null);
  }

  protected async submitSearch() {
    const query = this.searchQuery().trim();

    await this.router.navigate(['/search'], {
      queryParams: query ? { q: query } : {},
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
