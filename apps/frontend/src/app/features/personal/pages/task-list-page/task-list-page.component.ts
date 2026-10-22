import {
  Component,
  computed,
  inject,
  signal,
  viewChild,
  OnInit,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Label, Task } from '@yotara/shared';
import { PreferencesStore } from '../../../../core/services/preferences-store.service';
import { ProjectService } from '../../../../core/services/project.service';
import {
  TaskService,
  UpcomingBucket,
  UpcomingTaskGroup,
} from '../../../../core/services/task.service';
import { LabelService } from '../../../../core/services/label.service';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import { PersonalTaskCardComponent } from '../../components/personal-task-card.component';
import { StatusService } from '../../../../core/services/status.service';
import { InsightPanelComponent } from '../../components/insight-panel.component';
import { CaptureBarComponent } from '../../components/capture-bar.component';
import { SectionHeaderComponent } from '../../../../shared/components/section-header/section-header.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { TaskViewControlsComponent } from '../../../../shared/components/task-view-controls/task-view-controls.component';
import { TaskLabelFilterComponent } from '../../../../shared/components/task-label-filter/task-label-filter.component';
import { TaskStackComponent } from '../../../../shared/components/task-stack/task-stack.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faSun, faCalendarDay, faCloud, faTag } from '@fortawesome/free-solid-svg-icons';
import { parseTaskCommand } from '../../utils/task-command-parser';
import { taskCreationNotification } from '../../utils/task-creation-notification';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { sortAndPaginate, sortTasks, TaskSortOption } from '../../../../shared/utils/task-sort';
import { TaskListViewMode, InsightType } from './types';
import {
  DAILY_CLARITY_PROMPTS,
  YOTARA_JOURNAL_PROMPTS,
  pickRandomPrompt,
} from '../../utils/insight-prompts';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-task-list-page',
  standalone: true,
  imports: [
    PersonalTaskWorkspaceComponent,
    PersonalTaskCardComponent,
    InsightPanelComponent,
    CaptureBarComponent,
    SectionHeaderComponent,
    PageHeaderComponent,
    PaginationComponent,
    TaskViewControlsComponent,
    TaskLabelFilterComponent,
    FontAwesomeModule,
    EmptyStateComponent,
    TaskStackComponent,
  ],
  templateUrl: './task-list-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './task-list-page.component.scss',
})
export class TaskListPageComponent implements OnInit {
  protected readonly taskService = inject(TaskService);
  protected readonly projectService = inject(ProjectService);
  protected readonly labelService = inject(LabelService);
  protected readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly preferences = inject(PreferencesStore);

  protected readonly faPlus = faPlus;
  protected readonly faSun = faSun;
  protected readonly faCalendarDay = faCalendarDay;
  protected readonly faCloud = faCloud;
  protected readonly faTag = faTag;

  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly captureBar = viewChild(CaptureBarComponent);

  // --- Sorting & Pagination ---
  protected readonly sortOption = signal<TaskSortOption>('date');
  protected readonly pageSize = signal<10 | 25>(10);
  protected readonly currentPage = signal(1);

