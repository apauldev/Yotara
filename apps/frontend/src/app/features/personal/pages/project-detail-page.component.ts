import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
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
import type { CreateProjectDto, Project, ProjectSection, Task } from '@yotara/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowUp,
  faBoxArchive,
  faCheck,
  faChevronDown,
  faChevronRight,
  faEdit,
  faEllipsisVertical,
  faFolderOpen,
  faGripVertical,
  faPlus,
  faRotateLeft,
  faThumbtack,
  faTrash,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { MarkdownComponent } from 'ngx-markdown';
import { ProjectService } from '../../../core/services/project.service';
import { PreferencesStore } from '../../../core/services/preferences-store.service';
import { StatusService } from '../../../core/services/status.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
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
    DragDropModule,
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
    ConfirmDialogComponent,
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
  protected readonly faGripVertical = faGripVertical;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faArrowDown = faArrowDown;
  protected readonly faPlus = faPlus;

  protected readonly projectService = inject(ProjectService);
  private readonly preferences = inject(PreferencesStore);
  private readonly statusService = inject(StatusService);
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly workspace = viewChild(PersonalTaskWorkspaceComponent);

  protected readonly projectModalOpen = signal(false);
  protected readonly deleteModalOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly completedCollapsed = signal(true);

  protected readonly sectionMenuId = signal<string | null>(null);
  protected readonly editingSectionId = signal<string | null>(null);
  protected readonly sectionDraftName = signal('');
  protected readonly sectionNameError = signal<string | null>(null);
  protected readonly creatingSection = signal(false);
  protected readonly newSectionName = signal('');
  protected readonly sectionToDelete = signal<ProjectSection | null>(null);

  protected readonly projectState = signal<ProjectLoadState>('loading');
  protected readonly loadError = signal<string | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly projectTasks = signal<Task[]>([]);
  protected readonly sections = signal<ProjectSection[]>([]);
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

  /** Active tasks with no section (or a stale section id) form the flat top group. */
  protected readonly unsectionedTasks = computed(() => {
    const sectionIds = new Set(this.sections().map((section) => section.id));
    return this.activeProjectTasks().filter(
      (task) => !task.sectionId || !sectionIds.has(task.sectionId),
    );
  });

  protected readonly tasksBySection = computed(() => {
    const sectionIds = new Set(this.sections().map((section) => section.id));
    const groups = new Map<string, Task[]>();
    for (const section of this.sections()) {
      groups.set(section.id, []);
    }
    for (const task of this.activeProjectTasks()) {
      if (!task.sectionId || !sectionIds.has(task.sectionId)) {
        continue;
      }
      groups.get(task.sectionId)?.push(task);
    }
    return groups;
  });

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
  @HostListener('document:keydown.escape')
  protected onDocumentClick() {
    if (this.menuOpen()) {
      this.menuOpen.set(false);
    }
    if (this.sectionMenuId()) {
      this.sectionMenuId.set(null);
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

  protected isSectionCollapsed(sectionId: string): boolean {
    return this.preferences.isSectionCollapsed(sectionId);
  }

  protected toggleSectionCollapsed(sectionId: string) {
    this.preferences.setSectionCollapsed(sectionId, !this.isSectionCollapsed(sectionId));
  }

  protected toggleSectionMenu(sectionId: string, event: MouseEvent) {
    event.stopPropagation();
    this.sectionMenuId.update((id) => (id === sectionId ? null : sectionId));
  }

  protected startCreateSection() {
    this.creatingSection.set(true);
    this.newSectionName.set('');
    this.sectionNameError.set(null);
  }

  protected cancelCreateSection() {
    this.creatingSection.set(false);
    this.newSectionName.set('');
    this.sectionNameError.set(null);
  }

  protected async confirmCreateSection() {
    const name = this.newSectionName().trim();
    if (!name) {
      this.sectionNameError.set('Give the section a name.');
      return;
    }

    const projectId = this.projectId();
    if (!projectId) {
      return;
    }

    try {
      const section = await this.projectService.createSection(projectId, { name });
      this.sections.update((sections) => [...sections, section]);
      this.cancelCreateSection();
      this.statusService.show('Section added', 'success', 3000);
    } catch {
      this.sectionNameError.set('Could not add the section right now.');
    }
  }

  protected startRenameSection(section: ProjectSection, event?: MouseEvent) {
    event?.stopPropagation();
    this.sectionMenuId.set(null);
    this.editingSectionId.set(section.id);
    this.sectionDraftName.set(section.name);
    this.sectionNameError.set(null);
  }

  protected cancelRenameSection() {
    this.editingSectionId.set(null);
    this.sectionDraftName.set('');
    this.sectionNameError.set(null);
  }

  protected async confirmRenameSection(section: ProjectSection) {
    const name = this.sectionDraftName().trim();
    if (!name) {
      this.sectionNameError.set('Give the section a name.');
      return;
    }
    if (name === section.name) {
      this.cancelRenameSection();
      return;
    }

    try {
      const updated = await this.projectService.updateSection(section.id, { name });
      this.sections.update((sections) =>
        sections.map((item) => (item.id === section.id ? updated : item)),
      );
      this.cancelRenameSection();
    } catch {
      this.sectionNameError.set('Could not rename the section right now.');
    }
  }

  protected canMoveSection(section: ProjectSection, direction: -1 | 1): boolean {
    const sections = this.sections();
    const index = sections.findIndex((item) => item.id === section.id);
    const target = index + direction;
    return index >= 0 && target >= 0 && target < sections.length;
  }

  protected async moveSection(section: ProjectSection, direction: -1 | 1, event?: MouseEvent) {
    event?.stopPropagation();
    this.sectionMenuId.set(null);
    const sections = this.sections();
    const index = sections.findIndex((item) => item.id === section.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) {
      return;
    }

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    await this.persistSectionOrder(sections, reordered);
  }

  protected onSectionDrop(event: CdkDragDrop<ProjectSection[]>) {
    const sections = this.sections();
    const dragged = sections[event.previousIndex];
    const target = sections[event.currentIndex];
    if (!dragged || !target || dragged.id === target.id) {
      return;
    }

    const reordered = [...sections];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    void this.persistSectionOrder(sections, reordered);
  }

  protected openAddTaskInSection(section: ProjectSection, event?: MouseEvent) {
    event?.stopPropagation();
    this.sectionMenuId.set(null);
    this.workspace()?.openCreateTaskModal(this.projectId(), null, [], '', section.id);
  }

  protected askDeleteSection(section: ProjectSection, event?: MouseEvent) {
    event?.stopPropagation();
    this.sectionMenuId.set(null);
    this.sectionToDelete.set(section);
  }

  protected closeDeleteSection() {
    this.sectionToDelete.set(null);
  }

  protected async confirmDeleteSection() {
    const section = this.sectionToDelete();
    if (!section) {
      return;
    }
    try {
      await this.projectService.deleteSection(section.id);
      this.sections.update((sections) => sections.filter((item) => item.id !== section.id));
      this.statusService.show('Section deleted · its tasks stayed in this project', 'info', 5000);
      this.closeDeleteSection();
    } catch {
      this.statusService.show('Could not delete the section right now.', 'error', 5000);
    }
  }

  private async persistSectionOrder(previous: ProjectSection[], reordered: ProjectSection[]) {
    const projectId = this.projectId();
    if (!projectId) {
      return;
    }
    this.sections.set(reordered);
    try {
      const result = await this.projectService.reorderSections(
        projectId,
        reordered.map((section) => section.id),
      );
      this.sections.set(result);
    } catch {
      this.sections.set(previous);
      this.statusService.show('Could not reorder your sections right now.', 'error', 5000);
    }
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
      this.sections.set([]);
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
        this.sections.set([]);
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
        this.sections.set([]);
        this.projectState.set('not-found');
        return;
      }

      const sections = await this.projectService.getSections(projectId);
      if (requestToken !== this.loadToken) {
        return;
      }

      this.loadedProjectId.set(projectId);
      this.project.set(project);
      this.projectTasks.set(projectTasks);
      this.sections.set(sections);
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
