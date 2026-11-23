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
            d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"
          />
        </svg>
        {{ remainingAttempts() }} {{ remainingAttempts() === 1 ? 'attempt' : 'attempts' }} remaining
      </div>
    }
    @if (showTimer()) {
      <div class="trial-banner locked">
        <svg class="trial-icon" viewBox="0 0 448 512" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z"
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
