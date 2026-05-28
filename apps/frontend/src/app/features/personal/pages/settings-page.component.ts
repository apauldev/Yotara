import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { APP_VERSION } from '../../../core/constants/version';
import { ThemeService, Theme } from '../../../core/services/theme.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ChangePasswordModalComponent } from '../components/change-password-modal.component';
import { LogoutConfirmModalComponent } from '../../../shared/ui/logout-confirm-modal/logout-confirm-modal.component';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { Router } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { ProjectService } from '../../../core/services/project.service';
import { LabelService } from '../../../core/services/label.service';
import { downloadCsv, CsvColumn } from '../../../shared/utils/export';
import { Task, Project, Label } from '@yotara/shared';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    ChangePasswordModalComponent,
    LogoutConfirmModalComponent,
  ],
  template: `
    <section class="page">
      <app-page-header
        eyebrow="Personal Sanctuary"
        title="Settings"
        subtitle="Manage your personal sanctuary preferences, including archive cleanup."
      />

      <div class="settings-card">
        <div class="settings-section">
          <h3 class="section-title">Appearance</h3>
          <div class="settings-item">
            <div class="settings-item-copy">
              <strong>Application theme</strong>
              <span>Choose your preferred visual style.</span>
            </div>
            <select
              class="settings-select"
              [value]="themeService.theme()"
              (change)="onThemeChange($event)"
              aria-label="Select theme"
            >
              <option value="light-forest">Light Forest</option>
              <option value="dark-forest">Dark Forest</option>
              <option value="coastal-calm">Coastal Calm</option>
              <option value="minimal-slate">Minimal Slate</option>
              <option value="midnight-amethyst">Midnight Amethyst</option>
              <option value="golden-hour">Golden Hour</option>
              <option value="deep-trench">Deep Trench</option>
            </select>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Behavior</h3>
          <label class="settings-item settings-toggle">
            <div class="settings-item-copy">
              <strong>Auto-delete archived tasks</strong>
              <span>Turn this off to keep archived tasks indefinitely.</span>
            </div>
            <input
              type="checkbox"
              class="toggle-input"
              [checked]="archiveAutoDelete()"
              (change)="onArchiveCleanupChange($event)"
              [disabled]="isSavingArchiveCleanup()"
              aria-label="Toggle auto-delete for archived tasks"
            />
          </label>

          <div class="settings-item">
            <div class="settings-item-copy">
              <strong>Capture behavior</strong>
              <span>Choose how the task capture bar behaves by default.</span>
            </div>
            <select
              class="settings-select"
              [value]="captureBehavior()"
              (change)="onCaptureBehaviorChange($event)"
              [disabled]="isSavingCaptureBehavior()"
              aria-label="Select capture behavior"
            >
              <option value="quick">Quick Capture (Default)</option>
              <option value="capture">Full Capture (Open Modal)</option>
            </select>
          </div>

          <div class="settings-item settings-item-disabled">
            <div class="settings-item-copy">
              <strong>Desktop notifications</strong>
              <span>Get notified about task updates.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </div>
          <div class="settings-item settings-item-disabled">
            <div class="settings-item-copy">
              <strong>Email digests</strong>
              <span>Weekly summary of your tasks.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Preferences</h3>
          <div class="settings-item settings-item-disabled">
            <div class="settings-item-copy">
              <strong>Default view</strong>
              <span>Set your preferred task view.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </div>
          <div class="settings-item settings-item-disabled">
            <div class="settings-item-copy">
              <strong>Sort order</strong>
              <span>Arrange tasks by priority, date, or custom.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Account</h3>
          <button
            type="button"
            class="settings-item settings-link"
            (click)="isChangePasswordOpen.set(true)"
          >
            <div class="settings-item-copy">
              <strong>Change password</strong>
              <span>Update your account password.</span>
            </div>
          </button>
          <button type="button" class="settings-item settings-link" disabled>
            <div class="settings-item-copy">
              <strong>Profile settings</strong>
              <span>Edit your name, email, and avatar.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </button>
          <button type="button" class="settings-item settings-link" disabled>
            <div class="settings-item-copy">
              <strong>Two-factor authentication</strong>
              <span>Add extra security to your account.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </button>
          <button
            type="button"
            class="settings-item settings-link settings-link-danger"
            (click)="isLogoutConfirmOpen.set(true)"
          >
            <div class="settings-item-copy">
              <strong>Logout</strong>
              <span>Sign out of your account.</span>
            </div>
          </button>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Data</h3>

          <button type="button" class="settings-item settings-link" (click)="exportTasks()">
            <div class="settings-item-copy">
              <strong>Export tasks</strong>
              <span>Download your tasks as a CSV file.</span>
            </div>
          </button>

          <button type="button" class="settings-item settings-link" (click)="exportProjects()">
            <div class="settings-item-copy">
              <strong>Export projects</strong>
              <span>Download your projects as a CSV file.</span>
            </div>
          </button>

          <button type="button" class="settings-item settings-link" (click)="exportLabels()">
            <div class="settings-item-copy">
              <strong>Export labels</strong>
              <span>Download your labels as a CSV file.</span>
            </div>
          </button>

          <details class="export-options">
            <summary class="export-options-summary">Export options</summary>
            <div class="export-options-grid">
              <label class="export-checkbox">
                <input
                  type="checkbox"
                  [checked]="includeCompleted()"
                  (change)="includeCompleted.set($any($event.target).checked)"
                />
                <span>Completed tasks</span>
              </label>
              <label class="export-checkbox">
                <input
                  type="checkbox"
                  [checked]="includeSubtasks()"
                  (change)="includeSubtasks.set($any($event.target).checked)"
                />
                <span>Subtasks</span>
              </label>
              <label class="export-checkbox">
                <input
                  type="checkbox"
                  [checked]="includeDescriptions()"
                  (change)="includeDescriptions.set($any($event.target).checked)"
                />
                <span>Descriptions</span>
              </label>
              <label class="export-checkbox">
                <input
                  type="checkbox"
                  [checked]="includeArchived()"
                  (change)="includeArchived.set($any($event.target).checked)"
                />
                <span>Archived items</span>
              </label>
              <label class="export-checkbox">
                <input
                  type="checkbox"
                  [checked]="includeRecurrence()"
                  (change)="includeRecurrence.set($any($event.target).checked)"
                />
                <span>Recurrence rules</span>
              </label>
            </div>
          </details>

          <button type="button" class="settings-item settings-link" disabled>
            <div class="settings-item-copy">
              <strong>Import data</strong>
              <span>Upload tasks from other apps.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </button>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Support</h3>
          <button type="button" class="settings-item settings-link" disabled>
            <div class="settings-item-copy">
              <strong>Help center</strong>
              <span>Browse guides and documentation.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </button>
          <button type="button" class="settings-item settings-link" disabled>
            <div class="settings-item-copy">
              <strong>Keyboard shortcuts</strong>
              <span>Learn productivity hotkeys.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </button>
        </div>

        <div class="settings-section">
          <h3 class="section-title">About</h3>
          <div class="settings-item">
            <div class="settings-item-copy">
              <strong>Version</strong>
              <span>{{ appVersion.full }}</span>
            </div>
          </div>
          <div class="settings-item">
            <div class="settings-item-copy">
              <strong>Build date</strong>
              <span>{{ appVersion.buildDate | date: 'longDate' }}</span>
            </div>
          </div>
          <div class="settings-item">
            <div class="settings-item-copy">
              <strong>Status</strong>
              <span>Alpha Release</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <app-change-password-modal
      [open]="isChangePasswordOpen()"
      (close)="isChangePasswordOpen.set(false)"
    />

    <app-logout-confirm-modal
      [open]="isLogoutConfirmOpen()"
      [loading]="isLoggingOut()"
      (close)="isLogoutConfirmOpen.set(false)"
      (stay)="isLogoutConfirmOpen.set(false)"
      (confirm)="onLogout()"
    />
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        padding: 1rem 0 2rem;
      }

      .settings-card {
        margin-top: 1.5rem;
        border-radius: 1.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 2.25rem;
        max-width: 42rem;
      }

      .settings-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .section-title {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--on-surface-subtle);
        padding-left: 0.5rem;
      }

      .settings-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        padding: 0.75rem 0.5rem;
        border-radius: 1rem;
        transition: background-color 0.2s ease;
      }

      .settings-toggle {
        cursor: pointer;
      }

      .settings-item-copy {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .settings-item-copy strong {
        font-size: 1.05rem;
        letter-spacing: -0.01em;
        color: var(--on-surface);
      }

      .settings-item-copy span {
        color: var(--on-surface-muted);
        font-size: 0.9rem;
        line-height: 1.4;
      }

      .settings-select {
        appearance: none;
        background: var(--surface-container-high);
        border: 1px solid var(--outline-variant);
        border-radius: 0.75rem;
        color: var(--on-surface);
        font-family: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        padding: 0.6rem 2.25rem 0.6rem 1rem;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        background-size: 1rem;
        transition: all 0.2s ease;
        min-width: 10rem;
      }

      .settings-select:hover {
        background-color: var(--surface-container-highest);
        border-color: var(--on-surface-subtle);
      }

      .settings-select:focus {
        outline: none;
        border-color: var(--primary-solid);
        box-shadow: 0 0 0 2px var(--primary-soft);
      }

      .toggle-input {
        appearance: none;
        width: 3rem;
        height: 1.7rem;
        border-radius: 999px;
        background: var(--surface-container-high);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        position: relative;
        flex: 0 0 auto;
        cursor: pointer;
        transition:
          background-color 0.2s ease,
          box-shadow 0.2s ease;
      }

      .toggle-input::after {
        content: '';
        position: absolute;
        top: 0.18rem;
        left: 0.18rem;
        width: 1.34rem;
        height: 1.34rem;
        border-radius: 50%;
        background: var(--on-surface-subtle);
        transition:
          transform 0.2s ease,
          background-color 0.2s ease;
      }

      .toggle-input:checked {
        background: var(--primary-soft);
        box-shadow: inset 0 0 0 1px var(--primary-soft-strong);
      }

      .toggle-input:checked::after {
        transform: translateX(1.3rem);
        background: var(--primary-solid);
      }

      .toggle-input:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 2px;
      }

      .coming-soon {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--on-surface-subtle);
        padding: 0.3rem 0.6rem;
        background: var(--surface-container-high);
        border-radius: 0.5rem;
        flex: 0 0 auto;
      }

      .settings-link {
        width: 100%;
        border: 0;
        background: transparent;
        color: var(--on-surface);
        text-align: left;
        cursor: pointer;
        font: inherit;
        text-decoration: none;
      }

      .settings-link:hover:not(:disabled) {
        background: var(--surface-container-high);
      }

      .settings-link:disabled {
        cursor: not-allowed;
      }

      .settings-item-disabled {
        opacity: 0.5;
      }

      .settings-link-danger:hover:not(:disabled) {
        background: var(--error-soft);
      }

      .settings-link-danger:hover:not(:disabled) strong {
        color: var(--error-solid);
      }

      .settings-link-danger:hover:not(:disabled) span {
        color: var(--error-solid);
        opacity: 0.7;
      }

      .export-options {
        margin-top: 0;
        border-radius: 0.75rem;
        background: var(--surface-container-low);
        padding: 0 0.5rem;
      }

      .export-options-summary {
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--on-surface-subtle);
        padding: 0.75rem 0.5rem;
        border-radius: 0.5rem;
        user-select: none;
      }

      .export-options-summary:hover {
        color: var(--on-surface);
        background: var(--surface-container-high);
      }

      .export-options-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.25rem;
        padding: 0 0.5rem 0.75rem;
      }

      .export-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.5rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-size: 0.9rem;
        color: var(--on-surface);
        transition: background-color 0.15s ease;
      }

      .export-checkbox:hover {
        background: var(--surface-container-high);
      }

      .export-checkbox input[type='checkbox'] {
        appearance: none;
        width: 1.1rem;
        height: 1.1rem;
        border-radius: 0.3rem;
        background: var(--surface-container-high);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        cursor: pointer;
        flex: 0 0 auto;
        transition: all 0.15s ease;
        position: relative;
      }

      .export-checkbox input[type='checkbox']::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0.5rem;
        height: 0.5rem;
        transform: translate(-50%, -50%) scale(0);
        border-radius: 0.1rem;
        background: var(--primary-solid);
        transition: transform 0.15s ease;
      }

      .export-checkbox input[type='checkbox']:checked {
        background: var(--primary-soft);
        box-shadow: inset 0 0 0 1px var(--primary-soft-strong);
      }

      .export-checkbox input[type='checkbox']:checked::after {
        transform: translate(-50%, -50%) scale(1);
      }

      .export-checkbox input[type='checkbox']:focus-visible {
        outline: 2px solid var(--primary-solid);
        outline-offset: 2px;
      }

      @media (max-width: 640px) {
        .settings-card {
          padding: 1rem;
          gap: 2rem;
          border-radius: 1.25rem;
        }

        .settings-item {
          flex-direction: column;
          align-items: stretch;
          gap: 1rem;
          padding: 0.5rem;
        }

        .settings-select {
          width: 100%;
          min-width: 0;
        }

        .coming-soon {
          align-self: flex-start;
        }
      }
    `,
  ],
})
export class SettingsPageComponent {
  protected readonly appVersion = APP_VERSION;
  protected readonly themeService = inject(ThemeService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly labelService = inject(LabelService);

  protected readonly isChangePasswordOpen = signal(false);
  protected readonly isLogoutConfirmOpen = signal(false);
  protected readonly isLoggingOut = signal(false);
  protected readonly isSavingArchiveCleanup = signal(false);
  protected readonly isSavingCaptureBehavior = signal(false);

  protected readonly includeCompleted = signal(true);
  protected readonly includeSubtasks = signal(true);
  protected readonly includeDescriptions = signal(true);
  protected readonly includeArchived = signal(true);
  protected readonly includeRecurrence = signal(true);

  protected readonly projectMap = computed(() => {
    const map = new Map<string, string>();
    for (const p of this.projectService.projects()) {
      map.set(p.id, p.name);
    }
    return map;
  });

  protected readonly labelMap = computed(() => {
    const map = new Map<string, string>();
    for (const l of this.labelService.labels()) {
      map.set(l.id, l.name);
    }
    return map;
  });

  protected exportTasks() {
    const labels = this.labelMap();

    const exportable = this.taskService.tasks().filter((task) => {
      if (!this.includeCompleted() && task.completed) return false;
      if (!this.includeSubtasks() && task.parentId) return false;
      if (!this.includeArchived() && task.status === 'archived') return false;
      return true;
    });

    const columns: CsvColumn<Task>[] = [
      { key: 'id', label: 'ID' },
      { key: 'title', label: 'Title' },
      ...(this.includeDescriptions()
        ? [{ key: 'description' as const, label: 'Description' } as CsvColumn<Task>]
        : []),
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      {
        key: 'completed',
        label: 'Completed',
        format: (row: Task) => (row.completed ? 'Yes' : 'No'),
      },
      { key: 'dueDate', label: 'Due Date' },
      {
        key: 'projectId',
        label: 'Project',
        format: (row: Task) => this.projectMap().get(row.projectId ?? '') ?? '',
      },
      {
        key: 'labels',
        label: 'Labels',
        format: (row: Task) => (row.labels ?? []).map((id) => labels.get(id) ?? id).join('; '),
      },
      { key: 'bucket', label: 'Bucket' },
      { key: 'parentId', label: 'Parent Task ID' },
      { key: 'subtaskCount', label: 'Subtasks' },
      { key: 'subtaskCompletedCount', label: 'Subtasks Done' },
      ...(this.includeRecurrence()
        ? [
            {
              key: 'recurrenceRule' as const,
              label: 'Recurrence',
              format: (row: Task) =>
                row.recurrenceRule
                  ? `${row.recurrenceRule.frequency} every ${row.recurrenceRule.interval}`
                  : '',
            } as CsvColumn<Task>,
          ]
        : []),
      { key: 'archivedAt', label: 'Archived At' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'updatedAt', label: 'Updated At' },
    ];

    downloadCsv(exportable, columns, 'yotara-tasks.csv');
  }

  protected exportProjects() {
    const columns: CsvColumn<Project>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'color', label: 'Color' },
      { key: 'taskCount', label: 'Total Tasks' },
      { key: 'completedTaskCount', label: 'Completed Tasks' },
      { key: 'openTaskCount', label: 'Open Tasks' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'updatedAt', label: 'Updated At' },
    ];

