import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ThemeService, Theme } from '../../../core/services/theme.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <section class="page">
      <app-page-header
        eyebrow="Personal Sanctuary"
        title="Settings"
        subtitle="Manage your personal sanctuary preferences."
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
            </select>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="section-title">Behavior</h3>
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
          <button type="button" class="settings-item settings-link" disabled>
            <div class="settings-item-copy">
              <strong>Change password</strong>
              <span>Update your account password.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
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
        </div>

        <div class="settings-section">
          <h3 class="section-title">Data</h3>
          <button type="button" class="settings-item settings-link" disabled>
            <div class="settings-item-copy">
              <strong>Export data</strong>
              <span>Download your tasks and projects as JSON.</span>
            </div>
            <span class="coming-soon">Coming soon</span>
          </button>
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
      </div>
    </section>
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
        gap: 2rem;
        max-width: 42rem;
      }

      .settings-section {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .section-title {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--on-surface-muted);
      }

      .settings-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
      }

      .settings-item-disabled {
        opacity: 0.5;
      }

      .settings-item-copy {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }

      .settings-item-copy strong {
        font-size: 1.1rem;
        letter-spacing: -0.01em;
      }

      .settings-item-copy span {
        color: var(--on-surface-muted);
        font-size: 0.95rem;
      }

      .settings-select {
        appearance: none;
        background: var(--surface-container-high);
        border: 1px solid var(--outline-variant);
        border-radius: 0.75rem;
        color: var(--on-surface);
        font-family: inherit;
        font-size: 0.92rem;
        font-weight: 600;
        padding: 0.6rem 2.2rem 0.6rem 1rem;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.75rem center;
        background-size: 1rem;
        transition: all 0.2s ease;
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

      .settings-placeholder {
        font-size: 0.95rem;
        color: var(--on-surface-muted);
        padding: 0.5rem 0.9rem;
        background: var(--surface-container-high);
        border-radius: 0.5rem;
        flex: 0 0 auto;
      }

      .coming-soon {
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--on-surface-muted);
        padding: 0.35rem 0.65rem;
        background: var(--surface-container-high);
        border-radius: 0.4rem;
        flex: 0 0 auto;
      }

      .settings-link {
        padding: 0.85rem 0.9rem;
        gap: 0.9rem;
        width: 100%;
        border: 0;
        border-radius: 1rem;
        background: transparent;
        color: var(--on-surface);
        text-align: left;
        cursor: pointer;
        font: inherit;
        font-size: 1rem;
        text-decoration: none;
        transition: background-color 0.2s ease;
      }

      .settings-link:hover:not(:disabled) {
        background: var(--surface-container-high);
      }

      .settings-link:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
    `,
  ],
})
export class SettingsPageComponent {
  protected readonly themeService = inject(ThemeService);

  protected onThemeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.themeService.setTheme(select.value as Theme);
  }
}
