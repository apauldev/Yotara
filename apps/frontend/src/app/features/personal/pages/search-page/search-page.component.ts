import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Project, Task } from '@yotara/shared';
import { ProjectService } from '../../../../core/services/project.service';
import { TaskService } from '../../../../core/services/task.service';
import { LogService } from '../../../../core/services/log.service';
import {
  SearchService,
  SearchTab,
  SearchTaskResult,
} from '../../../../core/services/search.service';
import { PersonalTaskCardComponent } from '../../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import { SectionHeaderComponent } from '../../../../shared/components/section-header/section-header.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { HighlightPipe } from '../../../../shared/pipes/highlight.pipe';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

export type TaskSortOption = 'date' | 'alpha';

@Component({
  selector: 'app-search-page',
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
    EmptyStateComponent,
    HighlightPipe,
    FontAwesomeModule,
  ],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.scss',
})
export class SearchPageComponent {
  protected readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly searchService = inject(SearchService);
  private readonly logService = inject(LogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly faPlus = faPlus;
  protected readonly faMagnifyingGlass = faMagnifyingGlass;

  protected readonly sortOption = signal<TaskSortOption>('date');
  protected readonly pageSize = signal<10 | 25>(10);
  protected readonly currentPage = signal(1);

  protected readonly subtasksByParent = computed(() => {
    const all = this.taskService.allActiveTasks();
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

  protected readonly searchingArchive = signal(false);
  protected readonly archiveResults = signal<SearchTaskResult[]>([]);
  protected readonly totalArchiveMatches = signal(0);
  protected readonly archiveTruncated = signal(false);
  protected readonly archiveSearched = signal(false);

  protected readonly tabItems: { value: SearchTab; label: string; count?: () => number }[] = [
    { value: 'all', label: 'All' },
    { value: 'tasks', label: 'Tasks', count: () => this.results().tasks.length },
    { value: 'projects', label: 'Projects', count: () => this.results().projects.length },
    { value: 'labels', label: 'Labels', count: () => this.results().labels.length },
  ];

  protected readonly pageTitle = 'Search';

  protected readonly pageSubtitle = computed(() => {
    const query = this.queryParamMap().q;
    if (!query) {
      return 'Search tasks and projects from the sanctuary.';
    }
    return `Results for \u201C${query}\u201D.`;
  });

  protected readonly totalTasksCount = computed(() => this.results().tasks.length);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalTasksCount() / this.pageSize())),
  );

  constructor() {
    effect(() => {
      this.draftQuery.set(this.queryParamMap().q);
    });

    effect(() => {
      this.sortOption();
      this.pageSize();
      this.totalTasksCount();
      this.currentPage.set(1);
    });
  }

  private sortAndPaginate<T>(
    items: T[],
    getTask: (item: T) => Task = (i: unknown) => i as Task,
  ): T[] {
    const sorted = [...items].sort((a, b) => {
      const taskA = getTask(a);
      const taskB = getTask(b);

      if (this.sortOption() === 'alpha') {
        return taskA.title.localeCompare(taskB.title);
      }

      const dateA = new Date(taskA.updatedAt).getTime();
      const dateB = new Date(taskB.updatedAt).getTime();
      return dateB - dateA;
    });

    const start = (this.currentPage() - 1) * this.pageSize();
    return sorted.slice(start, start + this.pageSize());
  }

  protected projectLabel(project: Project) {
    if (project.openTaskCount === 1) {
      return '1 open task';
    }
    return `${project.openTaskCount} open tasks`;
  }

  protected async submitSearch() {
    await this.navigateToSearchQuery(this.draftQuery().trim(), this.activeTab());
  }

  protected async chooseSearchTab(tab: SearchTab) {
    await this.navigateToSearchQuery(this.draftQuery().trim(), tab);
  }

  private async navigateToSearchQuery(query: string, tab: SearchTab) {
    this.archiveResults.set([]);
    this.totalArchiveMatches.set(0);
    this.archiveTruncated.set(false);
    this.archiveSearched.set(false);
    await this.router.navigate(['/search'], {
      queryParams: {
        q: query || null,
        tab: tab === 'all' ? null : tab,
      },
      replaceUrl: true,
    });
  }

  protected openCreateTaskModal() {
    this.workspace()?.openCreateTaskModal();
  }

  protected editTask(task: Task) {
    this.workspace()?.editTask(task);
  }

  protected async searchArchive() {
    if (this.searchingArchive() || !this.searchQuery()) return;

    this.searchingArchive.set(true);
    try {
      const results = await this.searchService.searchArchive(this.searchQuery());
      this.archiveResults.set(results.tasks);
      this.totalArchiveMatches.set(results.total);
      this.archiveTruncated.set(results.truncated ?? false);
      this.archiveSearched.set(true);
    } catch (error) {
      this.logService.error('Failed to search archive', error, 'SearchPage');
    } finally {
      this.searchingArchive.set(false);
    }
  }

  protected handleTaskSaved(_mode: 'create' | 'update') {}
}

function normalizeTab(value: string | null): SearchTab {
  if (value === 'tasks' || value === 'projects' || value === 'labels') {
    return value;
  }
  return 'all';
}
