import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
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
import { faEllipsisVertical } from '@fortawesome/free-solid-svg-icons';
import { faInbox } from '@fortawesome/free-solid-svg-icons';
import { faTag } from '@fortawesome/free-solid-svg-icons';
import { Label, Task } from '@yotara/shared';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LabelChipComponent } from '../../../shared/ui/label-chip/label-chip.component';
import { LabelModalComponent } from '../components/label-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { LabelService } from '../../../core/services/label.service';
import { TaskService } from '../../../core/services/task.service';

/**
 * The single management surface for labels. The directory selects the filter
 * (the active label stays off its own cards); the pane queries the task API
 * server-side. Delete lives in the per-row menu with truthful count copy —
 * never inside the label editor.
 */
@Component({
  selector: 'app-labels-page',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    LabelModalComponent,
    LabelChipComponent,
    ConfirmDialogComponent,
    FontAwesomeModule,
    EmptyStateComponent,
  ],
  templateUrl: './labels-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './labels-page.component.scss',
})
export class LabelsPageComponent {
  protected readonly faTag = faTag;
  protected readonly faInbox = faInbox;
  protected readonly faEllipsisVertical = faEllipsisVertical;
  protected readonly labelService = inject(LabelService);
  protected readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly taskPane = viewChild<ElementRef<HTMLElement>>('taskPane');

  protected readonly labels = this.labelService.labels;
  protected readonly labelEditorOpen = signal(false);
  protected readonly editorLabel = signal<Label | null>(null);
  protected readonly rowMenuLabelId = signal<string | null>(null);
  protected readonly deleteTarget = signal<Label | null>(null);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly deleting = signal(false);
  protected readonly paneError = signal<string | null>(null);
  protected readonly paneLoading = signal(false);
  /** Bumped when label mutations need the pane to refetch its tasks. */
  protected readonly labelRefresh = signal(0);

  protected readonly selectedLabelId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('label'))),
    { initialValue: this.route.snapshot.queryParamMap.get('label') },
  );

  protected readonly labelsLoaded = computed(() => !this.labelService.loading());
  protected readonly hasLabels = computed(() => this.labels().length > 0);

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
   * selected label (includeSubtasks=true matches the flat count scope), so the
   * visible list and the directory counts come from the same task API source.
   */
  protected readonly paneTasks = toSignal(
    combineLatest([
      toObservable(computed(() => this.fetchableLabelId())).pipe(distinctUntilChanged()),
      toObservable(this.labelRefresh),
    ]).pipe(
      switchMap(([labelId]) => {
        if (!labelId) {
          this.paneLoading.set(false);
          this.paneError.set(null);
          return of([] as Task[]);
        }

        this.paneLoading.set(true);
        this.paneError.set(null);
        return this.taskService.fetchTasksByLabel$(labelId).pipe(
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
    // Default selection lands after labels load: the first alphabetical label
    // (the service already sorts by name) when no ?label param is present.
    effect(() => {
      const available = this.labels();
      if (!this.selectedLabelId() && available.length > 0) {
        void this.selectLabelId(available[0].id);
      }
    });
  }

  protected selectLabel(label: Label) {
    void this.selectLabelId(label.id);
  }

  protected async selectLabelId(labelId: string | null) {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { label: labelId ?? null },
      queryParamsHandling: 'merge',
    });
  }

  // ---- directory row menu -----------------------------------------------

  protected toggleRowMenu(label: Label, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuLabelId.set(this.rowMenuLabelId() === label.id ? null : label.id);
  }

  protected closeRowMenus() {
    if (this.rowMenuLabelId()) {
      this.rowMenuLabelId.set(null);
    }
  }

  protected openEditLabel(label: Label, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuLabelId.set(null);
    this.editorLabel.set(label);
    this.labelEditorOpen.set(true);
    if (label.id !== this.selectedLabelId()) {
      void this.selectLabelId(label.id);
    }
  }

  // ---- create / edit ----------------------------------------------------

  protected openCreateLabel() {
    this.editorLabel.set(null);
    this.labelEditorOpen.set(true);
  }

  protected closeLabelEditor() {
    this.labelEditorOpen.set(false);
  }

  /** Creating selects the new label; a rename refreshes the already-selected pane. */
  protected onLabelSaved(saved: Label) {
    this.labelRefresh.update((value) => value + 1);
    if (!this.selectedLabel()) {
      void this.selectLabelId(saved.id);
    }
  }

  // ---- delete -----------------------------------------------------------

  protected askDeleteLabel(label: Label, event: MouseEvent) {
    event.stopPropagation();
    this.rowMenuLabelId.set(null);
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
    try {
      const previousIndex = this.labels().findIndex((label) => label.id === target.id);
      const freshLabels = await this.labelService.deleteLabelAndList(target.id);
      const next = freshLabels[previousIndex] ?? freshLabels[previousIndex - 1] ?? null;

      this.deleteConfirmOpen.set(false);
      this.deleteTarget.set(null);
      void this.selectLabelId(next?.id ?? null);
      this.labelRefresh.update((value) => value + 1);
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
}
