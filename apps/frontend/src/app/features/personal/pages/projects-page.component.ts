import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { CreateProjectDto, Project } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { StatusService } from '../../../core/services/status.service';
import { PersonalProjectModalComponent } from '../components/personal-project-modal.component';
import { ProjectDeleteDialogComponent } from '../components/project-delete-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faBoxArchive,
  faCheck,
  faEdit,
  faEllipsisVertical,
  faGripVertical,
  faRotateLeft,
  faThumbtack,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { parseCalendarDate } from '../../../shared/utils/timestamps';

export type ProjectsTab = 'active' | 'completed' | 'archived';

@Component({
  selector: 'app-projects-page',
  standalone: true,
  imports: [
    CommonModule,
    PersonalProjectModalComponent,
    ProjectDeleteDialogComponent,
    PageHeaderComponent,
    FontAwesomeModule,
    EmptyStateComponent,
  ],
  templateUrl: './projects-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './projects-page.component.scss',
})
export class ProjectsPageComponent {
  protected readonly faEdit = faEdit;
  protected readonly faEllipsisVertical = faEllipsisVertical;
  protected readonly faThumbtack = faThumbtack;
  protected readonly faCheck = faCheck;
  protected readonly faBoxArchive = faBoxArchive;
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly faTrash = faTrash;
  protected readonly faGripVertical = faGripVertical;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faArrowDown = faArrowDown;

