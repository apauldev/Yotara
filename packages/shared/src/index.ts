// ─── Primitives ─────────────────────────────────────────────────────────────
export * from './auth';

export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'inbox' | 'today' | 'upcoming' | 'done' | 'archived';
export type WorkspaceMode = 'personal' | 'team';
export type TaskBucket = 'personal-sanctuary' | 'deep-work' | 'home' | 'health';

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
  color?: string;
  ownerId: string;
  teamId?: string;
  createdAt: string;
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

export interface UpdateTaskDto extends Partial<CreateTaskDto> {
  completed?: boolean;
  order?: number;
}
