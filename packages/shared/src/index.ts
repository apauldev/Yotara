// ─── Primitives ─────────────────────────────────────────────────────────────
export * from './auth';

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'inbox' | 'today' | 'upcoming' | 'done' | 'archived';
export type WorkspaceMode = 'personal' | 'team';
export type TaskBucket = 'personal-sanctuary' | 'deep-work' | 'home' | 'health';
export type ProjectColor = 'sage' | 'teal' | 'olive' | 'clay' | 'forest' | 'deep-ocean';

// ─── Core Domain Types ───────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  workspaceMode?: WorkspaceMode;
  onboardingCompleted?: boolean;
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
  userId: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  completed: boolean;
  dueDate?: string; // ISO 8601 date string
  simpleMode?: boolean;
  bucket?: TaskBucket;
  projectId?: string;
  assigneeId?: string;
  parentTaskId?: string; // for subtasks
  labels?: string[]; // label IDs
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
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
  simpleMode?: boolean;
  bucket?: TaskBucket;
  projectId?: string;
  parentTaskId?: string;
  labels?: string[];
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  simpleMode?: boolean;
  bucket?: TaskBucket;
  projectId?: string | null;
  parentTaskId?: string;
  labels?: string[];
  completed?: boolean;
  order?: number;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  color?: ProjectColor;
}

export type UpdateProjectDto = Partial<CreateProjectDto>;