  protected readonly projectService = inject(ProjectService);
  private readonly statusService = inject(StatusService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly activeTab = signal<ProjectsTab>('active');
  protected readonly createModalOpen = signal(false);
  protected readonly modalMode = signal<'create' | 'edit'>('create');
  protected readonly selectedProject = signal<Project | null>(null);
  protected readonly rowMenuProjectId = signal<string | null>(null);
  protected readonly draggedProjectId = signal<string | null>(null);
  protected readonly dropTargetId = signal<string | null>(null);

  protected readonly deleteModalOpen = signal(false);
  protected readonly projectToDelete = signal<Project | null>(null);

  protected readonly projects = this.projectService.projects;
  protected readonly archivedProjects = signal<Project[]>([]);

  constructor() {
    effect(() => {
      this.projectService.version();
      void this.loadArchivedProjects();
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (params.get('create') !== 'project') {
        return;
      }

      this.openCreateModal();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { create: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  @HostListener('document:click')
  protected onDocumentClick() {
    if (this.rowMenuProjectId()) {
      this.rowMenuProjectId.set(null);
    }
  }

  protected readonly activeProjects = computed(() =>
    this.projects().filter((p) => !p.completedAt && !p.archivedAt),
  );

  protected readonly completedProjects = computed(() =>
    this.projects().filter((p) => !!p.completedAt && !p.archivedAt),
  );

  protected readonly tabCounts = computed(() => ({
    active: this.activeProjects().length,
    completed: this.completedProjects().length,
    archived: this.archivedProjects().length,
  }));

  protected readonly currentTabProjects = computed(() => {
    switch (this.activeTab()) {
      case 'completed':
        return this.completedProjects();
      case 'archived':
        return this.archivedProjects();
      case 'active':
      default:
        return this.activeProjects();
    }
  });

  protected readonly focusHeadline = computed(() => {
    const projects = this.activeProjects();
    if (projects.length === 0) {
      return 'A project becomes useful the moment the next step is visible.';
    }

    const busiest = [...projects].sort(
      (left, right) => right.openTaskCount - left.openTaskCount,
    )[0];
    return `${busiest.name} holds ${busiest.openTaskCount} active steps right now.`;
  });

  protected readonly focusBody = computed(() => {
    const projects = this.activeProjects();
    if (projects.length === 0) {
      return 'Create one focused space, then let Today and Upcoming guide the daily rhythm.';
    }

    const completed = projects.reduce((sum, project) => sum + project.completedTaskCount, 0);
    return `Completed work now adds up to ${completed} steps across your active projects. Keep the next action visible and the rest will follow.`;
  });

  private async loadArchivedProjects() {
    try {
      const archived = await this.projectService.getProjectsByStatus('archived');
      this.archivedProjects.set(archived);
    } catch {
      // keep current state
    }
  }

  protected setTab(tab: ProjectsTab) {
    this.activeTab.set(tab);
    this.rowMenuProjectId.set(null);
  }

  protected openCreateModal() {
    this.selectedProject.set(null);
    this.modalMode.set('create');
    this.createModalOpen.set(true);
  }

  protected openEditModal(project: Project, event?: MouseEvent) {
    event?.stopPropagation();
    this.rowMenuProjectId.set(null);
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

  protected toggleRowMenu(project: Project, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuProjectId.update((id) => (id === project.id ? null : project.id));
  }

  protected async togglePinned(project: Project, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuProjectId.set(null);
    await this.projectService.updateProject(project.id, { pinned: !project.pinned });
  }

  protected canMove(project: Project, direction: -1 | 1): boolean {
    const list = this.currentTabProjects();
    const index = list.findIndex((item) => item.id === project.id);
    const target = index + direction;
    return (
      index >= 0 && target >= 0 && target < list.length && list[target].pinned === project.pinned
    );
  }

  protected moveProject(project: Project, direction: -1 | 1, event?: MouseEvent) {
    event?.stopPropagation();
    this.rowMenuProjectId.set(null);

    const list = this.currentTabProjects();
    const index = list.findIndex((item) => item.id === project.id);
    const target = index + direction;
    if (
      index < 0 ||
      target < 0 ||
      target >= list.length ||
      list[target].pinned !== project.pinned
    ) {
      return;
    }

    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    void this.persistOrder(this.mergeTabOrder(list, reordered));
  }

  protected onDragStart(event: DragEvent, project: Project) {
    this.draggedProjectId.set(project.id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', project.id);
    }
  }

  protected onDragOver(event: DragEvent, project: Project) {
    const draggedId = this.draggedProjectId();
    if (!draggedId || draggedId === project.id) {
      return;
    }

    const dragged = this.currentTabProjects().find((item) => item.id === draggedId);
    if (!dragged || dragged.pinned !== project.pinned) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dropTargetId.set(project.id);
  }

  protected onDragLeave(project: Project) {
    if (this.dropTargetId() === project.id) {
      this.dropTargetId.set(null);
    }
  }

  protected onDrop(event: DragEvent, project: Project) {
    event.preventDefault();
    const draggedId = this.draggedProjectId() ?? event.dataTransfer?.getData('text/plain') ?? null;
    const targetId = project.id;
    this.draggedProjectId.set(null);
    this.dropTargetId.set(null);

    if (!draggedId || draggedId === targetId) {
      return;
    }

    const list = this.currentTabProjects();
    const from = list.findIndex((item) => item.id === draggedId);
    const to = list.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || list[from].pinned !== list[to].pinned) {
      return;
    }

    const reordered = [...list];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    void this.persistOrder(this.mergeTabOrder(list, reordered));
  }

  protected onDragEnd() {
    this.draggedProjectId.set(null);
    this.dropTargetId.set(null);
  }

  protected viewOpenTasks(project: Project, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuProjectId.set(null);
    void this.router.navigate(['/projects', project.id]);
  }

  protected async completeProject(project: Project, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuProjectId.set(null);
    if (project.openTaskCount > 0) {
      return;
    }
    await this.projectService.completeProject(project.id);
    this.statusService.show('Project completed', 'success', 6000, {
      action: {
        label: 'Undo',
        callback: () => {
          void this.projectService.reopenProject(project.id);
        },
      },
    });
  }

  protected async reopenProject(project: Project, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuProjectId.set(null);
    await this.projectService.reopenProject(project.id);
  }

  protected async archiveProject(project: Project, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuProjectId.set(null);
    await this.projectService.archiveProject(project.id);
  }

  protected async unarchiveProject(project: Project, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuProjectId.set(null);
    await this.projectService.unarchiveProject(project.id);
  }

  protected askDeleteProject(project: Project, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuProjectId.set(null);
    this.projectToDelete.set(project);
    this.deleteModalOpen.set(true);
  }

  protected closeDeleteModal() {
    this.deleteModalOpen.set(false);
    this.projectToDelete.set(null);
  }

  protected async confirmDeleteProject(event: { keepTasks: boolean }) {
    const project = this.projectToDelete();
    if (!project) return;
    await this.projectService.deleteProject(project.id, event.keepTasks);
    this.closeDeleteModal();
    this.statusService.show('Project deleted', 'info', 4000);
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

  protected openTaskLabel(project: Project) {
    return project.openTaskCount === 1 ? '1 open task' : `${project.openTaskCount} open tasks`;
  }

  protected getProjectStatus(project: Project): string {
    if (project.archivedAt) {
      return 'archived';
    }
    if (project.completedAt) {
      return 'completed';
    }
    if (project.kind === 'ongoing') {
      return 'ongoing';
    }
    return 'active';
  }

  protected formatTargetDate(dateStr?: string | null): string | null {
    const dt = parseCalendarDate(dateStr);
    return dt ? dt.toFormat('LLL d, yyyy') : null;
  }

  protected getProjectStatusLabel(project: Project): string {
    const status = this.getProjectStatus(project);
    if (status === 'ongoing') {
      return 'Ongoing area';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  private mergeTabOrder(previous: Project[], reordered: Project[]): string[] {
    const previousIds = new Set(previous.map((project) => project.id));
    const nextIds = reordered.map((project) => project.id);
    let cursor = 0;
    return [...this.projects(), ...this.archivedProjects()].map((project) =>
      previousIds.has(project.id) ? nextIds[cursor++] : project.id,
    );
  }

  private async persistOrder(ids: string[]) {
    try {
      await this.projectService.reorderProjects(ids);
    } catch {
      // ProjectService surfaces the error; keep the existing order on failure.
    }
  }
}
