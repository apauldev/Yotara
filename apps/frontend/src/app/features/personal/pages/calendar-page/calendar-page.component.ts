import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { DateTime } from 'luxon';
import type { Task } from '@yotara/shared';
import { LabelService } from '../../../../core/services/label.service';
import { PreferencesStore } from '../../../../core/services/preferences-store.service';
import { ProjectService } from '../../../../core/services/project.service';
import { StatusService } from '../../../../core/services/status.service';
import { TaskService } from '../../../../core/services/task.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { startOfToday } from '../../../../shared/utils/timestamps';
import { projectPaletteFor } from '../../project-presentation';
import { CalendarDayPanelComponent } from '../../components/calendar-day-panel/calendar-day-panel.component';
import { CalendarHeaderComponent } from '../../components/calendar-header/calendar-header.component';
import { CalendarMonthGridComponent } from '../../components/calendar-month-grid/calendar-month-grid.component';
import {
  CalendarNoDateListComponent,
  type CalendarScheduleRequest,
} from '../../components/calendar-no-date-list/calendar-no-date-list.component';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import {
  buildMonthCells,
  buildTasksByDay,
  buildUndatedTasks,
  dayKey,
} from '../../utils/calendar-view';
import type { DueDateDraft } from '../../utils/due-date-draft';
import { notifyTaskCompleted } from '../../utils/task-completion-notice';

