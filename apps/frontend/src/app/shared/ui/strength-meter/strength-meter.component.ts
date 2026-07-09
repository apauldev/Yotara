import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { checkPasswordPolicy } from '../../../features/auth/password-policy';

export interface StrengthResult {
  percent: number;
  class: string;
  label: string;
}

@Component({
  selector: 'app-strength-meter',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (password()) {
      <div class="strength-meter">
        <div
          class="strength-bar"
          [style.width.%]="strength().percent"
          [ngClass]="strength().class"
        ></div>
      </div>
      <div class="strength-label">
        Strength: <span>{{ strength().label }}</span>
      </div>
      <div class="requirements">
        <span [class.met]="rules()[0]">8+ chars</span>
        <span [class.met]="rules()[1]">Capital</span>
        <span [class.met]="rules()[2]">Lowercase</span>
        <span [class.met]="rules()[3]">Number</span>
        <span [class.met]="rules()[4]">Symbol</span>
      </div>
    }
  `,
  styleUrl: './strength-meter.component.css',
})
export class StrengthMeterComponent {
  readonly password = input<string>('');

  private readonly policy = computed(() => checkPasswordPolicy(this.password()));

  protected readonly rules = computed(() => this.policy().errors.map((e) => e.met));

  protected readonly strength = computed((): StrengthResult => {
    const p = this.password();
    if (!p) return { percent: 0, class: '', label: '' };

    const errors = this.policy().errors;
    let score = 0;
    for (const e of errors) {
      if (e.met) score++;
    }
    if (p.length >= 12) score++;

    // Bar fills in tiers: weak=33% (red), fair=66% (yellow), good/strong=99% (green).
    let percent = 0;
    if (score >= 4) percent = 99;
    else if (score >= 2) percent = 66;
    else if (p) percent = 33;

    if (score >= 5) return { percent, class: 'strength-strong', label: 'Strong' };
    if (score >= 4) return { percent, class: 'strength-good', label: 'Good' };
    if (score >= 2) return { percent, class: 'strength-fair', label: 'Fair' };
    return { percent, class: 'strength-weak', label: 'Weak' };
  });
}
