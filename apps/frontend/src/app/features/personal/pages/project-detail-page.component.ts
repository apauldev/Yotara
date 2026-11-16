import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { CreateProjectDto, Project, Task } from '@yotara/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faBoxArchive,
  faCheck,
  faChevronDown,
  faChevronRight,
  faEdit,
  faEllipsisVertical,
  faFolderOpen,
  faRotateLeft,
  faThumbtack,
  faTrash,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { MarkdownComponent } from 'ngx-markdown';
import { ProjectService } from '../../../core/services/project.service';
import { StatusService } from '../../../core/services/status.service';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { PersonalProjectModalComponent } from '../components/personal-project-modal.component';
import { ProjectDeleteDialogComponent } from '../components/project-delete-dialog.component';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';
import { parseCalendarDate, startOfToday } from '../../../shared/utils/timestamps';

type ProjectLoadState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-project-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FontAwesomeModule,
    MarkdownComponent,
    PersonalProjectModalComponent,
    ProjectDeleteDialogComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    SectionHeaderComponent,
    PageHeaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './project-detail-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './project-detail-page.component.scss',
})
export class ProjectDetailPageComponent {
  protected readonly faFolderOpen = faFolderOpen;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faXmark = faXmark;
  protected readonly faEllipsisVertical = faEllipsisVertical;
  protected readonly faEdit = faEdit;
  protected readonly faThumbtack = faThumbtack;
  protected readonly faCheck = faCheck;
  protected readonly faBoxArchive = faBoxArchive;
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly faTrash = faTrash;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faChevronDown = faChevronDown;

  protected readonly projectService = inject(ProjectService);
  private readonly statusService = inject(StatusService);
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly workspace = viewChild(PersonalTaskWorkspaceComponent);

  protected readonly projectModalOpen = signal(false);
  protected readonly deleteModalOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly completedCollapsed = signal(true);

  protected readonly projectState = signal<ProjectLoadState>('loading');
  protected readonly loadError = signal<string | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly projectTasks = signal<Task[]>([]);
  private readonly lastSeenTaskVersion = signal(this.taskService.version());
  private readonly loadedProjectId = signal<string | null>(null);
  private readonly todoSection = viewChild<ElementRef<HTMLElement>>('todoSection');

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
      const taskVersion = this.taskService.version();

      if (!projectId || this.projectState() !== 'ready') {
        return;
      }

      if (this.lastSeenTaskVersion() === taskVersion) {
        return;
      }

      this.lastSeenTaskVersion.set(taskVersion);
      void this.loadProject(projectId);
    });
  }

  @HostListener('document:click')
  protected onDocumentClick() {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
    }
  }

  protected handleTaskSaved() {
    this.workspace()?.closeTaskModal();
    this.reloadProjectDetails();
  }

  protected openEditProjectModal() {
    if (!this.project()) {
      return;
    }
    this.menuOpen.set(false);
    this.projectModalOpen.set(true);
  }

  protected closeProjectModal() {
    this.projectModalOpen.set(false);
  }

  protected toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected toggleCompletedCollapsed() {
    this.completedCollapsed.update((v) => !v);
  }

  protected async togglePinned(event?: MouseEvent) {
    event?.stopPropagation();
    this.menuOpen.set(false);
    const current = this.project();
    if (!current) return;
    await this.projectService.updateProject(current.id, { pinned: !current.pinned });
    this.reloadProjectDetails();
  }

  protected async completeProject(event?: MouseEvent) {
    event?.stopPropagation();
    this.menuOpen.set(false);
    const current = this.project();
    if (!current || current.openTaskCount > 0) return;

    await this.projectService.completeProject(current.id);
    this.statusService.show('Project completed', 'success', 6000, {
      action: {
        label: 'Undo',
        callback: () => {
          void this.reopenProject();
        },
      },
    });
    this.reloadProjectDetails();
  }

  protected async reopenProject(event?: MouseEvent) {
    event?.stopPropagation();
    this.menuOpen.set(false);
    const current = this.project();
    if (!current) return;

    await this.projectService.reopenProject(current.id);
    this.reloadProjectDetails();
  }

  protected async archiveProject(event?: MouseEvent) {
    event?.stopPropagation();
    this.menuOpen.set(false);
    const current = this.project();
    if (!current) return;

    await this.projectService.archiveProject(current.id);
    this.reloadProjectDetails();
  }

  protected async unarchiveProject(event?: MouseEvent) {
    event?.stopPropagation();
    this.menuOpen.set(false);
    const current = this.project();
    if (!current) return;

    await this.projectService.unarchiveProject(current.id);
    this.reloadProjectDetails();
  }

  protected viewOpenTasks(event?: MouseEvent) {
    event?.stopPropagation();
    this.menuOpen.set(false);
    this.todoSection()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected askDeleteProject(event?: MouseEvent) {
    event?.stopPropagation();
    this.menuOpen.set(false);
    this.deleteModalOpen.set(true);
  }

  protected closeDeleteModal() {
    this.deleteModalOpen.set(false);
  }

  protected async confirmDeleteProject(event: { keepTasks: boolean }) {
    const current = this.project();
    if (!current) return;

    await this.projectService.deleteProject(current.id, event.keepTasks);
    this.closeDeleteModal();
    this.statusService.show('Project deleted', 'info', 4000);
    await this.router.navigate(['/projects']);
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

    this.lastSeenTaskVersion.set(this.taskService.version());
    this.reloadProjectDetails();
  }

  protected projectColorClass(project: Project) {
    return `project-${projectPaletteFor(project.color).value}`;
  }

  protected progressPercent(project: Project) {
    return projectProgressPercent(project.openTaskCount, project.completedTaskCount);
  }

  protected formatTargetDate(dateStr?: string | null): string | null {
    const dt = parseCalendarDate(dateStr);
    return dt ? dt.toFormat('LLL d, yyyy') : null;
  }

  protected isTargetDateOverdue(dateStr?: string | null): boolean {
    const dt = parseCalendarDate(dateStr);
    if (!dt) return false;
    return dt < startOfToday();
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
    const isColdLoad =
      this.loadedProjectId() !== projectId ||
      this.projectState() === 'error' ||
      this.projectState() === 'not-found';

    if (isColdLoad) {
      this.project.set(null);
      this.projectTasks.set([]);
      this.projectState.set('loading');
    }

    this.loadError.set(null);
    this.lastSeenTaskVersion.set(this.taskService.version());

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

      this.loadedProjectId.set(projectId);
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
