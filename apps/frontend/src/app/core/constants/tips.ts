export interface Tip {
  readonly id: string;
  readonly text: string;
}

/**
 * Login-tip catalogue shown by the personal shell; the startup wizard curates
 * three of these via `WIZARD_TIPS` below. Every entry must describe a shipped
 * feature — do not add tips for unshipped surfaces (`?` shortcut sheet,
 * batch actions, drag-to-reorder in lists).
 */
export const TIPS: readonly Tip[] = [
  {
    id: 'capture-label',
    text: 'Press `#` in the task input to quickly add labels to any task.',
  },
  {
    id: 'capture-project',
    text: 'Type `@` followed by a project name in the task input to file the task directly into that project.',
  },
  {
    id: 'capture-priority',
    text: 'Prepend `!high`, `!med`, or `!low` in the task input to set the task’s priority inline.',
  },
  {
    id: 'capture-date',
    text: 'Type dates in plain language — “tomorrow” or “next Friday” — and check the preview before you save.',
  },
  {
    id: 'projects-group',
    text: 'Use projects to group related tasks together into meaningful collections.',
  },
  {
    id: 'today-focus',
    text: 'Mark tasks as "Today" to focus on what matters right now.',
  },
  {
    id: 'auto-clear',
    text: 'Completed tasks auto-clear after 30 days — use “Keep forever” to save one from auto-clearing.',
  },
  {
    id: 'recurrence',
    text: 'Recurring tasks repeat daily, on weekdays, weekly, monthly, or yearly — no need to recreate them.',
  },
  {
    id: 'search',
    text: 'Search tasks, projects, and labels from the top bar.',
  },
  {
    id: 'subtasks',
    text: 'Break big tasks into smaller subtasks to make progress feel achievable.',
  },
  {
    id: 'self-host',
    text: 'Self-host Yotara to keep your tasks in your own database.',
  },
  {
    id: 'labels-categorize',
    text: 'Labels help you categorize tasks across different projects and views.',
  },
  {
    id: 'labels-icon',
    text: 'Give labels their own icon and color, and pin the ones you use most so they stay at the top.',
  },
  {
    id: 'inbox-capture',
    text: 'Use the Inbox to capture ideas quickly before organizing them into projects.',
  },
  {
    id: 'inbox-unfiled',
    text: 'Inbox is for unfiled tasks — adding a project or a due date moves a task out.',
  },
  {
    id: 'today-view',
    text: 'The Today view shows everything due or marked for today in one place.',
  },
  {
    id: 'upcoming-view',
    text: 'The Upcoming view helps you plan your week and spot busy days ahead.',
  },
  {
    id: 'completed-view',
    text: 'Clear completed tasks from the Completed view to keep the workspace focused on what is active.',
  },
  {
    id: 'quick-add',
    text: 'Press Enter to quickly add a task from the capture bar without touching your mouse.',
  },
  {
    id: 'overdue',
    text: 'Overdue tasks are highlighted so nothing slips through the cracks.',
  },
  {
    id: 'schedule',
    text: 'Schedule tasks for specific dates to plan your work ahead of time.',
  },
  {
    id: 'calendar-drag',
    text: 'On desktop, drag a task to another day in Calendar to reschedule it, or double-click a day to create one.',
  },
  {
    id: 'due-time',
    text: 'Add a due time to a task and Yotara will remind you when it comes due while the app is open.',
  },
  {
    id: 'collapse-sidebar',
    text: 'The sidebar collapses to give you a distraction-free writing and planning area.',
  },
  {
    id: 'reflect',
    text: 'Review your completed tasks to reflect on progress and celebrate wins.',
  },
  {
    id: 'project-colors',
    text: 'Projects support custom colors to make them easy to spot at a glance.',
  },
  {
    id: 'themes',
    text: 'The app adapts to nine themes so you can match your mood or environment.',
  },
  {
    id: 'due-dates',
    text: 'Add due dates to surface tasks in Today and Upcoming.',
  },
  {
    id: 'browser-local',
    text: 'Your theme and display preferences are saved in this browser.',
  },
];

const WIZARD_TIP_IDS = ['capture-label', 'today-view', 'calendar-drag'] as const;

/**
 * Curated three-tip subset for the startup wizard. Derived from `TIPS` by id
 * so the tip text has a single source of truth; the wizard supplies its own
 * title/example copy per id.
 */
export const WIZARD_TIPS: readonly Tip[] = WIZARD_TIP_IDS.flatMap((id) => {
  const tip = TIPS.find((entry) => entry.id === id);
  return tip ? [tip] : [];
});
