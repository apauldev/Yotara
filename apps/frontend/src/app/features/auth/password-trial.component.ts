import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-password-trial',
  standalone: true,
  template: `
    @if (showAttempts()) {
      <div class="trial-banner attempts">
        <svg class="trial-icon" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M256 0c14.7 0 28.2 8.1 35.2 21l216 400c6.7 12.4 6.4 27.4-.8 39.5S486.1 480 472 480L40 480c-14.1 0-27.2-7.4-34.4-19.5s-7.5-27.1-.8-39.5l216-400c7-12.9 20.5-21 35.2-21zm0 352a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm0-192c-18.2 0-32.7 15.5-31.4 33.7l7.4 104c.9 12.5 11.4 22.3 23.9 22.3 12.6 0 23-9.7 23.9-22.3l7.4-104c1.3-18.2-13.1-33.7-31.4-33.7z"
          />
        </svg>
        {{ remainingAttempts() }} {{ remainingAttempts() === 1 ? 'attempt' : 'attempts' }} remaining
      </div>
    }
    @if (showTimer()) {
      <div class="trial-banner locked">
        <svg class="trial-icon" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M128 96l0 64 128 0 0-64c0-35.3-28.7-64-64-64s-64 28.7-64 64zM64 160l0-64C64 25.3 121.3-32 192-32S320 25.3 320 96l0 64c35.3 0 64 28.7 64 64l0 224c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 224c0-35.3 28.7-64 64-64z"
          />
        </svg>
        0 attempts remaining. Try again in {{ timerDisplay() }}
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './password-trial.component.scss',
})
export class PasswordTrialComponent {
  remainingAttempts = input<number | null>(null);
  retryAfterSeconds = input<number | null>(null);

  showAttempts = computed(() => {
    const remaining = this.remainingAttempts();
    return remaining !== null && remaining > 0;
  });

  showTimer = computed(() => {
    const seconds = this.retryAfterSeconds();
    return seconds !== null && seconds > 0;
  });

  timerDisplay = computed(() => {
    const seconds = this.retryAfterSeconds();
    if (seconds === null || seconds <= 0) return '';

    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });
}
