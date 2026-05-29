import { Component, computed, inject, signal, viewChild, OnInit, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Task } from '@yotara/shared';
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
import { TaskStackComponent } from '../../../../shared/components/task-stack/task-stack.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faSun, faCalendarDay, faCloud } from '@fortawesome/free-solid-svg-icons';
import { parseTaskCommand } from '../../utils/task-command-parser';
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
    FontAwesomeModule,
    EmptyStateComponent,
    TaskStackComponent,
  ],
  templateUrl: './task-list-page.component.html',
  styleUrl: './task-list-page.component.scss',
})
export class TaskListPageComponent implements OnInit {
  protected readonly taskService = inject(TaskService);
  protected readonly projectService = inject(ProjectService);
  protected readonly labelService = inject(LabelService);
  protected readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly faPlus = faPlus;
  protected readonly faSun = faSun;
  protected readonly faCalendarDay = faCalendarDay;
  protected readonly faCloud = faCloud;

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
      case 'inbox':
        return 'Collect everything that needs your attention.';
      case 'today':
        return `${this.dateLabel()} - ${this.progressLabel()}`;
      case 'upcoming':
        return 'See what is approaching and space it out before it becomes noisy.';
      default:
        return '';
    }
  });

  // --- Inbox Logic ---
  protected readonly subtasksByParent = computed(() => {
    const all = this.taskService.tasks();
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
    () => this.taskService.loading() && this.taskService.tasks().length === 0,
  );

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
  private readonly INSIGHT_DISMISSED_KEY = 'yotara_insightDismissed';
  protected readonly insightPanelVisible = signal(
    localStorage.getItem('yotara_insightDismissed') !== 'true',
  );
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

      const { title, priority, labelNames } = parseTaskCommand(rawValue);

      const resolvedLabels = this.labelService
        .labels()
        .filter((l) => labelNames.some((name) => name.toLowerCase() === l.name.toLowerCase()))
        .map((l) => l.id);

      const behavior =
        bar.getLastSubmissionType() === 'default'
          ? this.authState.user()?.captureBehavior || 'quick'
          : bar.getLastSubmissionType();

      bar.clearError();

      if (behavior === 'quick') {
        try {
          await this.taskService.createTask({
            title,
            priority: priority || 'medium',
            labels: resolvedLabels,
            projectId: bar.getProjectId() || this.defaultCaptureProjectId() || undefined,
            status: 'inbox',
          });
          bar.clearTitle();
        } catch (_) {
          bar.setError('Failed to quick capture task.');
        }
      } else {
        this.workspace()?.openCreateTaskModal(
          bar.getProjectId() || this.defaultCaptureProjectId() || null,
        );
      }

      bar.resetSubmissionType();
    } finally {
      this.capturing = false;
    }
  }

  protected handleTaskSaved(mode: 'create' | 'update') {
    if (mode === 'create') {
      this.captureBar()?.clearTitle();
    }

    this.dailyClarityPrompt.set(pickRandomPrompt(DAILY_CLARITY_PROMPTS));
    this.journalPrompt.set(pickRandomPrompt(YOTARA_JOURNAL_PROMPTS));
    this.activeInsightType.set(Math.random() > 0.5 ? 'clarity' : 'journal');
  }

  protected dismissInsight() {
    this.insightPanelVisible.set(false);
    localStorage.setItem(this.INSIGHT_DISMISSED_KEY, 'true');
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
      this.currentPage.set(1);
    });
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
