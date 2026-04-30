import { Injectable, inject } from '@angular/core';
import type { Label, Project, Task } from '@yotara/shared';
import { LabelService } from './label.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';

export type SearchTab = 'all' | 'tasks' | 'projects' | 'labels';

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

export interface SearchResults {
  query: string;
  normalizedQuery: string;
  tasks: SearchTaskResult[];
  projects: SearchProjectResult[];
  labels: SearchLabelResult[];
}

export interface SearchLabelResult {
  label: Label;
  score: number;
  matchReasons: string[];
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly labelService = inject(LabelService);

  search(query: string): SearchResults {
    const normalizedQuery = normalize(query);
    const tasks = this.taskService.tasks();
    const projects = this.projectService.projects();
    const labels = this.labelService.labels();
    const projectById = new Map(projects.map((project) => [project.id, project] as const));

    if (!normalizedQuery) {
      return {
        query: query.trim(),
        normalizedQuery,
        tasks: [],
        projects: [],
        labels: [],
      };
    }

    const taskResults = tasks
      .map((task) => buildTaskResult(task, normalizedQuery, projectById.get(task.projectId ?? '')))
      .filter((result): result is SearchTaskResult => result !== null)
      .sort((left, right) => compareSearchResults(left.score, right.score, left.task, right.task));

    const projectResults = projects
      .map((project) => buildProjectResult(project, normalizedQuery))
      .filter((result): result is SearchProjectResult => result !== null)
      .sort((left, right) =>
        compareSearchResults(left.score, right.score, left.project, right.project),
      );

    const labelResults = labels
      .map((label) => buildLabelResult(label, normalizedQuery))
      .filter((result): result is SearchLabelResult => result !== null)
      .sort((left, right) => right.score - left.score || left.label.name.localeCompare(right.label.name));

    return {
      query: query.trim(),
      normalizedQuery,
      tasks: taskResults,
      projects: projectResults,
      labels: labelResults,
    };
  }
}

function buildLabelResult(label: Label, normalizedQuery: string): SearchLabelResult | null {
  const name = normalize(label.name);
  const color = normalize(label.color);
  const haystack = [name, color].filter(Boolean).join(' ');

  if (!includesQuery(haystack, normalizedQuery)) {
    return null;
  }

  return {
    label,
    score:
      scoreExact(name, normalizedQuery, 120) +
      scoreStartsWith(name, normalizedQuery, 100) +
      scoreContains(name, normalizedQuery, 80) +
      termCoverageScore(haystack, normalizedQuery),
    matchReasons: scoreContains(name, normalizedQuery, 1) ? ['label'] : [],
  };
}

function buildTaskResult(
  task: Task,
  normalizedQuery: string,
  project: Project | undefined,
): SearchTaskResult | null {
  const title = normalize(task.title);
  const description = normalize(task.description);
  const status = normalize(formatStatus(task.status));
  const projectName = normalize(project?.name);
  const projectDescription = normalize(project?.description);
  const dueDate = normalize(formatDueDate(task.dueDate));
  const haystack = [title, description, status, projectName, projectDescription, dueDate]
    .filter(Boolean)
    .join(' ');

  if (!includesQuery(haystack, normalizedQuery)) {
    return null;
  }

  const reasons = collectMatchReasons({
    title,
    description,
    status,
    projectName,
    projectDescription,
    dueDate,
    normalizedQuery,
  });
  const score =
    scoreExact(title, normalizedQuery, 120) +
    scoreStartsWith(title, normalizedQuery, 100) +
    scoreContains(title, normalizedQuery, 80) +
    scoreContains(description, normalizedQuery, 50) +
    scoreContains(projectName, normalizedQuery, 70) +
    scoreContains(projectDescription, normalizedQuery, 30) +
    scoreContains(status, normalizedQuery, 65) +
    scoreContains(dueDate, normalizedQuery, 20) +
    termCoverageScore(haystack, normalizedQuery) +
    recencyScore(task.updatedAt) +
    urgencyScore(task) +
    statusWeight(task);

  return {
    task,
    project: project ?? null,
    score,
    matchReasons: reasons,
  };
}

function buildProjectResult(project: Project, normalizedQuery: string): SearchProjectResult | null {
  const name = normalize(project.name);
  const description = normalize(project.description);
  const haystack = [name, description].filter(Boolean).join(' ');

  if (!includesQuery(haystack, normalizedQuery)) {
    return null;
  }

  const matchReasons = collectProjectMatchReasons(name, description, normalizedQuery);
  const score =
    scoreExact(name, normalizedQuery, 120) +
    scoreStartsWith(name, normalizedQuery, 100) +
    scoreContains(name, normalizedQuery, 80) +
    scoreContains(description, normalizedQuery, 35) +
    termCoverageScore(haystack, normalizedQuery) +
    recencyScore(project.updatedAt);

  return {
    project,
    score,
    matchReasons,
  };
}

