import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStateService } from '../../../../core/services/auth-state.service';

type WorkspaceType = 'personal' | 'team';

interface WorkspaceOption {
  id: WorkspaceType;
  title: string;
  description: string;
  icon: 'leaf' | 'sprout';
}

@Component({
  selector: 'app-start-screen',
  standalone: true,
  imports: [],
  templateUrl: './start-screen.component.html',
  styleUrl: './start-screen.component.css',
})
export class StartScreenComponent {
  private authState = inject(AuthStateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  selectedWorkspace = signal<WorkspaceType>('team');
  loading = signal(false);
  error = signal('');
  accountCreated = signal(false);

  workspaceOptions: WorkspaceOption[] = [
    {
      id: 'personal',
      title: 'Personal & Simple',
      description: 'Focus on your own flow with a minimalist workspace.',
      icon: 'leaf',
    },
    {
      id: 'team',
      title: 'Light Team Sharing',
      description: 'Collaborate with small groups and sync effortlessly.',
      icon: 'sprout',
    },
  ];

  constructor() {
    this.accountCreated.set(this.route.snapshot.queryParamMap.get('created') === '1');
  }

  selectWorkspace(workspace: WorkspaceType) {
    this.selectedWorkspace.set(workspace);
  }

  async continue() {
    const workspace = this.selectedWorkspace();
    this.loading.set(true);
    this.error.set('');

    try {
      await this.authState.completeOnboarding(workspace);
      localStorage.setItem('workspaceType', workspace);
      localStorage.setItem('onboardingCompleted', 'true');
      await this.router.navigateByUrl(this.authState.getPostAuthRedirectUrl());
    } catch (error) {
      console.error('Failed to complete onboarding', error);
      this.error.set('Could not save your workspace mode');
    } finally {
      this.loading.set(false);
    }
  }

  goToHelp() {
    // Open help or navigate to help page
    window.open('https://help.yotara.com', '_blank');
  }
}
