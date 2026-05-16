import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild, OnInit, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Project, Task } from '@yotara/shared';
import { ProjectService } from '../../../../core/services/project.service';
import {
  TaskService,
  UpcomingBucket,
  UpcomingTaskGroup,
} from '../../../../core/services/task.service';
import { LabelService } from '../../../../core/services/label.service';
import { SearchService, SearchTab } from '../../../../core/services/search.service';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { PersonalTaskCardComponent } from '../../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import { SectionHeaderComponent } from '../../../../shared/components/section-header/section-header.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { ElementRef } from '@angular/core';
import { parseTaskCommand } from '../../utils/task-command-parser';

export type TaskListViewMode = 'inbox' | 'today' | 'upcoming' | 'search';
export type TaskSortOption = 'date' | 'alpha';
export type InsightType = 'clarity' | 'journal';

@Component({
  selector: 'app-task-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    SectionHeaderComponent,
    PageHeaderComponent,
    PaginationComponent,
    FontAwesomeModule,
  ],
  templateUrl: './task-list-page.component.html',
  styleUrl: './task-list-page.component.scss',
})
export class TaskListPageComponent implements OnInit {
  protected readonly taskService = inject(TaskService);
  protected readonly projectService = inject(ProjectService);
  protected readonly labelService = inject(LabelService);
  protected readonly searchService = inject(SearchService);
  protected readonly authState = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly faPlus = faPlus;
  protected readonly faXmark = faXmark;

  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly captureInput = viewChild<ElementRef<HTMLInputElement>>('captureInput');

  protected lastSubmissionType: 'quick' | 'capture' | 'default' = 'default';

  // --- Sorting & Pagination ---
  protected readonly sortOption = signal<TaskSortOption>('date');
  protected readonly pageSize = signal<10 | 25>(10);
  protected readonly currentPage = signal(1);

