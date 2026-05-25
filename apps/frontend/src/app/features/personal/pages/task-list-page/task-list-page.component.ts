import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild, OnInit, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { PersonalTaskCardComponent } from '../../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import { SectionHeaderComponent } from '../../../../shared/components/section-header/section-header.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faXmark, faSun, faCalendarDay, faCloud } from '@fortawesome/free-solid-svg-icons';
import { ElementRef } from '@angular/core';
import { parseTaskCommand } from '../../utils/task-command-parser';
import { parseCalendarDate } from '../../../../shared/utils/timestamps';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

export type TaskListViewMode = 'inbox' | 'today' | 'upcoming';
export type TaskSortOption = 'date' | 'alpha';
export type InsightType = 'clarity' | 'journal';

@Component({
  selector: 'app-task-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    SectionHeaderComponent,
    PageHeaderComponent,
    PaginationComponent,
    FontAwesomeModule,
    EmptyStateComponent,
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
  protected readonly faXmark = faXmark;
  protected readonly faSun = faSun;
  protected readonly faCalendarDay = faCalendarDay;
  protected readonly faCloud = faCloud;

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
  protected readonly captureTitle = signal('');
  protected readonly captureProjectId = signal('');
  protected readonly captureError = signal('');

  protected readonly subtasksByParent = computed(() => {
    const all = this.taskService.tasks();
    const map = new Map<string, Task[]>();
    for (const task of all) {
      if (task.parentId) {
        const list = map.get(task.parentId) ?? [];
        list.push(task);
        map.set(task.parentId, list);
      }
    }
    return map;
  });

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
      default:
        return 0;
    }
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalTasksCount() / this.pageSize())),
  );

  protected sortAndPaginate<T>(
    items: T[],
    getTask: (item: T) => Task = (i: unknown) => i as Task,
  ): T[] {
    const sorted = [...items].sort((a, b) => {
      const taskA = getTask(a);
      const taskB = getTask(b);

      if (this.sortOption() === 'alpha') {
        return taskA.title.localeCompare(taskB.title);
      }

      // Default: date (newest created for inbox, or by dueDate)
      const dateA =
        parseCalendarDate(taskA.dueDate)?.toMillis() ?? new Date(taskA.createdAt).getTime();
      const dateB =
        parseCalendarDate(taskB.dueDate)?.toMillis() ?? new Date(taskB.createdAt).getTime();
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

  constructor() {
    effect(() => {
      this.viewMode();
      this.sortOption();
      this.pageSize();
      this.totalTasksCount();
      this.currentPage.set(1);
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
  "You don't need to clear it all - just begin somewhere.",
];

const YOTARA_JOURNAL_PROMPTS = [
  '\u201CWithin you, there is a stillness and a sanctuary to which you can retreat at any time.\u201D \u2014 Eckhart Tolle',
  '\u201CA calm mind brings inner strength and self-confidence.\u201D \u2014 Dalai Lama',
  '\u201CPeace of mind comes when you stop trying to control everything.\u201D \u2014 Eckhart Tolle',
  '\u201CYour mind is for having ideas, not holding them.\u201D \u2014 David Allen',
  '\u201CSimplicity is the ultimate sophistication.\u201D \u2014 Leonardo da Vinci',
  '\u201CFocus and simplicity. Simple can be harder than complex.\u201D \u2014 Steve Jobs',
  '\u201CThe clearer the vision, the fewer the options.\u201D \u2014 Andy Stanley',
  '\u201CCalmness is the cradle of power.\u201D \u2014 Josiah Gilbert Holland',
  '\u201CYou must use your mind to get things off your mind.\u201D \u2014 David Allen',
  '\u201CA quiet mind is able to hear intuition over fear.\u201D \u2014 Unknown',
  '\u201CThe present moment is the only time over which we have dominion.\u201D \u2014 Th\u00EDch Nh\u1EA5t H\u1EA1nh',
  '\u201CSimplicity is the keynote of all true elegance.\u201D \u2014 Coco Chanel',
  '\u201CIn the midst of movement and chaos, keep stillness inside of you.\u201D \u2014 Deepak Chopra',
  '\u201CThe things you are passionate about are not random. They are your calling.\u201D \u2014 Fabienne Fredrickson',
  '\u201CStillness is where creativity and solutions to problems are found.\u201D \u2014 Eckhart Tolle',
  '\u201CLess is more.\u201D \u2014 Ludwig Mies van der Rohe',
  '\u201CThe soul usually knows what to do to heal itself. The challenge is to silence the mind.\u201D \u2014 Caroline Myss',
  '\u201COrder is the shape upon which beauty depends.\u201D \u2014 Pearl S. Buck',
  '\u201CTo be calm is the highest achievement of the self.\u201D \u2014 Zen Proverb',
  '\u201CThe unexamined life is not worth living.\u201D \u2014 Socrates',
  '\u201CHe who is contented is rich.\u201D \u2014 Lao Tzu',
  '\u201CSilence is the language of God.\u201D \u2014 Rumi',
  '\u201CThe quieter you become, the more you can hear.\u201D \u2014 Ram Dass',
  '\u201CDo not let the behavior of others destroy your inner peace.\u201D \u2014 Dalai Lama',
  '\u201CEverything you need is already inside you.\u201D \u2014 Th\u00EDch Nh\u1EA5t H\u1EA1nh',
  '\u201CThe greatest weapon against stress is our ability to choose one thought over another.\u201D \u2014 William James',
  '\u201CA cluttered mind is a cluttered life.\u201D \u2014 Unknown',
  '\u201CTrue simplicity is when the inner and outer are aligned.\u201D \u2014 Eckhart Tolle',
  '\u201CLet go of the need to control. Trust the process.\u201D \u2014 Unknown',
];

function pickRandomPrompt(prompts: readonly string[]) {
  return prompts[Math.floor(Math.random() * prompts.length)] ?? '';
}
