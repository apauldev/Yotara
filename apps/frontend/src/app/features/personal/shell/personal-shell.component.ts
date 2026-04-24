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
} from '@fortawesome/free-solid-svg-icons';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { LogoutConfirmModalComponent } from '../../../shared/ui/logout-confirm-modal/logout-confirm-modal.component';

type PersonalIcon = 'inbox' | 'today' | 'upcoming' | 'projects' | 'labels' | 'archive';

interface PersonalNavItem {
  label: string;
  route: string;
  icon: PersonalIcon;
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
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authState = inject(AuthStateService);
  protected readonly searchQuery = signal(this.route.snapshot.queryParamMap.get('q') ?? '');

  protected readonly navItems: PersonalNavItem[] = [
    { label: 'Inbox', route: '/inbox', icon: 'inbox' },
    { label: 'Today', route: '/today', icon: 'today' },
    { label: 'Upcoming', route: '/upcoming', icon: 'upcoming' },
    { label: 'Projects', route: '/projects', icon: 'projects' },
    { label: 'Labels', route: '/labels', icon: 'labels' },
    { label: 'Archive', route: '/archive', icon: 'archive' },
  ];
  protected readonly mobileMenuOpen = signal(false);
  protected readonly profileMenuOpen = signal(false);
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
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.searchQuery.set(params.get('q') ?? '');
    });
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
