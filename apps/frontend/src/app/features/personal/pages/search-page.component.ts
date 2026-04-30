import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Project, Task } from '@yotara/shared';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { SearchService, SearchTab } from '../../../core/services/search.service';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    SectionHeaderComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
  ],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.scss',
})
export class SearchPageComponent {
  protected readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
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
  protected readonly taskResults = computed(() =>
    this.activeTab() === 'all' ? this.results().tasks.slice(0, 5) : this.results().tasks,
  );
  protected readonly projectResults = computed(() =>
    this.activeTab() === 'all' ? this.results().projects.slice(0, 3) : this.results().projects,
  );
  protected readonly resultCount = computed(
    () => this.results().tasks.length + this.results().projects.length,
  );
  protected readonly tabItems: { value: SearchTab; label: string; count?: () => number }[] = [
    { value: 'all', label: 'All' },
    { value: 'tasks', label: 'Tasks', count: () => this.results().tasks.length },
    { value: 'projects', label: 'Projects', count: () => this.results().projects.length },
    { value: 'labels', label: 'Labels', count: () => 0 },
  ];

  constructor() {
    effect(() => {
      this.draftQuery.set(this.queryParamMap().q);
    });
  }

  protected subtitle() {
    const query = this.queryParamMap().q;

    if (!query) {
      return 'Search tasks and projects from the sanctuary.';
    }

    return `Results for “${query}”.`;
  }

  protected async submitSearch() {
    await this.navigateToQuery(this.draftQuery().trim(), this.activeTab());
  }

  protected async chooseTab(tab: SearchTab) {
    await this.navigateToQuery(this.draftQuery().trim(), tab);
  }

  protected openTask(task: Task) {
    this.workspace()?.editTask(task);
  }

  protected projectLabel(project: Project) {
    if (project.openTaskCount === 1) {
      return '1 open task';
    }

    return `${project.openTaskCount} open tasks`;
  }

  protected labelSearchCopy() {
    return 'Label search is ready in the interface, but label storage is not persisted yet.';
  }

  private async navigateToQuery(query: string, tab: SearchTab) {
    await this.router.navigate(['/search'], {
      queryParams: {
        q: query || null,
        tab: tab === 'all' ? null : tab,
      },
    });
  }
}

function normalizeTab(value: string | null): SearchTab {
  if (value === 'tasks' || value === 'projects' || value === 'labels') {
    return value;
  }

  return 'all';
}