    downloadCsv(this.projectService.projects(), columns, 'yotara-projects.csv');
  }

  protected exportLabels() {
    const columns: CsvColumn<Label>[] = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Name' },
      { key: 'color', label: 'Color' },
      { key: 'taskCount', label: 'Tasks' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'updatedAt', label: 'Updated At' },
    ];

    downloadCsv(this.labelService.labels(), columns, 'yotara-labels.csv');
  }

  protected onThemeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.themeService.setTheme(select.value as Theme);
  }

  protected archiveAutoDelete() {
    return this.authState.user()?.archiveAutoDelete ?? true;
  }

  protected captureBehavior() {
    return this.authState.user()?.captureBehavior ?? 'quick';
  }

  protected async onArchiveCleanupChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.isSavingArchiveCleanup.set(true);

    try {
      await this.authState.updateProfile({
        archiveAutoDelete: checkbox.checked,
      });
    } finally {
      this.isSavingArchiveCleanup.set(false);
    }
  }

  protected async onCaptureBehaviorChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.isSavingCaptureBehavior.set(true);

    try {
      await this.authState.updateProfile({
        captureBehavior: select.value as 'quick' | 'capture',
      });
    } finally {
      this.isSavingCaptureBehavior.set(false);
    }
  }

  protected async onLogout() {
    this.isLoggingOut.set(true);
    try {
      await this.authState.signOut();
      this.isLogoutConfirmOpen.set(false);
      await this.router.navigate(['/login']);
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}
