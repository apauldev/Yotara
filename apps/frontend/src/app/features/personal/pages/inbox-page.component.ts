import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateTaskDto, Task, UpdateTaskDto } from '@yotara/shared';
import { ProjectService } from '../../../core/services/project.service';
import { TaskService } from '../../../core/services/task.service';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskModalComponent } from '../components/personal-task-modal.component';

@Component({
  selector: 'app-inbox-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PersonalTaskCardComponent, PersonalTaskModalComponent],
  template: `
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

      <app-personal-task-modal
        [open]="modalOpen()"
        [task]="selectedTask()"
        [initialTitle]="captureTitle()"
        [projects]="projectService.projects()"
        [error]="taskService.error()"
        (close)="closeModal()"
        (save)="saveTask($event)"
      />

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
                (select)="editTask(task)"
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
          grid-template-columns: auto minmax(0, 1fr);
        }

        .capture-actions {
          display: none;
        }

        .capture-submit {
          grid-column: 1 / -1;
        }
      }
    `,
  ],
})
export class InboxPageComponent {
  protected readonly taskService = inject(TaskService);
  protected readonly projectService = inject(ProjectService);
  protected readonly captureTitle = signal('');
  protected readonly captureError = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly selectedTask = signal<Task | null>(null);
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
    this.selectedTask.set(null);
    this.modalOpen.set(true);
  }

  protected editTask(task: Task) {
    this.captureError.set('');
    this.selectedTask.set(task);
    this.modalOpen.set(true);
  }

  protected closeModal() {
    this.modalOpen.set(false);
    this.selectedTask.set(null);
  }

  protected async saveTask(
    event:
      | { mode: 'create'; payload: CreateTaskDto }
      | { mode: 'update'; taskId: string; payload: UpdateTaskDto },
  ) {
    try {
      if (event.mode === 'create') {
        await this.taskService.createTask(event.payload);
        this.captureTitle.set('');
      } else {
        await this.taskService.updateTask(event.taskId, event.payload);
      }

      this.projectService.refreshProjects();
      this.dailyClarityPrompt.set(pickRandomPrompt(this.dailyClarityPrompts));
      this.journalPrompt.set(pickRandomPrompt(this.journalPrompts));
      this.closeModal();
    } catch {
      this.captureError.set(
        this.taskService.error() ??
          (event.mode === 'create'
            ? 'Could not save your task right now.'
            : 'Could not update your task right now.'),
      );
    }
  }
}

const DAILY_CLARITY_PROMPTS = [
  'Capture first, organize second. Keep the sanctuary light and easy to trust.',
  'One clear next step is worth more than five vague intentions.',
  'If it matters, give it a place before it starts stealing attention.',
  'A quiet list is built one honest capture at a time.',
  'Sort less in your head and more on the page.',
  'Make the next action visible enough to feel possible.',
  'You do not need to hold everything at once.',
  'Clarity grows when you name the task, not when you avoid it.',
  'A small captured task is lighter than a large mental loop.',
  'Progress begins when the task becomes concrete.',
  'Use the inbox as a landing pad, not a storage closet.',
  'The gentlest productivity system is the one you keep returning to.',
  'Leave breadcrumbs for your future self.',
  'The first draft of order is simply noticing what is here.',
  'Your attention deserves a cleaner surface.',
  'One captured thought can soften the whole day.',
  'Let the list carry the weight for a while.',
  'The calmer workflow is often the simpler one.',
  'Reduce friction before you demand discipline.',
  'A focused day is usually built from a focused first step.',
  'Write the task the way you would hand it to a trusted teammate.',
  'When in doubt, make it smaller and more specific.',
  'Trust is built when your system reflects reality.',
  'Tasks become kinder when they become clearer.',
  'Give urgency a shape before it becomes noise.',
  'A little structure can feel like a lot of relief.',
  'Momentum often hides inside the smallest captured action.',
  'Decide where this belongs, then let your mind move on.',
  'Your list should feel like support, not surveillance.',
  'The cleanest focus starts with an honest inbox.',
];

const YOTARA_JOURNAL_PROMPTS = [
  '“A calm system gives every thought a place before it becomes a burden.”',
  '“The day softens when the next step is no longer a mystery.”',
  '“Attention is easier to protect when work has a clear home.”',
  '“You do not need a perfect plan to make a graceful start.”',
  '“What is written down stops asking to be remembered.”',
  '“A quiet workflow is often just a truthful one.”',
  '“The kindest productivity is specific, visible, and forgiving.”',
  '“When the task is named, the resistance often shrinks.”',
  '“An inbox is a promise that nothing important has to drift.”',
  '“A thoughtful list can turn pressure into sequence.”',
  '“Space is created when decisions leave your head and enter your system.”',
  '“The mind steadies when it knows where unfinished things belong.”',
  '“Not everything needs urgency; most things need clarity.”',
  '“The next right action is usually smaller than the fear around it.”',
  '“Gentle structure creates room for deeper focus.”',
  '“A trusted system lets your mind return to the work itself.”',
  '“Sometimes the most productive act is defining what this really is.”',
  '“Order arrives quietly, one clarified task at a time.”',
  '“Write it simply enough that tomorrow-you feels welcomed back.”',
  '“A focused life is often a series of well-placed containers.”',
  '“Good systems do not rush you; they reveal the path.”',
  '“Completion gets easier when the work stops being abstract.”',
  '“Attention blooms in spaces that feel settled.”',
  '“The list is not the work, but it can make the work feel possible.”',
  '“What you capture today will stop echoing tomorrow.”',
  '“Let the system be steady so your mind can be creative.”',
  '“Direction becomes gentler when it becomes visible.”',
  '“The clearest days begin with the clearest commitments.”',
  '“Your thoughts deserve a softer place to land.”',
  '“The strongest momentum is often built in quiet, ordinary moments.”',
];

function pickRandomPrompt(prompts: readonly string[]) {
  return prompts[Math.floor(Math.random() * prompts.length)] ?? '';
}
