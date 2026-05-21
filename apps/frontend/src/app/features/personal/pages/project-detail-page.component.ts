import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { CreateProjectDto, Project, Task } from '@yotara/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFolderOpen, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { PersonalProjectModalComponent } from '../components/personal-project-modal.component';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';

type ProjectLoadState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-project-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FontAwesomeModule,
    PersonalProjectModalComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    SectionHeaderComponent,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './project-detail-page.component.html',
  styleUrl: './project-detail-page.component.scss',
})
export class ProjectDetailPageComponent {
  protected readonly faFolderOpen = faFolderOpen;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faXmark = faXmark;
  protected readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly projectModalOpen = signal(false);
  protected readonly projectState = signal<ProjectLoadState>('loading');
  protected readonly loadError = signal<string | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly projectTasks = signal<Task[]>([]);
  private readonly lastSeenTaskRevision = signal(this.taskService.revision());
  protected readonly projectId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );
  protected readonly activeProjectTasks = computed(() =>
    [...this.projectTasks()]
      .filter((task) => !task.completed && task.status !== 'archived')
      .sort(compareTasksByOrder),
  );
  protected readonly completedProjectTasks = computed(() =>
    [...this.projectTasks()]
      .filter((task) => task.completed && task.status !== 'archived')
      .sort(compareTasksByOrder),
  );

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (!projectId) {
        this.project.set(null);
        this.projectTasks.set([]);
        this.projectState.set('not-found');
        return;
      }

      void this.loadProject(projectId);
    });

    effect(() => {
      const projectId = this.projectId();
      const taskRevision = this.taskService.revision();

      if (!projectId || this.projectState() !== 'ready') {
        return;
      }

      if (this.lastSeenTaskRevision() === taskRevision) {
        return;
      }

      this.lastSeenTaskRevision.set(taskRevision);
      void this.loadProject(projectId);
    });
  }

  protected handleTaskSaved() {
    this.workspace()?.closeTaskModal();
    this.reloadProjectDetails();
  }

  protected openEditProjectModal() {
    if (!this.project()) {
      return;
    }

    this.projectModalOpen.set(true);
  }

  protected closeProjectModal() {
    this.projectModalOpen.set(false);
  }

  protected async saveProject(payload: CreateProjectDto) {
    const currentProject = this.project();
    if (!currentProject) {
      return;
    }

    const updated = await this.projectService.updateProject(currentProject.id, payload);
    this.closeProjectModal();
    if (updated) {
      this.project.set(updated);
      this.projectState.set('ready');
    }

    this.lastSeenTaskRevision.set(this.taskService.revision());
    this.reloadProjectDetails();
  }

  protected projectColorClass(project: Project) {
    return `project-${projectPaletteFor(project.color).value}`;
  }

  protected progressPercent(project: Project) {
    return projectProgressPercent(project.openTaskCount, project.completedTaskCount);
  }

  protected retryLoad() {
    this.reloadProjectDetails();
  }

  private loadToken = 0;

  private reloadProjectDetails() {
    this.loadToken += 1;
    const projectId = this.projectId();
    if (projectId) {
      void this.loadProject(projectId);
    }
  }

  private async loadProject(projectId: string) {
    const requestToken = ++this.loadToken;
    this.projectState.set('loading');
    this.loadError.set(null);
    this.lastSeenTaskRevision.set(this.taskService.revision());

    try {
      const project = await this.projectService.getProject(projectId);
      if (requestToken !== this.loadToken) {
        return;
      }

      if (!project) {
        this.project.set(null);
        this.projectTasks.set([]);
        this.projectState.set('not-found');
        return;
      }

      const projectTasks = await this.projectService.getProjectTasks(projectId);
      if (requestToken !== this.loadToken) {
        return;
      }

      if (!projectTasks) {
        this.project.set(null);
        this.projectTasks.set([]);
        this.projectState.set('not-found');
        return;
      }

      this.project.set(project);
      this.projectTasks.set(projectTasks);
      this.projectState.set('ready');
    } catch {
      if (requestToken !== this.loadToken) {
        return;
      }

      this.project.set(null);
      this.projectTasks.set([]);
      this.loadError.set('Could not load this project right now.');
      this.projectState.set('error');
    }
  }
}

function compareTasksByOrder(left: Task, right: Task) {
  const leftOrder = left.order ?? 0;
  const rightOrder = right.order ?? 0;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  return left.id.localeCompare(right.id);
}
