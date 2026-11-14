import type { LabelIcon } from './label-icons.js';

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'inbox' | 'today' | 'upcoming' | 'done' | 'archived';
export type WorkspaceMode = 'personal' | 'team';

export const PROJECT_COLORS = ['sage', 'teal', 'olive', 'clay', 'forest', 'deep-ocean'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export function isProjectColor(value: unknown): value is ProjectColor {
  return typeof value === 'string' && (PROJECT_COLORS as readonly string[]).includes(value);
}

export type RecurrenceFrequency = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: string; // ISO date — repeat stops after this date
  daysOfWeek?: number[]; // 0=Sun, 1=Mon...6=Sat. For weekly with specific days or weekdays frequency
}

// ─── Core Domain Types ───────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  workspaceMode?: WorkspaceMode;
  onboardingCompleted?: boolean;
  archiveAutoDelete?: boolean;
  createdAt: string; // ISO 8601
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: ProjectColor;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  completedTaskCount: number;
  openTaskCount: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  icon: LabelIcon;
  pinned: boolean;
  userId: string;
  /** Legacy alias of totalTaskCount, kept for older API consumers. */
  taskCount?: number;
  /** Attached tasks that are open (not completed, not deleted). */
  openTaskCount?: number;
  /** Attached tasks are completed and not deleted. */
  completedTaskCount?: number;
  /** Attached tasks that are not deleted (open + completed). */
  totalTaskCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  completed: boolean;
  dueDate?: string; // ISO 8601 date string
  dueTime?: string; // 'HH:mm' local wall-clock time
  simpleMode?: boolean;
  projectId?: string;
  parentId?: string;
  recurrenceRule?: RecurrenceRule;
  baseTaskId?: string;
  subtaskCount?: number;
  subtaskCompletedCount?: number;
  archivedAt?: string;
  permanentArchive?: boolean;
  labels?: string[]; // label IDs
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T;
  meta: PaginationMeta;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// ─── Request / DTO types ─────────────────────────────────────────────────────

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  dueTime?: string; // 'HH:mm'; requires a dueDate
  simpleMode?: boolean;
  projectId?: string | null;
  parentId?: string;
  recurrenceRule?: RecurrenceRule;
  baseTaskId?: string;
  labels?: string[];
  subtasks?: { title: string; completed?: boolean }[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string | null; // null clears a persisted date; undefined leaves it unchanged
  dueTime?: string | null; // null clears a persisted time; undefined leaves it unchanged
  simpleMode?: boolean;
  projectId?: string | null;
  parentId?: string | null;
  recurrenceRule?: RecurrenceRule | null;
  permanentArchive?: boolean;
  labels?: string[];
  completed?: boolean;
  order?: number;
  subtasks?: { title: string; completed?: boolean }[];
}

export interface CreateLabelDto {
  name: string;
  color?: string;
  icon?: LabelIcon;
  pinned?: boolean;
}

export interface UpdateLabelDto {
  name?: string;
  color?: string;
  icon?: LabelIcon;
  pinned?: boolean;
}

export interface MergeLabelDto {
  targetId: string;
}

export interface LabelMergeResult {
  /** Task associations that pointed at the source label before the merge. */
  movedTaskCount: number;
}

export type LabelFilterMode = 'any' | 'all';

export interface CreateProjectDto {
  name: string;
  description?: string;
  color?: ProjectColor;
}

export type UpdateProjectDto = Partial<CreateProjectDto>;

// ─── Notification Types ─────────────────────────────────────────────────────

export type NotificationType = 'due_today' | 'overdue' | 'due_time';

export interface Notification {
  id: string;
  taskId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

// ─── Search Types ───────────────────────────────────────────────────────────

export interface SearchTaskResult {
  task: Task;
  project: Project | null;
  score: number;
  matchReasons: string[];
}

export interface SearchProjectResult {
  project: Project;
  score: number;
  matchReasons: string[];
}

export interface SearchLabelResult {
  label: Label;
  score: number;
  matchReasons: string[];
}

export interface SearchResponse {
  query: string;
  normalizedQuery: string;
  tasks: SearchTaskResult[];
  projects: SearchProjectResult[];
  labels: SearchLabelResult[];
}

// ─── Calendar Types ─────────────────────────────────────────────────────────

/**
 * A connected calendar feed.
 *
 * The feed URL is a credential, so it is never part of this shape — only the
 * host it points at, which is enough for a person to recognise it.
 */
export interface CalendarSource {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  /** The host of the feed URL. The URL itself is never exposed. */
  host: string;
  /** How many events this source currently has stored. */
  eventCount: number;
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  /** A short, safe description of the last failure. Never contains the URL. */
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarSourceDto {
  /** The ICS feed URL. It is stored encrypted and never returned. */
  url: string;
  name?: string;
  color?: string;
}

export interface UpdateCalendarSourceDto {
  name?: string;
  color?: string;
  enabled?: boolean;
}

/**
 * The result of a fetch: what the sync did, not what it found.
 */
export interface CalendarSyncStatus {
  sourceId: string;
  /** How many events the source now has stored. */
  eventCount: number;
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** True when a limit cut the stored set short. */
  truncated: boolean;
}

/**
 * An event as the reader sees it.
 *
 * `dayKeys` and the times are projected into the reader's own zone by the
 * server, so the client groups by them and never does timezone arithmetic of
 * its own.
 */
export interface CalendarEventDto {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceColor: string;
  summary: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  /** The reader-local days this event occupies. One entry for an ordinary event. */
  dayKeys: string[];
  /** Reader-local start time (HH:mm). Null for an all-day event. */
  startTime: string | null;
  /** Reader-local end time (HH:mm). Null for an all-day event. */
  endTime: string | null;
  /** True when the feed gave no zone: the times are the source's own wall clock. */
  floating: boolean;
  /** The source's declared IANA zone, when it had one. */
  timezone: string | null;
  status: string | null;
}
