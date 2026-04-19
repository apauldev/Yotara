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
  templateUrl: './inbox-page.component.html',
  styleUrl: './inbox-page.component.scss',
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
