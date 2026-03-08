import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';

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
  selectedWorkspace = signal<WorkspaceType>('team');

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

  constructor(private router: Router) {}

  selectWorkspace(workspace: WorkspaceType) {
    this.selectedWorkspace.set(workspace);
  }

  continue() {
    const workspace = this.selectedWorkspace();
    localStorage.setItem('workspaceType', workspace);
    this.router.navigate(['/dashboard']);
  }

  goToHelp() {
    // Open help or navigate to help page
    window.open('https://help.yotara.com', '_blank');
  }
}
