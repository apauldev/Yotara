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
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faCalendarDays, faCalendarWeek } from '@fortawesome/free-solid-svg-icons';
import { DateTime } from 'luxon';
import type { CalendarEventDto, Task } from '@yotara/shared';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { LabelService } from '../../../../core/services/label.service';
import { PreferencesStore } from '../../../../core/services/preferences-store.service';
import { ProjectService } from '../../../../core/services/project.service';
import { StatusService } from '../../../../core/services/status.service';
import { TaskService, type CalendarRangeRequest } from '../../../../core/services/task.service';
import { CalendarService } from '../../../../core/services/calendar.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { startOfToday } from '../../../../shared/utils/timestamps';
import { projectPaletteFor } from '../../project-presentation';
import { CalendarDayViewComponent } from '../../components/calendar-day-view/calendar-day-view.component';
import { CalendarEventDetailComponent } from '../../components/calendar-event-detail/calendar-event-detail.component';
import { CalendarHeaderComponent } from '../../components/calendar-header/calendar-header.component';
import { CalendarMonthGridComponent } from '../../components/calendar-month-grid/calendar-month-grid.component';
import { CalendarWeekStripComponent } from '../../components/calendar-week-strip/calendar-week-strip.component';
import {
  CalendarNoDateListComponent,
  type CalendarScheduleRequest,
} from '../../components/calendar-no-date-list/calendar-no-date-list.component';
import { PersonalTaskWorkspaceComponent } from '../../components/personal-task-workspace.component';
import {
  buildMonthCells,
  buildEventsByDay,
  buildTasksByDay,
  buildUndatedTasks,
  buildWeekDays,
  dayKey,
  isCalendarTask,
  weekStart,
  type CalendarRescheduleRequest,
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
    CdkTrapFocus,
    FontAwesomeModule,
    PageHeaderComponent,
    CalendarHeaderComponent,
    CalendarMonthGridComponent,
    CalendarWeekStripComponent,
    CalendarDayViewComponent,
    CalendarEventDetailComponent,
    CalendarNoDateListComponent,
    PersonalTaskWorkspaceComponent,
  ],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class CalendarPageComponent {
  private readonly taskService = inject(TaskService);
  private readonly calendarService = inject(CalendarService);
  private readonly authState = inject(AuthStateService);
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
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faCalendarWeek = faCalendarWeek;
  /** On mobile, whether the dense month grid replaces the week strip. */
  protected readonly mobileMonthView = signal(false);
  protected readonly selectedEvent = signal<CalendarEventDto | null>(null);

  private readonly today = startOfToday();
  protected readonly todayKey = dayKey(this.today);

  protected readonly viewMonth = signal<DateTime>(this.today.startOf('month'));
  protected readonly selectedDate = signal<DateTime>(this.today);
  protected readonly showNoDate = signal(false);
  protected readonly mobileDayOpen = signal(false);
  protected readonly mobilePanelOpen = computed(() => this.mobileDayOpen() || this.showNoDate());
  /** Optimistic completion state per task while the save is in flight. */
  protected readonly completionOverrides = signal<ReadonlyMap<string, boolean>>(new Map());
  private readonly pendingCompletionIds = signal<ReadonlySet<string>>(new Set());
  /** Task ids that read as scheduled while the save is in flight. */
  private readonly schedulingIds = signal<ReadonlySet<string>>(new Set<string>());
  /** Optimistic due-date overrides while a reschedule save is in flight. */
  private readonly dueDateOverrides = signal<ReadonlyMap<string, string>>(new Map());
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

  /**
   * The window the grid draws (a fixed six weeks) plus the week around the
   * open day. They are fetched separately so browsing far-away months never
   * widens the request; the open day's week keeps the day panel and the
   * mobile week strip populated wherever the selection is left behind.
   */
  private readonly visibleRange = computed<CalendarRangeRequest>(() => {
    const monthStart = this.viewMonth().startOf('month');
    const gridStart = monthStart.minus({ days: monthStart.weekday % 7 });
    const focusStart = weekStart(this.selectedDate());

    return {
      grid: {
        from: dayKey(gridStart),
        to: dayKey(gridStart.plus({ days: 41 })),
      },
      focus: {
        from: dayKey(focusStart),
        to: dayKey(focusStart.plus({ days: 6 })),
      },
    };
  });

  private readonly eventRange = computed(() => {
    const range = this.visibleRange();
    return {
      from: range.grid.from < range.focus.from ? range.grid.from : range.focus.from,
      to: range.grid.to > range.focus.to ? range.grid.to : range.focus.to,
    };
  });
  private readonly eventRangeKey = computed(() => {
    const range = this.eventRange();
    return JSON.stringify([this.authState.currentUserId(), range.from, range.to]);
  });
  private readonly loadedEventRangeKey = signal<string | null>(null);

  private readonly calendarTasks = computed(() => {
    const tasks = this.taskService
      .calendarRangeTasks()
      .filter((task) => this.showDone() || !task.completed);
    const overrides = this.dueDateOverrides();
    if (overrides.size === 0) {
      return tasks;
    }

    return tasks.map((task) => {
      const nextDate = overrides.get(task.id);
      return nextDate ? { ...task, dueDate: nextDate } : task;
    });
  });

  private readonly tasksByDay = computed(() => buildTasksByDay(this.calendarTasks()));
  private readonly eventsByDay = computed(() => buildEventsByDay(this.calendarService.events()));
  protected readonly undatedTasks = computed(() =>
    buildUndatedTasks(this.taskService.undatedTasks()).filter(
      (task) => !this.schedulingIds().has(task.id),
    ),
  );

  protected readonly cells = computed(() =>
    buildMonthCells(this.viewMonth(), this.tasksByDay(), this.today, this.eventsByDay()),
  );
  protected readonly selectedDayTasks = computed(
    () => this.tasksByDay().get(this.selectedKey()) ?? [],
  );
  protected readonly selectedDayEvents = computed(
    () => this.eventsByDay().get(this.selectedKey()) ?? [],
  );
  protected readonly weekDays = computed(() =>
    buildWeekDays(this.selectedDate(), this.tasksByDay(), this.today, this.eventsByDay()),
  );

  /**
   * The No date badge is visible before the drawer is ever opened. Until the
   * full undated list loads, derive its count from all active tasks, which the
   * app already fetches for subtasks/labels/search — no extra request needed.
   */
  private readonly estimatedNoDateCount = computed(
    () =>
      this.taskService.allActiveTasks().filter((task) => isCalendarTask(task) && !task.dueDate)
        .length,
  );
  protected readonly noDateCount = computed(() =>
    this.undatedLoaded() ? this.undatedTasks().length : this.estimatedNoDateCount(),
  );
  protected readonly undatedLoading = computed(() => this.taskService.undatedLoading());
  protected readonly undatedLoaded = computed(() => this.taskService.undatedLoaded());
  protected readonly monthHasTasks = computed(() =>
    this.cells().some((cell) => cell.inMonth && cell.tasks.length > 0),
  );
  protected readonly monthHasEvents = computed(() =>
    this.cells().some((cell) => cell.inMonth && cell.events.length > 0),
  );
  protected readonly showInitialLoading = computed(
    () => this.taskService.calendarRangeLoading() && !this.taskService.calendarRangeLoaded(),
  );
  protected readonly calendarDataReady = computed(
    () =>
      this.taskService.calendarRangeReady() && this.loadedEventRangeKey() === this.eventRangeKey(),
  );
  /** True when a calendar list holds more tasks than the API returns in a page. */
  protected readonly limitExceeded = computed(
    () => this.taskService.calendarRangeTruncated() || this.taskService.undatedTruncated(),
  );

  constructor() {
    effect(() => {
      this.taskService.setCalendarRange(this.visibleRange());
    });

    effect(() => {
      const range = this.eventRange();
      const rangeKey = this.eventRangeKey();
      if (!this.authState.currentUserId()) {
        this.loadedEventRangeKey.set(null);
        return;
      }
      void this.calendarService
        .loadEvents(range.from, range.to)
        .catch(() => {
          this.statusService.error('Could not load calendar events right now.');
        })
        .finally(() => {
          // A failed event fetch must not leave the empty-state message hidden
          // forever; the range is settled either way. Stale ranges are ignored.
          if (this.eventRangeKey() === rangeKey) {
            this.loadedEventRangeKey.set(rangeKey);
          }
        });
    });

    effect(() => {
      const activeById = new Map(
        this.taskService
          .calendarRangeTasks()
          .filter((task) => this.showDone() || !task.completed)
          .map((task) => [task.id, task]),
      );

      this.completionOverrides.update((overrides) => {
        let changed = false;
        const next = new Map(overrides);
        for (const [id, expected] of overrides) {
          const active = activeById.get(id);
          // Completing drops the task from the list when done tasks are hidden;
          // with Show done on it stays in the list. Either way the server has
          // caught up once the task carries the expected state (or is gone for
          // a completion), so the override is safe to drop.
          const caughtUp = active ? active.completed === expected : expected;
          if (caughtUp) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : overrides;
      });

      const undatedIds = new Set(this.taskService.undatedTasks().map((task) => task.id));
      this.schedulingIds.update((ids) => pruneIds(ids, undatedIds));

      this.dueDateOverrides.update((overrides) => {
        let changed = false;
        const next = new Map(overrides);
        for (const [id, date] of overrides) {
          const task = activeById.get(id);
          if (!task || task.dueDate?.slice(0, 10) === date) {
            next.delete(id);
            changed = true;
          }
        }
        return changed ? next : overrides;
      });
    });

    const query = this.mobileQuery;
    if (query) {
      const onChange = (event: MediaQueryListEvent) => this.isMobile.set(event.matches);
      query.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
    }
  }

  protected previousMonth(): void {
    if (this.isMobile() && !this.mobileMonthView()) {
      this.shiftWeek(-7);
      return;
    }
    this.viewMonth.update((month) => month.minus({ months: 1 }));
  }

  protected nextMonth(): void {
    if (this.isMobile() && !this.mobileMonthView()) {
      this.shiftWeek(7);
      return;
    }
    this.viewMonth.update((month) => month.plus({ months: 1 }));
  }

  private shiftWeek(days: number): void {
    const next = this.selectedDate().plus({ days });
    this.selectedDate.set(next);
    this.viewMonth.set(next.startOf('month'));
    this.mobileDayOpen.set(false);
  }

  protected toggleMobileMonth(): void {
    this.mobileMonthView.update((shown) => !shown);
  }

  protected selectDate(date: DateTime): void {
    this.selectedDate.set(date);
    this.showNoDate.set(false);
    this.mobileDayOpen.set(true);

    // Clicking a leading/trailing day brings its month into view.
    if (date.month !== this.viewMonth().month || date.year !== this.viewMonth().year) {
      this.viewMonth.set(date.startOf('month'));
    }
  }

  protected closeMobilePanel(): void {
    this.mobileDayOpen.set(false);
    this.showNoDate.set(false);
  }

  protected openEvent(event: CalendarEventDto): void {
    this.selectedEvent.set(event);
  }

  protected toggleNoDate(): void {
    const opening = !this.showNoDate();
    this.showNoDate.set(opening);
    if (opening) {
      this.taskService.loadUndatedTasks();
    }
  }

  protected retryUndatedTasks(): void {
    this.taskService.loadUndatedTasks();
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

  /** A day cell's "+" or double-click creates a task on that date. */
  protected createTaskForDate(date: DateTime): void {
    this.openCreateFor(dayKey(date));
  }

  /** Toggle completion without opening the modal; revert visibly on failure. */
  protected async completeTask(task: Task): Promise<void> {
    if (this.pendingCompletionIds().has(task.id)) {
      return;
    }

    const nextCompleted = !(this.completionOverrides().get(task.id) ?? task.completed);
    this.pendingCompletionIds.update((ids) => new Set(ids).add(task.id));
    this.completionOverrides.update((overrides) => new Map(overrides).set(task.id, nextCompleted));

    try {
      await this.taskService.updateTask(task.id, { completed: nextCompleted });
      if (nextCompleted) {
        notifyTaskCompleted(this.statusService, this.preferences);
      }
    } catch {
      this.completionOverrides.update((overrides) => {
        if (overrides.get(task.id) !== nextCompleted) {
          return overrides;
        }
        const next = new Map(overrides);
        next.delete(task.id);
        return next;
      });
      this.statusService.error(
        nextCompleted
          ? 'Could not complete the task. Please try again.'
          : 'Could not reopen the task. Please try again.',
      );
    } finally {
      this.pendingCompletionIds.update((ids) => {
        const next = new Set(ids);
        next.delete(task.id);
        return next;
      });
    }
  }

  /** Give an undated task a date without touching its due time. */
  protected async scheduleTask({ task, date }: CalendarScheduleRequest): Promise<void> {
    if (!date || this.schedulingIds().has(task.id)) {
      return;
    }

    this.schedulingIds.update((ids) => new Set(ids).add(task.id));

    try {
      const updated = await this.taskService.updateTask(task.id, { dueDate: date });
      // A 200 that did not store the date would otherwise leave the task hidden
      // from the No date list with nothing on the calendar until a reload.
      if (updated?.dueDate?.slice(0, 10) !== date) {
        this.stopScheduling(task.id);
        this.statusService.error('Could not schedule the task. Please try again.');
      }
    } catch {
      this.stopScheduling(task.id);
      this.statusService.error('Could not schedule the task. Please try again.');
    }
  }

  private stopScheduling(id: string): void {
    this.schedulingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  protected async moveTask({ task, date }: CalendarRescheduleRequest): Promise<void> {
    if (!date || task.dueDate?.slice(0, 10) === date) {
      return;
    }

    this.dueDateOverrides.update((overrides) => new Map(overrides).set(task.id, date));

    try {
      await this.taskService.updateTask(task.id, { dueDate: date });
    } catch {
      this.dueDateOverrides.update((overrides) => {
        const next = new Map(overrides);
        next.delete(task.id);
        return next;
      });
      this.statusService.error('Could not move the task. Please try again.');
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