/** Drop optimistic ids once the refreshed data no longer contains them. */
function pruneIds(ids: ReadonlySet<string>, allowed: ReadonlySet<string>): ReadonlySet<string> {
  const next = new Set([...ids].filter((id) => allowed.has(id)));
  return next.size === ids.size ? ids : next;
}

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    FontAwesomeModule,
    PageHeaderComponent,
    CalendarHeaderComponent,
    CalendarMonthGridComponent,
    CalendarDayPanelComponent,
    CalendarNoDateListComponent,
    PersonalTaskWorkspaceComponent,
  ],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CalendarPageComponent {
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly labelService = inject(LabelService);
  private readonly statusService = inject(StatusService);
  private readonly preferences = inject(PreferencesStore);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);

  private readonly mobileQuery =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(max-width: 720px)')
      : null;
  protected readonly isMobile = signal(this.mobileQuery?.matches ?? false);
  protected readonly faArrowLeft = faArrowLeft;

  private readonly today = startOfToday();
  protected readonly todayKey = dayKey(this.today);

  protected readonly viewMonth = signal<DateTime>(this.today.startOf('month'));
  protected readonly selectedDate = signal<DateTime>(this.today);
  protected readonly showNoDate = signal(false);
  protected readonly mobileDayOpen = signal(false);
  protected readonly mobilePanelOpen = computed(() => this.mobileDayOpen() || this.showNoDate());
  /** Task ids that read as completed while the save is in flight. */
  protected readonly completionIds = signal<ReadonlySet<string>>(new Set<string>());
  /** Task ids that read as scheduled while the save is in flight. */
  private readonly schedulingIds = signal<ReadonlySet<string>>(new Set<string>());
  /** Whether completed tasks are shown on the calendar (persisted preference). */
  protected readonly showDone = this.preferences.showDoneCalendar;
  /** Whether compact metadata is shown on calendar chips (persisted preference). */
  protected readonly showMetadata = this.preferences.showMetadataCalendar;

  protected readonly monthLabel = computed(() => this.viewMonth().toFormat('LLLL yyyy'));
  protected readonly selectedDateLabel = computed(() =>
    this.selectedDate().toFormat('cccc, LLLL d, yyyy'),
  );
  protected readonly selectedKey = computed(() => dayKey(this.selectedDate()));

  protected readonly projectAccents = computed(() => {
    const accents = new Map<string, string>();
    for (const project of this.projectService.projects()) {
      accents.set(project.id, projectPaletteFor(project.color).accent);
    }
    return accents;
  });

  protected readonly projectNames = computed(() => {
    const names = new Map<string, string>();
    for (const project of this.projectService.projects()) {
      names.set(project.id, project.name);
    }
    return names;
  });

  protected readonly labelNames = computed(() => {
    const names = new Map<string, string>();
    for (const label of this.labelService.labels()) {
      names.set(label.id, label.name);
    }
    return names;
  });

  private readonly tasksByDay = computed(() =>
    buildTasksByDay([
      ...this.taskService.allActiveTasks(),
      ...(this.showDone() ? this.taskService.completedTasks() : []),
    ]),
  );
  protected readonly undatedTasks = computed(() =>
    buildUndatedTasks(this.taskService.undatedTasks()).filter(
      (task) => !this.schedulingIds().has(task.id),
    ),
  );

  protected readonly cells = computed(() =>
    buildMonthCells(this.viewMonth(), this.tasksByDay(), this.today),
  );
  protected readonly selectedDayTasks = computed(
    () => this.tasksByDay().get(this.selectedKey()) ?? [],
  );

  protected readonly noDateCount = computed(() => this.undatedTasks().length);
  protected readonly monthHasTasks = computed(() =>
    this.cells().some((cell) => cell.inMonth && cell.tasks.length > 0),
  );
  protected readonly showInitialLoading = computed(
    () => this.taskService.loading() && this.taskService.allActiveTasks().length === 0,
  );

  constructor() {
    effect(() => {
      const activeIds = new Set(this.taskService.allActiveTasks().map((task) => task.id));
      this.completionIds.update((ids) => pruneIds(ids, activeIds));

      const undatedIds = new Set(this.taskService.undatedTasks().map((task) => task.id));
      this.schedulingIds.update((ids) => pruneIds(ids, undatedIds));
    });

    const query = this.mobileQuery;
    if (query) {
      const onChange = (event: MediaQueryListEvent) => this.isMobile.set(event.matches);
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
    }
  }

  protected previousMonth(): void {
    this.viewMonth.update((month) => month.minus({ months: 1 }));
  }

  protected nextMonth(): void {
    this.viewMonth.update((month) => month.plus({ months: 1 }));
  }

  protected selectDate(date: DateTime): void {
    this.selectedDate.set(date);
    this.showNoDate.set(false);
    this.mobileDayOpen.set(true);
  }

  protected closeMobilePanel(): void {
    this.mobileDayOpen.set(false);
    this.showNoDate.set(false);
  }

  protected toggleNoDate(): void {
    this.showNoDate.update((value) => !value);
  }

  protected toggleShowDone(): void {
    this.preferences.setShowDoneCalendar(!this.showDone());
  }

  protected toggleShowMetadata(): void {
    this.preferences.setShowMetadataCalendar(!this.showMetadata());
  }

  protected openTask(task: Task): void {
    this.workspace()?.editTask(task);
  }

  /** The header's New task button pre-fills the selected day. */
  protected newTask(): void {
    this.openCreateFor(this.selectedKey());
  }

  /** The selected-day panel's Add task for this date pre-fills the selected day. */
  protected addTaskForDate(): void {
    this.openCreateFor(this.selectedKey());
  }

  /** Complete without opening the modal; revert visibly when the save fails. */
  protected async completeTask(task: Task): Promise<void> {
    if (this.completionIds().has(task.id)) {
      return;
    }

    this.completionIds.update((ids) => new Set(ids).add(task.id));

    try {
      await this.taskService.updateTask(task.id, { completed: true });
      notifyTaskCompleted(this.statusService, this.preferences);
    } catch {
      this.completionIds.update((ids) => {
        const next = new Set(ids);
        next.delete(task.id);
        return next;
      });
      this.statusService.error('Could not complete the task. Please try again.');
    }
  }

  /** Give an undated task a date without touching its due time. */
  protected async scheduleTask({ task, date }: CalendarScheduleRequest): Promise<void> {
    if (!date || this.schedulingIds().has(task.id)) {
      return;
    }

    this.schedulingIds.update((ids) => new Set(ids).add(task.id));

    try {
      await this.taskService.updateTask(task.id, { dueDate: date });
    } catch {
      this.schedulingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(task.id);
        return next;
      });
      this.statusService.error('Could not schedule the task. Please try again.');
    }
  }

  private openCreateFor(date: string): void {
    this.workspace()?.openCreateTaskModal(undefined, this.dateDraftFor(date));
  }

  private dateDraftFor(date: string): DueDateDraft {
    return {
      value: date,
      dueTime: null,
      source: 'manual',
      matchedText: null,
      matchStart: null,
      matchEnd: null,
    };
  }
}