  // --- Autocomplete & Parsing ---
  protected readonly activeTagSearch = signal<string | null>(null);
  protected readonly selectedSuggestionIndex = signal(0);
  protected readonly tagSuggestions = computed(() => {
    const search = this.activeTagSearch();
    if (search === null) return [];
    return this.labelService
      .labels()
      .filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 5);
  });

  protected readonly highlightedTitle = computed(() => {
    const text = this.captureTitle();
    if (!text) return '';

    // Escape HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Highlight Priorities: !h, !high, etc. (requires space before or start of string)
    html = html.replace(
      /((?:^| )!([lhm]|low|med|medium|high)\b)/gi,
      '<span class="hl-priority">$1</span>',
    );

    // Highlight Labels: #tag (requires space before or start of string)
    html = html.replace(/((?:^| )#([\w-]+)\b)/g, '<span class="hl-label">$1</span>');

    return html;
  });

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
    if (path.endsWith('/search')) return 'search';
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
      case 'search':
        return 'Search';
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
      case 'search':
        return this.searchSubtitle();
      default:
        return '';
    }
  });

  // --- Inbox Logic ---
  protected readonly captureTitle = signal('');
  protected readonly captureProjectId = signal('');
  protected readonly captureError = signal('');

  protected readonly inboxCountLabel = computed(
    () => `${this.taskService.inboxTasks().length} Tasks`,
  );

  protected readonly processedInboxTasks = computed(() =>
    this.sortAndPaginate(this.taskService.inboxTasks()),
  );

  protected readonly processedTodayTasks = computed(() =>
    this.sortAndPaginate(this.taskService.todayTasks()),
  );

  protected readonly processedUpcomingGroups = computed<UpcomingTaskGroup[]>(() => {
    const tasks = this.taskService.upcomingTasks();
    const paginated = this.sortAndPaginate(tasks);

    const buckets: Record<UpcomingBucket, Task[]> = {
      'This Week': [],
      'Next Week': [],
      Later: [],
    };

    for (const task of paginated) {
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
      case 'search':
        return this.results().tasks.length;
      default:
        return 0;
    }
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalTasksCount() / this.pageSize())),
  );

  protected sortAndPaginate<T>(items: T[], getTask: (item: T) => Task = (i: any) => i): T[] {
    const sorted = [...items].sort((a, b) => {
      const taskA = getTask(a);
      const taskB = getTask(b);

      if (this.sortOption() === 'alpha') {
        return taskA.title.localeCompare(taskB.title);
      }

      // Default: date (newest created for inbox, or by dueDate)
      const dateA = new Date(taskA.dueDate || taskA.createdAt).getTime();
      const dateB = new Date(taskB.dueDate || taskB.createdAt).getTime();
      return dateB - dateA;
    });

    const start = (this.currentPage() - 1) * this.pageSize();
    return sorted.slice(start, start + this.pageSize());
  }

  protected readonly defaultCaptureProjectId = computed(() => {
    const inboxProject = this.projectService.projects().find((project) => project.name === 'Inbox');
    return inboxProject?.id ?? this.projectService.projects()[0]?.id ?? '';
  });

  protected readonly dailyClarityPrompt = signal(pickRandomPrompt(DAILY_CLARITY_PROMPTS));
  protected readonly journalPrompt = signal(pickRandomPrompt(YOTARA_JOURNAL_PROMPTS));
  protected readonly activeInsightType = signal<InsightType>(
    Math.random() > 0.5 ? 'clarity' : 'journal',
  );
  protected readonly insightPanelVisible = signal(true);

  protected async captureTask() {
    const rawValue = this.captureTitle().trim();

    if (!rawValue) {
      this.captureError.set('Add a task title to capture it.');
      this.lastSubmissionType = 'default';
      return;
    }

    const { title, priority, labelNames } = parseTaskCommand(rawValue);

    // Resolve labels
    const labels = this.labelService
      .labels()
      .filter((l) => labelNames.some((name) => name.toLowerCase() === l.name.toLowerCase()))
      .map((l) => l.id);

    const behavior =
      this.lastSubmissionType === 'default'
        ? this.authState.user()?.captureBehavior || 'quick'
        : this.lastSubmissionType;

    this.captureError.set('');

    if (behavior === 'quick') {
      try {
        await this.taskService.createTask({
          title,
          priority: priority || 'medium',
          labels,
          projectId: this.captureProjectId() || this.defaultCaptureProjectId() || undefined,
          status: 'inbox',
        });
        this.captureTitle.set('');
        this.activeTagSearch.set(null);
      } catch (_) {
        this.captureError.set('Failed to quick capture task.');
      }
    } else {
      this.workspace()?.openCreateTaskModal(
        this.captureProjectId() || this.defaultCaptureProjectId() || null,
      );
    }

    this.lastSubmissionType = 'default';
  }

  protected onCaptureInput() {
    const input = this.captureInput()?.nativeElement;
    if (!input) return;

    const value = input.value;
    const pos = input.selectionStart || 0;

    const lastHash = value.lastIndexOf('#', pos - 1);
    if (lastHash !== -1) {
      const textSinceHash = value.substring(lastHash + 1, pos);
      if (!textSinceHash.includes(' ')) {
        this.activeTagSearch.set(textSinceHash);
        this.selectedSuggestionIndex.set(0);
        return;
      }
    }

    this.activeTagSearch.set(null);
  }

  protected onCaptureKeyDown(event: KeyboardEvent) {
    if (this.activeTagSearch() !== null && this.tagSuggestions().length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectedSuggestionIndex.update((i) => (i + 1) % this.tagSuggestions().length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectedSuggestionIndex.update(
          (i) => (i - 1 + this.tagSuggestions().length) % this.tagSuggestions().length,
        );
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        this.selectSuggestion(this.tagSuggestions()[this.selectedSuggestionIndex()].name);
      } else if (event.key === 'Escape') {
        this.activeTagSearch.set(null);
      }
    }
  }

  protected selectSuggestion(labelName: string) {
    const input = this.captureInput()?.nativeElement;
    if (!input) return;

    const value = input.value;
    const pos = input.selectionStart || 0;
    const lastHash = value.lastIndexOf('#', pos - 1);

    if (lastHash !== -1) {
      const newValue = value.substring(0, lastHash) + '#' + labelName + ' ' + value.substring(pos);
      this.captureTitle.set(newValue);
      this.activeTagSearch.set(null);

      // Reset cursor position after change
      setTimeout(() => {
        const newPos = lastHash + labelName.length + 2; // +1 for #, +1 for space
        input.setSelectionRange(newPos, newPos);
        input.focus();
      });
    }
  }

  protected handleTaskSaved(mode: 'create' | 'update') {
    if (mode === 'create') {
      this.captureTitle.set('');
    }

    this.captureError.set('');
    this.dailyClarityPrompt.set(pickRandomPrompt(DAILY_CLARITY_PROMPTS));
    this.journalPrompt.set(pickRandomPrompt(YOTARA_JOURNAL_PROMPTS));
    this.activeInsightType.set(Math.random() > 0.5 ? 'clarity' : 'journal');
  }

  protected dismissInsight() {
    this.insightPanelVisible.set(false);
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

  // --- Search Logic ---
  private readonly queryParamMap = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => ({
        q: params.get('q')?.trim() ?? '',
        tab: normalizeTab(params.get('tab')),
      })),
    ),
    {
      initialValue: {
        q: this.route.snapshot.queryParamMap.get('q')?.trim() ?? '',
        tab: normalizeTab(this.route.snapshot.queryParamMap.get('tab')),
      },
    },
  );

  protected readonly searchQuery = computed(() => this.queryParamMap().q);
  protected readonly draftQuery = signal(this.queryParamMap().q);
  protected readonly activeTab = computed(() => this.queryParamMap().tab);
  protected readonly results = computed(() => this.searchService.search(this.searchQuery()));

  protected readonly taskResults = computed(() => {
    const raw = this.results().tasks;
    if (this.activeTab() === 'all') return raw.slice(0, 5);
    return this.sortAndPaginate(raw, (r) => r.task);
  });
  protected readonly projectResults = computed(() =>
    this.activeTab() === 'all' ? this.results().projects.slice(0, 3) : this.results().projects,
  );
  protected readonly labelResults = computed(() =>
    this.activeTab() === 'all' ? this.results().labels.slice(0, 5) : this.results().labels,
  );
  protected readonly resultCount = computed(
    () =>
      this.results().tasks.length + this.results().projects.length + this.results().labels.length,
  );

  protected readonly tabItems: { value: SearchTab; label: string; count?: () => number }[] = [
    { value: 'all', label: 'All' },
    { value: 'tasks', label: 'Tasks', count: () => this.results().tasks.length },
    { value: 'projects', label: 'Projects', count: () => this.results().projects.length },
    { value: 'labels', label: 'Labels', count: () => this.results().labels.length },
  ];

  constructor() {
    effect(() => {
      this.draftQuery.set(this.queryParamMap().q);
    });

    // Reset pagination when view mode, sort, or page size changes
    effect(
      () => {
        this.viewMode();
        this.sortOption();
        this.pageSize();
        this.currentPage.set(1);
      },
      { allowSignalWrites: true },
    );
  }

  private searchSubtitle() {
    const query = this.queryParamMap().q;
    if (!query) {
      return 'Search tasks and projects from the sanctuary.';
    }
    return `Results for “${query}”.`;
  }

  protected async submitSearch() {
    await this.navigateToSearchQuery(this.draftQuery().trim(), this.activeTab());
  }

  protected async chooseSearchTab(tab: SearchTab) {
    await this.navigateToSearchQuery(this.draftQuery().trim(), tab);
  }

  protected projectLabel(project: Project) {
    if (project.openTaskCount === 1) {
      return '1 open task';
    }
    return `${project.openTaskCount} open tasks`;
  }

  private async navigateToSearchQuery(query: string, tab: SearchTab) {
    await this.router.navigate(['/tasks'], {
      queryParams: {
        view: 'search',
        q: query || null,
        tab: tab === 'all' ? null : tab,
      },
    });
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

// --- Helper Functions ---
function normalizeTab(value: string | null): SearchTab {
  if (value === 'tasks' || value === 'projects' || value === 'labels') {
    return value;
  }
  return 'all';
}

// --- Prompts (Copied from InboxPageComponent) ---
const DAILY_CLARITY_PROMPTS = [
  'A single clear step often feels lighter than many vague ideas.',
  'When thoughts have a place to land, the mind becomes quieter.',
  'Small honest captures create space for what matters most.',
  'Clarity usually begins with writing it down, not figuring it out.',
  'A calm list is often more powerful than a perfect plan.',
  'The gentlest systems are the ones we actually return to.',
  'Progress feels easier when the next action is visible and simple.',
  'Some days, just naming the task is enough.',
  'A quiet inbox is a kind gift to your future self.',
  "The mind works better when it isn't carrying everything at once.",
  'One captured thought can soften the weight of the day.',
  'Simplicity in your system often creates room for creativity.',
  'Trust grows when your tasks feel honest and manageable.',
  'A focused day usually starts with a focused first step.',
  'Letting go of mental loops often begins with writing them down.',
  'The smallest clear action can create surprising momentum.',
  "Order doesn't have to be perfect to be helpful.",
  'A supportive list feels like help, not pressure.',
  'Clarity and calm tend to travel together.',
  'When everything has its place, the mind can rest.',
  'Gentle structure can feel like a deep breath.',
  'What gets captured today stops echoing tomorrow.',
  'A clear surface invites clearer thinking.',
  'The kindest productivity is usually the simplest.',
  'Sometimes the most productive thing is to start.',
  'Peaceful focus starts with a system you trust.',
  'A well-placed task is easier to return to.',
  'Less noise in the mind leaves more room for what matters.',
  'Every small capture is an act of self-kindness.',
  'The clearest days often begin with the clearest intentions.',
  'Done is often better than organized.',
  'One task at a time is still progress.',
  'The next step is usually smaller than it feels.',
  'A list that fits your day beats a list that judges it.',
  "You don't need to clear it all — just begin somewhere.",
];

const YOTARA_JOURNAL_PROMPTS = [
  '“Within you, there is a stillness and a sanctuary to which you can retreat at any time.” — Eckhart Tolle',
  '“A calm mind brings inner strength and self-confidence.” — Dalai Lama',
  '“Peace of mind comes when you stop trying to control everything.” — Eckhart Tolle',
  '“Your mind is for having ideas, not holding them.” — David Allen',
  '“Simplicity is the ultimate sophistication.” — Leonardo da Vinci',
  '“Focus and simplicity. Simple can be harder than complex.” — Steve Jobs',
  '“The clearer the vision, the fewer the options.” — Andy Stanley',
  '“Calmness is the cradle of power.” — Josiah Gilbert Holland',
  '“You must use your mind to get things off your mind.” — David Allen',
  '“A quiet mind is able to hear intuition over fear.” — Unknown',
  '“The present moment is the only time over which we have dominion.” — Thích Nhất Hạnh',
  '“Simplicity is the keynote of all true elegance.” — Coco Chanel',
  '“In the midst of movement and chaos, keep stillness inside of you.” — Deepak Chopra',
  '“The things you are passionate about are not random. They are your calling.” — Fabienne Fredrickson',
  '“Stillness is where creativity and solutions to problems are found.” — Eckhart Tolle',
  '“Less is more.” — Ludwig Mies van der Rohe',
  '“The soul usually knows what to do to heal itself. The challenge is to silence the mind.” — Caroline Myss',
  '“Order is the shape upon which beauty depends.” — Pearl S. Buck',
  '“To be calm is the highest achievement of the self.” — Zen Proverb',
  '“The unexamined life is not worth living.” — Socrates',
  '“He who is contented is rich.” — Lao Tzu',
  '“Silence is the language of God.” — Rumi',
  '“The quieter you become, the more you can hear.” — Ram Dass',
  '“Do not let the behavior of others destroy your inner peace.” — Dalai Lama',
  '“Everything you need is already inside you.” — Thích Nhất Hạnh',
  '“The greatest weapon against stress is our ability to choose one thought over another.” — William James',
  '“A cluttered mind is a cluttered life.” — Unknown',
  '“True simplicity is when the inner and outer are aligned.” — Eckhart Tolle',
  '“Let go of the need to control. Trust the process.” — Unknown',
];

function pickRandomPrompt(prompts: readonly string[]) {
  return prompts[Math.floor(Math.random() * prompts.length)] ?? '';
}
