import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
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
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Project, ProjectFormPayload } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { StatusService } from '../../../core/services/status.service';
import { PersonalProjectModalComponent } from '../components/personal-project-modal.component';
import { ProjectDeleteDialogComponent } from '../components/project-delete-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { projectPaletteFor, projectProgressPercent } from '../project-presentation';
import { constrainDragPreviewToViewport } from '../utils/drag-preview-constrain';
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
    DragDropModule,
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
  private readonly destroyRef = inject(DestroyRef);

  protected readonly activeTab = signal<ProjectsTab>('active');
  protected readonly createModalOpen = signal(false);
  protected readonly modalMode = signal<'create' | 'edit'>('create');
  protected readonly selectedProject = signal<Project | null>(null);
  protected readonly rowMenuProjectId = signal<string | null>(null);
  /** Optimistic order applied to the visible list until the refreshed API list arrives. */
  private readonly pendingOrder = signal<string[] | null>(null);
  private pendingOrderSequence = 0;
  private pendingOrderFallback?: ReturnType<typeof setTimeout>;

  protected readonly deleteModalOpen = signal(false);
  protected readonly projectToDelete = signal<Project | null>(null);

  protected readonly projects = this.projectService.projects;
  protected readonly archivedProjects = signal<Project[]>([]);

  constructor() {
    effect(() => {
      this.projectService.version();
      void this.loadArchivedProjects();
    });

    // Release the optimistic order once the refreshed API list reflects it.
    effect(() => {
      const pending = this.pendingOrder();
      if (!pending) {
        return;
      }
      const ids = [...this.projects(), ...this.archivedProjects()].map((project) => project.id);
      const expected = pending.filter((id) => ids.includes(id));
      if (ids.length === expected.length && ids.every((id, index) => id === expected[index])) {
        this.pendingOrder.set(null);
      }
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

    this.destroyRef.onDestroy(() => {
      if (this.pendingOrderFallback) {
        clearTimeout(this.pendingOrderFallback);
      }
    });
  }

  @HostListener('document:click')
  @HostListener('document:keydown.escape')
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
    let list: Project[];
    switch (this.activeTab()) {
      case 'completed':
        list = this.completedProjects();
        break;
      case 'archived':
        list = this.archivedProjects();
        break;
      case 'active':
      default:
        list = this.activeProjects();
    }

    const pending = this.pendingOrder();
    if (!pending) {
      return list;
    }
    const positions = new Map(pending.map((id, index) => [id, index]));
    return [...list].sort(
      (left, right) =>
        (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  });

  /**
   * Pinned and unpinned projects are independent drop lists. Keeping them in
   * separate CDK lists confines each drag to its own group, so CDK never has
   * to reject a cross-group swap mid-drag (which left the outline stuck).
   */
  protected readonly projectDropGroups = computed(() => {
    const projects = this.currentTabProjects();
    return [
      { pinned: true, projects: projects.filter((project) => project.pinned) },
      { pinned: false, projects: projects.filter((project) => !project.pinned) },
    ].filter((group) => group.projects.length > 0);
  });

  protected readonly constrainDragPreview = constrainDragPreviewToViewport;

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

  protected onTabKeydown(event: KeyboardEvent) {
    const tabOrder: ProjectsTab[] = ['active', 'completed', 'archived'];
    const focusedTab = (event.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
    if (!focusedTab) {
      return;
    }
    const currentIndex = tabOrder.findIndex((tab) => focusedTab.id === `projects-tab-${tab}`);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabOrder.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex + tabOrder.length - 1) % tabOrder.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabOrder.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = tabOrder[nextIndex];
    this.setTab(nextTab);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLButtonElement>(`#projects-tab-${nextTab}`)
      ?.focus();
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

  protected async createProject(payload: ProjectFormPayload) {
    const selectedProject = this.selectedProject();

    if (this.modalMode() === 'edit' && selectedProject) {
      await this.projectService.updateProject(selectedProject.id, payload);
      this.closeProjectModal();
      return;
    }

    // The create DTO omits `description` for empty; the form emits `null`.
    const created = await this.projectService.createProject({
      ...payload,
      description: payload.description ?? undefined,
    });
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

  protected onProjectDrop(event: CdkDragDrop<Project[]>, pinned: boolean) {
    const list = this.currentTabProjects().filter((project) => project.pinned === pinned);
    const dragged = list[event.previousIndex];
    const target = list[event.currentIndex];
    if (!dragged || !target || dragged.id === target.id || dragged.pinned !== target.pinned) {
      return;
    }

    const reordered = [...list];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    void this.persistOrder(this.mergeTabOrder(list, reordered));
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
    const sequence = ++this.pendingOrderSequence;
    this.pendingOrder.set(ids);
    if (this.pendingOrderFallback) {
      clearTimeout(this.pendingOrderFallback);
    }

    try {
      await this.projectService.reorderProjects(ids);
      // Normally the effect above releases the optimistic order as soon as the
      // refreshed list matches. If an interleaving mutation changes the set,
      // that exact match never fires — so guarantee release with a fallback.
      this.pendingOrderFallback = setTimeout(() => {
        if (this.pendingOrderSequence === sequence) {
          this.pendingOrder.set(null);
        }
      }, 1500);
    } catch {
      // ProjectService surfaces the error; revert the optimistic order on failure.
      if (this.pendingOrderSequence === sequence) {
        this.pendingOrder.set(null);
      }
    }
  }
}
