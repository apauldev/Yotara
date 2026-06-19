import { Component, computed, input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTriangleExclamation, faLock } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-password-trial',
  standalone: true,
  imports: [FontAwesomeModule],
  template: `
    @if (showAttempts()) {
      <div class="trial-banner attempts">
        <fa-icon class="trial-icon" [icon]="faTriangleExclamation" aria-hidden="true"></fa-icon>
        {{ remainingAttempts() }} {{ remainingAttempts() === 1 ? 'attempt' : 'attempts' }} remaining
      </div>
    }
    @if (showTimer()) {
      <div class="trial-banner locked">
        <fa-icon class="trial-icon" [icon]="faLock" aria-hidden="true"></fa-icon>
        0 attempts remaining. Try again in {{ timerDisplay() }}
      </div>
    }
  `,
  styleUrl: './password-trial.component.scss',
})
export class PasswordTrialComponent {
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faLock = faLock;

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
