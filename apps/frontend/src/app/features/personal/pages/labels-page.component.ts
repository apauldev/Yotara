import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  finalize,
  map,
  of,
  switchMap,
} from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faEllipsisVertical, faInbox, faTag } from '@fortawesome/free-solid-svg-icons';
import { Label, Task } from '@yotara/shared';
import type { LabelIcon } from '@yotara/shared';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LabelIconComponent } from '../../../shared/ui/label-icon/label-icon.component';
import { LabelEditorComponent } from '../components/label-editor.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { LabelService } from '../../../core/services/label.service';
import { TaskService } from '../../../core/services/task.service';
import { existingLabelFromConflict } from '../../../shared/utils/label-conflict';

type PaneFilter = 'open' | 'completed' | 'all';

interface DirectorySection {
  id: 'pinned' | 'all';
  title: string;
  labels: Label[];
}

interface StarterLabel {
  name: string;
  icon: LabelIcon;
  color: string;
}

const STARTER_LABELS: StarterLabel[] = [
  { name: 'Urgent', icon: 'flame', color: '#d44d3c' },
  { name: 'Waiting', icon: 'hourglass', color: '#a5d3e1' },
  { name: 'Planning', icon: 'calendar-days', color: '#b9a3f4' },
  { name: 'Errand', icon: 'basket-shopping', color: '#f1c582' },
  { name: 'Review', icon: 'check-double', color: '#c7e9b3' },
  { name: 'Idea', icon: 'lightbulb', color: '#82d7a9' },
];

/**
 * The single management surface for labels. The directory selects the filter
 * (the active label stays off its own cards); the pane queries the task API
 * server-side. Delete lives in the row menu and editor with truthful count
 * copy. Below 1200px the page becomes a drill-in list → detail flow.
 */
@Component({
  selector: 'app-labels-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    LabelEditorComponent,
    LabelIconComponent,
    ConfirmDialogComponent,
    FontAwesomeModule,
    EmptyStateComponent,
  ],
  templateUrl: './labels-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './labels-page.component.scss',
  host: {
    '(document:click)': 'closeMenus()',
    '(document:keydown.escape)': 'closeMenus()',
  },
})
export class LabelsPageComponent {
  protected readonly faTag = faTag;
  protected readonly faInbox = faInbox;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faEllipsisVertical = faEllipsisVertical;
  protected readonly labelService = inject(LabelService);
  protected readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  private readonly paneHeading = viewChild<ElementRef<HTMLElement>>('paneHeading');
  private readonly rowLinks = viewChildren<ElementRef<HTMLButtonElement>>('labelRowLink');
  private readonly initialLabelParam = this.route.snapshot.queryParamMap.get('label');

  protected readonly labels = this.labelService.labels;
  protected readonly labelEditorOpen = signal(false);
  protected readonly editorLabel = signal<Label | null>(null);
  protected readonly rowMenuLabelId = signal<string | null>(null);
  protected readonly paneMenuOpen = signal(false);
  protected readonly deleteTarget = signal<Label | null>(null);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly paneError = signal<string | null>(null);
  protected readonly paneLoading = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly labelSearch = signal('');
  protected readonly paneFilter = signal<PaneFilter>('open');
  protected readonly creatingStarter = signal<string | null>(null);
  protected readonly starters = STARTER_LABELS;
  /** Mobile drill-in: the list is replaced by the detail until Back. */
  protected readonly drillInOpen = signal(false);
  /** Bumped when label mutations need the pane to refetch its tasks. */
  protected readonly labelRefresh = signal(0);

