import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { CreateProjectDto, Project } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { PersonalProjectModalComponent } from '../components/personal-project-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEdit } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [
    CommonModule,
    PersonalProjectModalComponent,
    PageHeaderComponent,
    FontAwesomeModule,
    EmptyStateComponent,
  ],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
})
export class ProjectsPageComponent {
  protected readonly faEdit = faEdit;
  protected readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  protected readonly createModalOpen = signal(false);
  protected readonly modalMode = signal<'create' | 'edit'>('create');
  protected readonly selectedProject = signal<Project | null>(null);
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
    this.selectedProject.set(null);
    this.modalMode.set('create');
    this.createModalOpen.set(true);
  }

  protected openEditModal(project: Project, event?: MouseEvent) {
    event?.stopPropagation();
    this.selectedProject.set(project);
    this.modalMode.set('edit');
    this.createModalOpen.set(true);
  }

  protected closeProjectModal() {
    this.createModalOpen.set(false);
    this.selectedProject.set(null);
    this.modalMode.set('create');
  }

  protected async createProject(payload: CreateProjectDto) {
    const selectedProject = this.selectedProject();

    if (this.modalMode() === 'edit' && selectedProject) {
      await this.projectService.updateProject(selectedProject.id, payload);
      this.closeProjectModal();
      return;
    }

    const created = await this.projectService.createProject(payload);
    this.closeProjectModal();
    await this.router.navigate(['/projects', created.id]);
  }

  protected openProject(projectId: string) {
    void this.router.navigate(['/projects', projectId]);
  }

  protected projectColorClass(project: Project) {
    return `project-card-${projectPaletteFor(project.color).value}`;
  }

  protected paletteLabel(project: Project) {
    return projectPaletteFor(project.color).label;
  }

  protected progressPercent(project: Project) {
    return projectProgressPercent(project.openTaskCount, project.completedTaskCount);
  }

  protected getProjectStatus(project: Project): string {
    if (project.openTaskCount === 0) {
      return 'inactive';
    } else if (project.completedTaskCount > 0) {
      return 'active';
    }
    return 'active';
  }
}