  // --- View Mode Management ---
  protected readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(
      map(
        (params) => (params.get('view') as TaskListViewMode) || this.inferViewFromPath() || 'inbox',
      ),
    ),
    { initialValue: 'inbox' as TaskListViewMode },
  );

  private inferViewFromPath(): TaskListViewMode | null {
    const path = this.router.url.split('?')[0];
    if (path.endsWith('/inbox')) return 'inbox';
    if (path.endsWith('/today')) return 'today';
    if (path.endsWith('/upcoming')) return 'upcoming';
    return null;
  }

  // --- Label filter (persisted in ?labels=id1,id2) ---
  protected readonly labels = this.labelService.labels;
  protected readonly selectedLabelIds = toSignal(
    this.route.queryParamMap.pipe(
      map((params) =>
        (params.get('labels') ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ),
    { initialValue: [] as string[] },
  );
  protected readonly labelFilterMode = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => (params.get('labelMode') === 'all' ? ('all' as const) : ('any' as const))),
    ),
    { initialValue: 'any' as const },
  );
  protected readonly hasLabelFilter = computed(() => this.selectedLabelIds().length > 0);
  protected readonly labelFilteredTasks = this.taskService.labelFilteredTasks;
  protected readonly processedLabelTasks = computed(() =>
    sortAndPaginate(
      this.taskService.labelFilteredTasks(),
      this.sortOption(),
      this.currentPage(),
      this.pageSize(),
    ),
  );
  protected readonly labelFilterTitle = computed(() => {
    const labelsById = this.labelService.labelById();
    const names = this.selectedLabelIds()
      .map((id) => labelsById.get(id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? `Labeled: ${names.join(' + ')}` : 'Labeled tasks';
  });
  protected readonly labelFilterCount = computed(() =>
    this.taskService.labelFilterPending() ? '…' : `${this.labelFilteredTasks().length} tasks`,
  );

  // --- Header Data ---
  protected readonly pageTitle = computed(() => {
    switch (this.viewMode()) {
      case 'inbox':
        return 'Inbox';
      case 'today':
        return 'Today';
      case 'upcoming':
        return 'Upcoming';
      default:
        return 'Tasks';
    }
  });

  protected readonly pageSubtitle = computed(() => {
    switch (this.viewMode()) {
      case 'today':
        return `${this.dateLabel()} - ${this.progressLabel()}`;
      case 'upcoming':
        return this.upcomingLabel();
      default:
        return '';
    }
  });

  protected readonly upcomingLabel = computed(() => {
    const total = this.taskService.upcomingTasks().length;
    return total === 0 ? 'a clear horizon' : `${total} ${total === 1 ? 'task' : 'tasks'} ahead`;
  });

  // --- Inbox Logic ---
  protected readonly subtasksByParent = computed(() => {
    const all = this.taskService.allActiveTasks();
    const subtasksByParentMap = new Map<string, Task[]>();
    for (const task of all) {
      if (task.parentId) {
        const list = subtasksByParentMap.get(task.parentId) ?? [];
        list.push(task);
        subtasksByParentMap.set(task.parentId, list);
      }
    }
    return subtasksByParentMap;
  });

  protected readonly inboxCountLabel = computed(
    () => `${this.taskService.inboxTasks().length} Tasks`,
  );

  protected readonly processedInboxTasks = computed(() =>
    sortAndPaginate(
      this.taskService.inboxTasks(),
      this.sortOption(),
      this.currentPage(),
      this.pageSize(),
    ),
  );

  protected readonly processedTodayTasks = computed(() =>
    sortAndPaginate(
      this.taskService.todayTasks(),
      this.sortOption(),
      this.currentPage(),
      this.pageSize(),
    ),
  );

  protected readonly processedUpcomingGroups = computed<UpcomingTaskGroup[]>(() => {
    const tasks = this.taskService.upcomingTasks();
    const sorted = sortTasks(tasks, this.sortOption());

    const buckets: Record<UpcomingBucket, Task[]> = {
      'This Week': [],
      'Next Week': [],
      Later: [],
    };

    for (const task of sorted) {
      buckets[this.taskService.upcomingBucketForTask(task)].push(task);
    }

    return (Object.entries(buckets) as [UpcomingBucket, Task[]][])
      .filter(([, tasks]) => tasks.length > 0)
      .map(([label, tasks]) => ({ label, tasks }));
  });

  protected readonly totalTasksCount = computed(() => {
    if (this.hasLabelFilter()) {
      return this.taskService.labelFilteredTasks().length;
    }
    switch (this.viewMode()) {
      case 'inbox':
        return this.taskService.inboxTasks().length;
      case 'today':
        return this.taskService.todayTasks().length;
      case 'upcoming':
        return this.taskService.upcomingTasks().length;
      default:
        return 0;
    }
  });

  protected readonly showInitialLoading = computed(
    () => this.taskService.loading() && this.taskService.allActiveTasks().length === 0,
  );

  /** True when the list behind the current view hit the API's page cap. */
  protected readonly limitExceeded = computed(() => {
    if (this.hasLabelFilter()) {
      return this.taskService.labelFilterTruncated() && !this.taskService.labelFilterPending();
    }
    switch (this.viewMode()) {
      case 'today':
        return this.taskService.todayTruncated() || this.taskService.overdueTruncated();
      case 'upcoming':
        return this.taskService.upcomingTruncated();
      case 'inbox':
        return this.taskService.inboxTruncated();
      default:
        return false;
    }
  });

  protected readonly defaultCaptureProjectId = computed(() => {
    const inboxProject = this.projectService.projects().find((project) => project.name === 'Inbox');
    return inboxProject?.id ?? this.projectService.projects()[0]?.id ?? '';
  });

  // --- Insight Panel ---
  protected readonly dailyClarityPrompt = signal(pickRandomPrompt(DAILY_CLARITY_PROMPTS));
  protected readonly journalPrompt = signal(pickRandomPrompt(YOTARA_JOURNAL_PROMPTS));
  protected readonly activeInsightType = signal<InsightType>(
    Math.random() > 0.5 ? 'clarity' : 'journal',
  );
  protected readonly insightPanelVisible = computed(() => !this.preferences.insightDismissed());
  private readonly statusService = inject(StatusService);

  protected readonly insightPrompt = computed(() =>
    this.activeInsightType() === 'clarity' ? this.dailyClarityPrompt() : this.journalPrompt(),
  );

  // --- Capture Bar ---
  private capturing = false;

  protected async handleCapture() {
    if (this.capturing) return;
    this.capturing = true;
    try {
      const bar = this.captureBar();
      if (!bar) return;

      const rawValue = bar.getTitle().trim();

      if (!rawValue) {
        bar.setError('Add a task title to capture it.');
        return;
      }

      // Merge labels created from this capture with the live list so a tag
      // created in the combobox resolves even before the refresh lands.
      const availableLabels = new Map<string, { id: string; name: string }>();
      for (const label of this.labelService.labels()) {
        availableLabels.set(label.id, { id: label.id, name: label.name });
      }
      for (const label of bar.getCreatedLabels()) {
        availableLabels.set(label.id, label);
      }
      const labelCandidates = [...availableLabels.values()];

      const { title, priority, labelNames } = parseTaskCommand(rawValue, {
        knownLabelNames: labelCandidates.map((label) => label.name),
      });
      const dueDateDraft = bar.getDueDateDraft();

      const resolvedLabels = labelCandidates
        .filter((label) =>
          labelNames.some((name) => name.toLowerCase() === label.name.toLowerCase()),
        )
        .map((label) => label.id);

      const behavior =
        bar.getLastSubmissionType() === 'default'
          ? this.authState.user()?.captureBehavior || 'quick'
          : bar.getLastSubmissionType();

      bar.clearError();

      if (behavior === 'quick') {
        try {
          const dueDate = dueDateDraft.source === 'cleared' ? '' : dueDateDraft.value;
          const dueTime = dueDateDraft.source === 'cleared' ? '' : (dueDateDraft.dueTime ?? '');
          const projectId = bar.getProjectId() || this.defaultCaptureProjectId() || undefined;
          await this.taskService.createTask({
            title,
            priority: priority || 'medium',
            labels: resolvedLabels,
            projectId,
            status: 'inbox',
            ...(dueDate ? { dueDate } : {}),
            ...(dueTime ? { dueTime } : {}),
            simpleMode: false,
          });
          this.statusService.success(
            taskCreationNotification({
              title,
              dueDate,
              dueTime,
              status: 'inbox',
              projects: this.projectService.projects(),
              projectId,
              defaultProjectId: this.defaultCaptureProjectId() || undefined,
            }),
          );
          bar.resetCapture();
        } catch (_) {
          bar.setError('Failed to quick capture task.');
        }
      } else {
        this.workspace()?.openCreateTaskModal(
          bar.getProjectId() || this.defaultCaptureProjectId() || null,
          dueDateDraft,
          resolvedLabels,
          title,
        );
        bar.resetSubmissionType();
      }
    } finally {
      this.capturing = false;
    }
  }

  protected handleTaskSaved(mode: 'create' | 'update') {
    if (mode === 'create') {
      this.captureBar()?.resetCapture();
    }

    this.dailyClarityPrompt.set(pickRandomPrompt(DAILY_CLARITY_PROMPTS));
    this.journalPrompt.set(pickRandomPrompt(YOTARA_JOURNAL_PROMPTS));
    this.activeInsightType.set(Math.random() > 0.5 ? 'clarity' : 'journal');
  }

  protected dismissInsight() {
    this.preferences.setInsightDismissed(true);
    this.statusService.show('Insights can be re-enabled in Settings.', 'info', 4000);
  }

  // --- Today Logic ---
  protected readonly dateLabel = computed(() =>
    new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date()),
  );

  protected readonly progressLabel = computed(() => {
    const total =
      this.taskService.overdueTasks().length +
      this.taskService.todayTasks().length +
      this.taskService.todayCompletedTasks().length;
    const completed = this.taskService.todayCompletedTasks().length;

    return total === 0 ? 'a clear page' : `${completed} of ${total} done`;
  });

  constructor() {
    effect(() => {
      this.viewMode();
      this.sortOption();
      this.pageSize();
      this.totalTasksCount();
      this.currentPage.set(1);
    });

    // Keep the service query in sync with the URL-owned filter.
    effect(() => {
      this.taskService.setLabelFilter(this.selectedLabelIds(), this.labelFilterMode());
      this.currentPage.set(1);
    });
  }

  // --- Label filter events ---
  protected onLabelFilterChange(ids: string[]) {
    const mode = ids.length > 1 ? this.labelFilterMode() : 'any';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        labels: ids.length > 0 ? ids.join(',') : null,
        labelMode: mode === 'all' ? 'all' : null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected onLabelFilterModeChange(mode: 'any' | 'all') {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { labelMode: mode === 'all' ? 'all' : null },
      queryParamsHandling: 'merge',
    });
  }

  protected filterByLabel(label: Label) {
    const selected = this.selectedLabelIds();
    const next = selected.includes(label.id)
      ? selected.filter((id) => id !== label.id)
      : [...selected, label.id];
    this.onLabelFilterChange(next);
  }

  // --- Sorting & Pagination Events ---
  protected onSortOptionChange(option: TaskSortOption) {
    this.sortOption.set(option);
  }

  protected onPageSizeChange(size: 10 | 25) {
    this.pageSize.set(size);
  }

  protected onPageChange(page: number) {
    this.currentPage.set(page);
  }

  // --- Shared Actions ---
  protected openCreateTaskModal() {
    this.workspace()?.openCreateTaskModal();
  }

  protected editTask(task: Task) {
    this.workspace()?.editTask(task);
  }

  ngOnInit() {
    // Initial data load if needed
  }
}
