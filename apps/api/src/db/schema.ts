import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import type { ProjectColor } from '@yotara/shared';

const PROJECT_COLOR_VALUES = [
  'sage',
  'teal',
  'olive',
  'clay',
  'forest',
  'deep-ocean',
] as const satisfies readonly ProjectColor[];

export const users = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
  passwordSetupRequired: integer('passwordSetupRequired', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  workspaceMode: text('workspaceMode', { enum: ['personal', 'team'] }),
  onboardingCompleted: integer('onboardingCompleted', { mode: 'boolean' }).notNull().default(false),
  archiveAutoDelete: integer('archiveAutoDelete', { mode: 'boolean' }).notNull().default(true),
  captureBehavior: text('captureBehavior', { enum: ['quick', 'capture'] })
    .notNull()
    .default('quick'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const sessions = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const accounts = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userIdToken: text('userIdToken'),
  userRefreshToken: text('userRefreshToken'),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
  scope: text('scope'),
  idToken: text('idToken'),
  password: text('password'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
});

export const verifications = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color', {
    enum: PROJECT_COLOR_VALUES,
  }),
  retiredAt: text('retired_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['inbox', 'today', 'upcoming', 'done', 'archived'],
  })
    .notNull()
    .default('inbox'),
  priority: text('priority', { enum: ['low', 'medium', 'high'] })
    .notNull()
    .default('medium'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  order: integer('sort_order').notNull().default(0),
  dueDate: text('due_date'),
  dueTime: text('due_time'),
  simpleMode: integer('simple_mode', { mode: 'boolean' }).notNull().default(false),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  parentId: text('parent_id').references((): AnySQLiteColumn => tasks.id),
  recurrenceRule: text('recurrence_rule'),
  baseTaskId: text('base_task_id').references((): AnySQLiteColumn => tasks.id),
  deletedAt: text('deleted_at'),
  archivedAt: text('archived_at'),
  permanentArchive: integer('permanent_archive', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  nameNorm: text('name_norm').notNull(),
  color: text('color').notNull(),
  icon: text('icon').notNull().default('tag'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const taskLabels = sqliteTable(
  'task_labels',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.labelId] })],
);

export const calendarSources = sqliteTable('calendar_sources', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** Encrypted ICS URL. Never returned by the API and never logged. */
  urlCiphertext: text('url_ciphertext').notNull(),
  /** SHA-256 of the normalised URL, for duplicate detection. */
  urlHash: text('url_hash').notNull(),
  color: text('color').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  etag: text('etag'),
  lastModified: text('last_modified'),
  lastFetchedAt: text('last_fetched_at'),
  lastSuccessAt: text('last_success_at'),
  /** Human-readable failure description. Never contains the URL. */
  lastError: text('last_error'),
  nextAttemptAt: text('next_attempt_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const calendarEvents = sqliteTable('calendar_events', {
  id: text('id').primaryKey(),
  sourceId: text('source_id')
    .notNull()
    .references(() => calendarSources.id, { onDelete: 'cascade' }),
  /** Denormalised so the window query filters on one table. */
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  uid: text('uid').notNull(),
  /**
   * The instance key. `''` marks a standalone event; a recurring instance
   * carries the start of the instance it replaces.
   *
   * Never `NULL`: SQLite treats NULLs as distinct inside a UNIQUE index, so a
   * nullable column would let the same event be inserted twice without
   * tripping the constraint.
   */
  recurrenceId: text('recurrence_id').notNull().default(''),
  summary: text('summary').notNull().default(''),
  description: text('description'),
  location: text('location'),
  /** UTC ISO instant. */
  startAt: text('start_at').notNull(),
  /** UTC ISO instant, exclusive. */
  endAt: text('end_at').notNull(),
  allDay: integer('all_day', { mode: 'boolean' }).notNull().default(false),
  /** `YYYY-MM-DD`, for all-day display. Not a bucketing key. */
  startDate: text('start_date'),
  /** `YYYY-MM-DD`, exclusive, for all-day display. Not a bucketing key. */
  endDate: text('end_date'),
  /** The source's IANA zone, when it declared a known one. */
  timezone: text('timezone'),
  /** True when the feed gave no zone: the stored time is the source's wall clock. */
  floating: integer('floating', { mode: 'boolean' }).notNull().default(false),
  status: text('status'),
  updatedAt: text('updated_at').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull(),
});

export type DbNotification = typeof notifications.$inferSelect;
export type NewDbNotification = typeof notifications.$inferInsert;
export type DbTask = typeof tasks.$inferSelect;
export type NewDbTask = typeof tasks.$inferInsert;
export type DbProject = typeof projects.$inferSelect;
export type DbCalendarSource = typeof calendarSources.$inferSelect;
export type NewDbCalendarSource = typeof calendarSources.$inferInsert;
export type DbCalendarEvent = typeof calendarEvents.$inferSelect;
export type NewDbCalendarEvent = typeof calendarEvents.$inferInsert;
