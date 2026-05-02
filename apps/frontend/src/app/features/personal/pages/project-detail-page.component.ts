import { CommonModule } from '@angular/common';
import { Component, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { Project } from '@yotara/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';

@Component({
  selector: 'app-project-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FontAwesomeModule,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    SectionHeaderComponent,
    PageHeaderComponent,
  ],
  templateUrl: './project-detail-page.component.html',
  styleUrl: './project-detail-page.component.scss',
})
export class ProjectDetailPageComponent {
  protected readonly projectService = inject(ProjectService);
  protected readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly projectId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );
  protected readonly project = computed(
    () => this.projectService.projects().find((project) => project.id === this.projectId()) ?? null,
  );
  protected readonly activeProjectTasks = computed(() =>
    this.taskService.activeTasks().filter((task) => task.projectId === this.projectId()),
  );
  protected readonly completedProjectTasks = computed(() =>
    this.taskService.completedTasks().filter((task) => task.projectId === this.projectId()),
  );

  protected handleTaskSaved() {
    this.workspace()?.closeTaskModal();
  }

  protected projectColorClass(project: Project) {
    return `project-${projectPaletteFor(project.color).value}`;
  }

  protected progressPercent(project: Project) {
    return projectProgressPercent(project.openTaskCount, project.completedTaskCount);
  }
}
