import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { CreateProjectDto, Project } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { PersonalProjectModalComponent } from '../components/personal-project-modal.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PersonalProjectModalComponent],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
})
export class ProjectsPageComponent {
  protected readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  protected readonly createModalOpen = signal(false);
  protected readonly projects = this.projectService.projects;
  protected readonly focusHeadline = computed(() => {
    const projects = this.projects();
    if (projects.length === 0) {
      return 'A project becomes useful the moment the next step is visible.';
    }

    const busiest = [...projects].sort(
      (left, right) => right.openTaskCount - left.openTaskCount,
    )[0];
    return `${busiest.name} holds ${busiest.openTaskCount} active steps right now.`;
  });
  protected readonly focusBody = computed(() => {
    const projects = this.projects();
    if (projects.length === 0) {
      return 'Create one focused space, then let Today and Upcoming guide the daily rhythm.';
    }

    const completed = projects.reduce((sum, project) => sum + project.completedTaskCount, 0);
    return `Completed work now adds up to ${completed} steps across your active projects. Keep the next action visible and the rest will follow.`;
  });

  protected openCreateModal() {
    this.createModalOpen.set(true);
  }

  protected closeCreateModal() {
    this.createModalOpen.set(false);
  }

  protected async createProject(payload: CreateProjectDto) {
    const created = await this.projectService.createProject(payload);
    this.createModalOpen.set(false);
    await this.router.navigate(['/projects', created.id]);
  }

  protected openProject(projectId: string) {
    void this.router.navigate(['/projects', projectId]);
  }

  protected accent(project: Project) {
    return projectPaletteFor(project.color).accent;
  }

  protected accentSoft(project: Project) {
    return projectPaletteFor(project.color).accentSoft;
  }

  protected cardBackground(project: Project) {
    return projectPaletteFor(project.color).panel;
  }

  protected paletteLabel(project: Project) {
    return projectPaletteFor(project.color).label;
  }

  protected progressPercent(project: Project) {
    return projectProgressPercent(project.openTaskCount, project.completedTaskCount);
  }
}