function compareSearchResults(
  leftScore: number,
  rightScore: number,
  left: Pick<Task, 'completed' | 'status' | 'updatedAt'> | Project,
  right: Pick<Task, 'completed' | 'status' | 'updatedAt'> | Project,
) {
  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  const leftUpdatedAt = 'updatedAt' in left ? left.updatedAt : '';
  const rightUpdatedAt = 'updatedAt' in right ? right.updatedAt : '';
  if (rightUpdatedAt !== leftUpdatedAt) {
    return rightUpdatedAt.localeCompare(leftUpdatedAt);
  }

  return 0;
}

function collectMatchReasons(details: {
  title: string;
  description: string;
  status: string;
  projectName: string;
  projectDescription: string;
  dueDate: string;
  normalizedQuery: string;
}) {
  const reasons: string[] = [];

  if (scoreExact(details.title, details.normalizedQuery, 1)) {
    reasons.push('title');
  } else if (scoreContains(details.title, details.normalizedQuery, 1)) {
    reasons.push('title');
  }

  if (scoreContains(details.description, details.normalizedQuery, 1)) {
    reasons.push('description');
  }

  if (scoreContains(details.projectName, details.normalizedQuery, 1)) {
    reasons.push('project');
  }

  if (scoreContains(details.status, details.normalizedQuery, 1)) {
    reasons.push('status');
  }

  if (scoreContains(details.dueDate, details.normalizedQuery, 1)) {
    reasons.push('date');
  }

  if (scoreContains(details.projectDescription, details.normalizedQuery, 1)) {
    reasons.push('project description');
  }

  return [...new Set(reasons)];
}

function collectProjectMatchReasons(name: string, description: string, normalizedQuery: string) {
  const reasons: string[] = [];

  if (scoreExact(name, normalizedQuery, 1) || scoreContains(name, normalizedQuery, 1)) {
    reasons.push('project');
  }

  if (scoreContains(description, normalizedQuery, 1)) {
    reasons.push('description');
  }

  return reasons;
}

function scoreExact(field: string, query: string, weight: number) {
  return field && field === query ? weight : 0;
}

function scoreStartsWith(field: string, query: string, weight: number) {
  return field && field.startsWith(query) ? weight : 0;
}

function scoreContains(field: string, query: string, weight: number) {
  return field && field.includes(query) ? weight : 0;
}

function termCoverageScore(haystack: string, query: string) {
  const terms = tokenize(query);

  if (terms.length === 0) {
    return 0;
  }

  const hits = terms.filter((term) => haystack.includes(term)).length;
  return hits * 12;
}

function urgencyScore(task: Task) {
  if (task.status === 'archived') {
    return -30;
  }

  if (task.completed) {
    return -12;
  }

  const dueDate = toCalendarDate(task.dueDate);
  if (!dueDate) {
    return 0;
  }

  const dayDiff = Math.floor((dueDate.getTime() - startOfToday().getTime()) / 86_400_000);

  if (dayDiff < 0) {
    return 22;
  }

  if (dayDiff === 0) {
    return 20;
  }

  if (dayDiff <= 3) {
    return 16;
  }

  if (dayDiff <= 7) {
    return 10;
  }

  return 4;
}

function recencyScore(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const ageDays = Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
  return Math.max(0, 20 - ageDays);
}

function statusWeight(task: Task) {
  if (task.status === 'archived') {
    return -20;
  }

  if (task.completed) {
    return -8;
  }

  if (task.status === 'today') {
    return 12;
  }

  if (task.status === 'upcoming') {
    return 8;
  }

  if (task.status === 'inbox') {
    return 4;
  }

  return 0;
}

function includesQuery(haystack: string, query: string) {
  if (!query) {
    return false;
  }

  if (haystack.includes(query)) {
    return true;
  }

  const terms = tokenize(query);
  return terms.length > 0 && terms.every((term) => haystack.includes(term));
}

function normalize(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(query: string) {
  return normalize(query)
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatStatus(status: Task['status']) {
  switch (status) {
    case 'today':
      return 'today';
    case 'upcoming':
      return 'upcoming';
    case 'done':
      return 'done';
    case 'archived':
      return 'archived';
    default:
      return 'inbox';
  }
}

function formatDueDate(value?: string | null) {
  const date = toCalendarDate(value);
  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function toCalendarDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
