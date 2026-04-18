import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';

@Component({
  selector: 'app-inbox-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PersonalTaskCardComponent, PersonalTaskWorkspaceComponent],
  template: `
    <app-personal-task-workspace
      #workspace
      [initialTitle]="captureTitle()"
      (taskSaved)="handleTaskSaved($event)"
      (taskSaveFailed)="captureError.set($event)"
    >
      <section class="page">
        <header class="page-header">
          <h1>Inbox</h1>
          <p>Collect everything that needs your attention.</p>
        </header>

        <form id="capture" class="capture-bar" (ngSubmit)="captureTask()">
          <button
            type="submit"
            class="capture-plus"
            [disabled]="taskService.creating()"
            aria-label="Capture task"
          >
            +
          </button>

          <input
            type="text"
            name="captureTitle"
            [ngModel]="captureTitle()"
            (ngModelChange)="captureTitle.set($event)"
            placeholder="What's on your mind today?"
            autocomplete="off"
          />

          <div class="capture-actions" aria-hidden="true">
            <span class="capture-icon">🗓</span>
            <span class="capture-icon">⚑</span>
          </div>

          <button type="submit" class="capture-submit" [disabled]="taskService.creating()">
            {{ taskService.creating() ? 'Saving...' : 'Capture' }}
          </button>
        </form>

        @if (captureError()) {
          <p class="capture-error">{{ captureError() }}</p>
        }

        <section class="list-section">
          <div class="section-heading">
            <h2>Pending Processing</h2>
            <span class="section-count">{{ inboxCountLabel() }}</span>
          </div>

          @if (taskService.loading()) {
            <p class="status-copy">Loading your inbox...</p>
          } @else if (taskService.error()) {
            <p class="status-copy">{{ taskService.error() }}</p>
          } @else if (taskService.inboxTasks().length === 0) {
            <div class="empty-state">
              <h3>Clear skies</h3>
              <p>Your inbox is empty. Capture the next idea or task above to keep moving.</p>
            </div>
          } @else {
            <div class="task-stack">
              @for (task of taskService.inboxTasks(); track task.id) {
                <app-personal-task-card
                  [task]="task"
                  [interactive]="true"
                  (select)="workspace.editTask(task)"
                />
              }
            </div>
          }
        </section>

        <div class="promo-grid">
          <div class="promo-card promo-card-soft">
            <div class="promo-icon">✦</div>
            <h3>Daily clarity</h3>
            <p>{{ dailyClarityPrompt() }}</p>
          </div>

          <div class="promo-card promo-card-dark">
            <p>{{ journalPrompt() }}</p>
            <span>The Yotara Journal</span>
          </div>
        </div>
      </section>
    </app-personal-task-workspace>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        padding: 0.85rem 0 2rem;
      }

      .page-header h1 {
        margin: 0;
        font-size: clamp(2.7rem, 4vw, 3.6rem);
        line-height: 1.02;
        letter-spacing: -0.05em;
      }

      .page-header p {
        margin: 0.55rem 0 0;
        color: #8a8378;
        font-size: 1.12rem;
      }

      .capture-bar {
        margin-top: 2rem;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 0.8rem;
        background: rgba(255, 255, 255, 0.94);
        border-radius: 1.2rem;
        border: 1px solid rgba(236, 228, 210, 0.9);
        box-shadow: 0 18px 32px rgba(120, 109, 83, 0.08);
        padding: 0.8rem 0.95rem;
      }

      .capture-plus {
        width: 2rem;
        height: 2rem;
        border: 0;
        border-radius: 999px;
        background: #2e7b53;
        color: #f5f7f2;
        font-size: 1.4rem;
        line-height: 1;
      }

      .capture-bar input {
        border: 0;
        outline: none;
        background: transparent;
        color: #2e312a;
        font-size: 1.06rem;
      }

      .capture-bar input::placeholder {
        color: #c0b7a9;
      }

      .capture-actions {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        color: #b9b1a6;
      }

      .capture-submit {
        border: 0;
        border-radius: 0.92rem;
        background: #256c47;
        color: #f8faf5;
        font-weight: 700;
        min-width: 6.8rem;
        min-height: 2.8rem;
        padding: 0 1rem;
      }

      .capture-error,
      .status-copy {
        margin: 0.7rem 0 0;
        color: #8a8378;
      }

      .capture-error {
        color: #bb6d57;
      }

      .list-section {
        margin-top: 2.8rem;
      }

      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .section-heading h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #98907f;
      }

      .section-count {
        border-radius: 999px;
        background: #eee8d8;
        padding: 0.28rem 0.7rem;
        color: #7e776b;
        font-size: 0.76rem;
        font-weight: 700;
      }

      .task-stack {
        display: grid;
        gap: 0.95rem;
      }

      .empty-state {
        border: 1px dashed rgba(224, 215, 196, 0.95);
        border-radius: 1.4rem;
        background: rgba(255, 251, 242, 0.6);
        padding: 2rem 1.3rem;
        text-align: center;
      }

      .empty-state h3 {
        margin: 0;
        font-size: 2rem;
        letter-spacing: -0.04em;
      }

      .empty-state p {
        margin: 0.55rem auto 0;
        max-width: 28rem;
        color: #8a8378;
      }

      .promo-grid {
        margin-top: 2rem;
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
        gap: 1rem;
      }

      .promo-card {
        border-radius: 1.6rem;
        padding: 1.5rem;
      }

      .promo-card-soft {
        background: rgba(255, 252, 243, 0.72);
        border: 1px dashed rgba(224, 215, 196, 0.95);
      }

      .promo-icon {
        width: 4rem;
        height: 4rem;
        border-radius: 999px;
        background: #dcf4e2;
        color: #2c7c54;
        display: grid;
        place-items: center;
        font-size: 1.4rem;
      }

      .promo-card h3,
      .promo-card-dark p {
        margin: 1rem 0 0;
      }

      .promo-card-soft p,
      .promo-card-dark span {
        color: #8a8378;
      }

      .promo-card-dark {
        background: linear-gradient(135deg, #101815, #1f4434);
        color: #f2f4ee;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      }

      .promo-card-dark p {
        font-size: 1.22rem;
        line-height: 1.35;
        font-style: italic;
      }

      .promo-card-dark span {
        margin-top: 1rem;
        color: #c2d4c8;
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
      }

      @media (max-width: 900px) {
        .promo-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        .page {
          padding-top: 0.3rem;
        }

        .capture-bar {
          grid-template-columns: 1fr;
          align-items: stretch;
          gap: 0.65rem;
        }

        .capture-plus {
          width: 2.4rem;
          height: 2.4rem;
        }

        .capture-actions {
          justify-content: flex-start;
        }

        .capture-submit {
          width: 100%;
        }

        .promo-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class InboxPageComponent {
  protected readonly taskService = inject(TaskService);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly captureTitle = signal('');
  protected readonly captureError = signal('');
  protected readonly inboxCountLabel = computed(
    () => `${this.taskService.inboxTasks().length} Tasks`,
  );
  protected readonly dailyClarityPrompts = DAILY_CLARITY_PROMPTS;
  protected readonly journalPrompts = YOTARA_JOURNAL_PROMPTS;
  protected readonly dailyClarityPrompt = signal(pickRandomPrompt(DAILY_CLARITY_PROMPTS));
  protected readonly journalPrompt = signal(pickRandomPrompt(YOTARA_JOURNAL_PROMPTS));

  protected async captureTask() {
    const title = this.captureTitle().trim();

    if (!title) {
      this.captureError.set('Add a task title to capture it.');
      return;
    }

    this.captureError.set('');
    this.workspace()?.openCreateTaskModal();
  }

  protected handleTaskSaved(mode: 'create' | 'update') {
    if (mode === 'create') {
      this.captureTitle.set('');
    }

    this.captureError.set('');
    this.dailyClarityPrompt.set(pickRandomPrompt(this.dailyClarityPrompts));
    this.journalPrompt.set(pickRandomPrompt(this.journalPrompts));
  }
}

const DAILY_CLARITY_PROMPTS = [
  'A single clear step often feels lighter than many vague ideas.',
  'When thoughts have a place to land, the mind becomes quieter.',
  'Small honest captures create space for what matters most.',
  'Clarity usually begins with writing it down, not figuring it out.',
  'A calm list is often more powerful than a perfect plan.',
  'The gentlest systems are the ones we actually return to.',
  'Progress feels easier when the next action is visible and simple.',
  'Some days, just naming the task is enough.',
  'A quiet inbox is a kind gift to your future self.',
  "The mind works better when it isn't carrying everything at once.",
  'One captured thought can soften the weight of the day.',
  'Simplicity in your system often creates room for creativity.',
  'Trust grows when your tasks feel honest and manageable.',
  'A focused day usually starts with a focused first step.',
  'Letting go of mental loops often begins with writing them down.',
  'The smallest clear action can create surprising momentum.',
  "Order doesn't have to be perfect to be helpful.",
  'A supportive list feels like help, not pressure.',
  'Clarity and calm tend to travel together.',
  'When everything has its place, the mind can rest.',
  'Gentle structure can feel like a deep breath.',
  'What gets captured today stops echoing tomorrow.',
  'A clear surface invites clearer thinking.',
  'The kindest productivity is usually the simplest.',
  'Sometimes the most productive thing is to start.',
  'Peaceful focus starts with a system you trust.',
  'A well-placed task is easier to return to.',
  'Less noise in the mind leaves more room for what matters.',
  'Every small capture is an act of self-kindness.',
  'The clearest days often begin with the clearest intentions.',
  'Done is often better than organized.',
  'One task at a time is still progress.',
  'The next step is usually smaller than it feels.',
  'A list that fits your day beats a list that judges it.',
  "You don't need to clear it all — just begin somewhere.",
];

const YOTARA_JOURNAL_PROMPTS = [
  '“Within you, there is a stillness and a sanctuary to which you can retreat at any time.” — Eckhart Tolle',
  '“A calm mind brings inner strength and self-confidence.” — Dalai Lama',
  '“Peace of mind comes when you stop trying to control everything.” — Eckhart Tolle',
  '“Your mind is for having ideas, not holding them.” — David Allen',
  '“Simplicity is the ultimate sophistication.” — Leonardo da Vinci',
  '“Focus and simplicity. Simple can be harder than complex.” — Steve Jobs',
  '“The clearer the vision, the fewer the options.” — Andy Stanley',
  '“Calmness is the cradle of power.” — Josiah Gilbert Holland',
  '“You must use your mind to get things off your mind.” — David Allen',
  '“A quiet mind is able to hear intuition over fear.” — Unknown',
  '“The present moment is the only time over which we have dominion.” — Thích Nhất Hạnh',
  '“Simplicity is the keynote of all true elegance.” — Coco Chanel',
  '“In the midst of movement and chaos, keep stillness inside of you.” — Deepak Chopra',
  '“The things you are passionate about are not random. They are your calling.” — Fabienne Fredrickson',
  '“Stillness is where creativity and solutions to problems are found.” — Eckhart Tolle',
  '“Less is more.” — Ludwig Mies van der Rohe',
  '“The soul usually knows what to do to heal itself. The challenge is to silence the mind.” — Caroline Myss',
  '“Order is the shape upon which beauty depends.” — Pearl S. Buck',
  '“To be calm is the highest achievement of the self.” — Zen Proverb',
  '“The unexamined life is not worth living.” — Socrates',
  '“He who is contented is rich.” — Lao Tzu',
  '“Silence is the language of God.” — Rumi',
  '“The quieter you become, the more you can hear.” — Ram Dass',
  '“Do not let the behavior of others destroy your inner peace.” — Dalai Lama',
  '“Everything you need is already inside you.” — Thích Nhất Hạnh',
  '“The greatest weapon against stress is our ability to choose one thought over another.” — William James',
  '“A cluttered mind is a cluttered life.” — Unknown',
  '“True simplicity is when the inner and outer are aligned.” — Eckhart Tolle',
  '“Let go of the need to control. Trust the process.” — Unknown',
];

function pickRandomPrompt(prompts: readonly string[]) {
  return prompts[Math.floor(Math.random() * prompts.length)] ?? '';
}