  protected readonly selectedLabelId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('label'))),
    { initialValue: this.route.snapshot.queryParamMap.get('label') },
  );

  protected readonly labelsLoaded = computed(() => !this.labelService.loading());
  protected readonly hasLabels = computed(() => this.labels().length > 0);

  protected readonly filteredLabels = computed(() => {
    const query = this.labelSearch().trim().toLowerCase();
    const labels = this.labels();
    return query ? labels.filter((label) => label.name.toLowerCase().includes(query)) : labels;
  });

  /** Pinned labels get their own directory section before the A–Z remainder. */
  protected readonly directorySections = computed<DirectorySection[]>(() => {
    const labels = this.filteredLabels();
    const pinned = labels.filter((label) => label.pinned);
    const rest = labels.filter((label) => !label.pinned);
    const sections: DirectorySection[] = [];
    if (pinned.length > 0) {
      sections.push({ id: 'pinned', title: 'Pinned', labels: pinned });
    }
    if (rest.length > 0) {
      sections.push({ id: 'all', title: 'All labels', labels: rest });
    }
    return sections;
  });

  protected readonly paneFilterOptions = computed(() => {
    const label = this.selectedLabel();
    return [
      { id: 'open' as const, label: 'Open', count: label?.openTaskCount ?? 0 },
      { id: 'completed' as const, label: 'Completed', count: label?.completedTaskCount ?? 0 },
      { id: 'all' as const, label: 'All', count: label?.totalTaskCount ?? 0 },
    ];
  });

  protected readonly paneEmptyTitle = computed(() => {
    const name = this.selectedLabel()?.name ?? 'this label';
    switch (this.paneFilter()) {
      case 'completed':
        return `No completed tasks in ${name}`;
      case 'all':
        return `No tasks in ${name}`;
      default:
        return `No open tasks in ${name}`;
    }
  });

  /**
   * The edited label only resolves against the live list; an unknown ?label
   * deep link (or a deleted id) stays null and the page shows its
   * label-not-found state once loading has finished.
   */
  protected readonly selectedLabel = computed(
    () => this.labels().find((label) => label.id === this.selectedLabelId()) ?? null,
  );

  protected readonly showNotFound = computed(
    () =>
      this.labelsLoaded() &&
      this.hasLabels() &&
      Boolean(this.selectedLabelId()) &&
      !this.selectedLabel(),
  );

  /**
   * Server-side filter: the pane runs one GET /tasks?labelIds=… request per
   * selected label and pane filter (includeSubtasks=true matches the flat
   * count scope), so the visible list and the directory counts agree.
   */
  protected readonly paneTasks = toSignal(
    combineLatest([
      toObservable(computed(() => this.fetchableLabelId())).pipe(distinctUntilChanged()),
      toObservable(this.paneFilter),
      toObservable(this.labelRefresh),
    ]).pipe(
      switchMap(([labelId, filter]) => {
        if (!labelId) {
          this.paneLoading.set(false);
          this.paneError.set(null);
          return of([] as Task[]);
        }

        this.paneLoading.set(true);
        this.paneError.set(null);
        return this.taskService.fetchTasksByLabel$(labelId, completedForFilter(filter)).pipe(
          finalize(() => this.paneLoading.set(false)),
          catchError(() => {
            this.paneError.set("Could not load this label's tasks right now.");
            return of([] as Task[]);
          }),
        );
      }),
      map((tasks) => [...tasks].sort((left, right) => left.order - right.order)),
    ),
    { initialValue: [] as Task[] },
  );

  /**
   * The pane only fetches for a label that exists in the loaded list; while a
   * label rename/refresh is in flight there is nothing to query.
   */
  private fetchableLabelId(): string | null {
    return this.selectedLabelId() && this.selectedLabel() ? this.selectedLabelId() : null;
  }

  constructor() {
    if (this.initialLabelParam && this.isNarrowViewport()) {
      this.drillInOpen.set(true);
    }

    // Default selection lands after labels load: the first pinned label, then
    // the first alphabetical label.
    effect(() => {
      if (!this.selectedLabelId() && this.hasLabels()) {
        void this.selectLabelId(this.defaultLabelId());
      }
    });
  }

  /** Pinned-first default, independent of the order a caller supplied. */
  private readonly defaultLabelId = computed(() => {
    const [first] = [...this.labels()].sort(
      (left, right) =>
        Number(right.pinned) - Number(left.pinned) || left.name.localeCompare(right.name),
    );
    return first?.id ?? null;
  });

  protected async selectLabel(label: Label) {
    this.drillInOpen.set(true);
    await this.selectLabelId(label.id);
    if (this.isNarrowViewport()) {
      this.focusPaneHeading();
    }
  }

  protected async selectLabelId(labelId: string | null) {
    if (labelId === null) {
      this.drillInOpen.set(false);
    }
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { label: labelId ?? null },
      queryParamsHandling: 'merge',
    });
  }

  protected closeDrillIn() {
    this.drillInOpen.set(false);
    const selectedId = this.selectedLabelId();
    setTimeout(() => {
      this.rowLinks()
        .find((row) => row.nativeElement.dataset['labelId'] === selectedId)
        ?.nativeElement.focus();
    });
  }

  protected setPaneFilter(filter: PaneFilter) {
    this.paneFilter.set(filter);
  }

  // ---- directory row menu -----------------------------------------------

  protected toggleRowMenu(label: Label, event: MouseEvent) {
    event.stopPropagation();
    this.paneMenuOpen.set(false);
    this.rowMenuLabelId.set(this.rowMenuLabelId() === label.id ? null : label.id);
  }

  protected closeMenus() {
    if (this.rowMenuLabelId()) {
      this.rowMenuLabelId.set(null);
    }
    if (this.paneMenuOpen()) {
      this.paneMenuOpen.set(false);
    }
  }

  protected togglePaneMenu(event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuLabelId.set(null);
    this.paneMenuOpen.set(!this.paneMenuOpen());
  }

  protected openEditLabel(label: Label, event?: MouseEvent) {
    event?.stopPropagation();
    this.rowMenuLabelId.set(null);
    this.paneMenuOpen.set(false);
    this.editorLabel.set(label);
    this.labelEditorOpen.set(true);
  }

  protected async togglePinned(label: Label, event?: MouseEvent) {
    event?.stopPropagation();
    this.rowMenuLabelId.set(null);
    this.paneMenuOpen.set(false);
    this.actionError.set(null);
    try {
      await this.labelService.updateLabel(label.id, { pinned: !label.pinned });
    } catch {
      this.actionError.set('Could not update the label right now. Try again.');
    }
  }

  // ---- create / edit ----------------------------------------------------

  protected openCreateLabel() {
    this.editorLabel.set(null);
    this.labelEditorOpen.set(true);
  }

  /** The starter gallery creates one curated label directly, no editor needed. */
  protected async createStarter(starter: StarterLabel) {
    if (this.creatingStarter()) {
      return;
    }

    this.creatingStarter.set(starter.name);
    this.actionError.set(null);
    try {
      const created = await this.labelService.createLabel({
        name: starter.name,
        icon: starter.icon,
        color: starter.color,
      });
      await this.selectLabelId(created.id);
    } catch (error) {
      const existing = existingLabelFromConflict(error);
      if (existing) {
        this.labelService.refresh();
        await this.selectLabelId(existing.id);
      } else {
        this.actionError.set('Could not create the starter label. Try again.');
      }
    } finally {
      this.creatingStarter.set(null);
    }
  }

  protected closeLabelEditor() {
    this.labelEditorOpen.set(false);
  }

  /** Creating selects the new label; an edit leaves the pane and its tasks untouched. */
  protected onLabelSaved(saved: Label) {
    if (this.editorLabel() === null) {
      void this.selectLabelId(saved.id);
    }
  }

  /** Duplicate-name path from the editor: jump to the label that already exists. */
  protected openExistingLabel(labelId: string) {
    this.closeLabelEditor();
    if (!this.labels().some((label) => label.id === labelId)) {
      this.labelService.refresh();
    }
    void this.selectLabelId(labelId);
  }

  // ---- delete -----------------------------------------------------------

  protected askDeleteLabel(label: Label, event?: MouseEvent) {
    event?.stopPropagation();
    this.rowMenuLabelId.set(null);
    this.paneMenuOpen.set(false);
    this.deleteTarget.set(label);
    this.deleteConfirmOpen.set(true);
  }

  protected askDeleteFromEditor(label: Label) {
    this.closeLabelEditor();
    this.deleteTarget.set(label);
    this.deleteConfirmOpen.set(true);
  }

  protected closeDeleteConfirm() {
    this.deleteConfirmOpen.set(false);
    this.deleteTarget.set(null);
  }

  protected get deleteCopy(): string {
    const label = this.deleteTarget();
    if (!label) {
      return '';
    }
    return `It is on ${label.openTaskCount} open and ${label.completedTaskCount} completed tasks. The tasks will stay; the label will be removed.`;
  }

  /**
   * Delete, then reflow: clear the query param, select the label that followed
   * it (computed from the refreshed list), or let the empty state take over.
   */
  protected async confirmDelete() {
    const target = this.deleteTarget();
    if (!target || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.actionError.set(null);
    try {
      const previousIndex = this.labels().findIndex((label) => label.id === target.id);
      const freshLabels = await this.labelService.deleteLabelAndList(target.id);
      const next = freshLabels[previousIndex] ?? freshLabels[previousIndex - 1] ?? null;

      this.deleteConfirmOpen.set(false);
      this.deleteTarget.set(null);
      if (!next) {
        this.drillInOpen.set(false);
      }
      void this.selectLabelId(next?.id ?? null);
      this.labelRefresh.update((value) => value + 1);
    } catch {
      this.actionError.set('Could not delete the label right now. Try again.');
    } finally {
      this.deleting.set(false);
    }
  }

  // ---- pane actions -----------------------------------------------------

  /** A task created from this pane is born with the active label applied. */
  protected addTaskToSelection() {
    const labelId = this.selectedLabel()?.id;
    if (!labelId) {
      return;
    }
    this.workspace()?.openCreateTaskModal(null, null, [labelId]);
  }

  protected editTask(task: Task) {
    this.workspace()?.editTask(task);
  }

  private focusPaneHeading() {
    setTimeout(() => this.paneHeading()?.nativeElement.focus());
  }

  private isNarrowViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 1200px)').matches;
  }
}

function completedForFilter(filter: PaneFilter): boolean | undefined {
  if (filter === 'open') {
    return false;
  }
  if (filter === 'completed') {
    return true;
  }
  return undefined;
}
