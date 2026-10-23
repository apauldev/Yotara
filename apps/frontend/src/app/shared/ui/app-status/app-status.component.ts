import { Component, inject, ChangeDetectionStrategy, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { animate, style, transition, trigger, type AnimationEvent } from '@angular/animations';
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { StatusService, type StatusMessage } from '../../../core/services/status.service';

@Component({
  selector: 'app-status',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './app-status.component.html',
  styleUrl: './app-status.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [
    trigger('loadingBar', [
      transition(':leave', [animate('250ms ease-out', style({ opacity: 0 }))]),
    ]),
    trigger('toastAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px) scale(0.95)' }),
        animate(
          '250ms cubic-bezier(0, 0, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateY(10px) scale(0.95)' }),
        ),
      ]),
    ]),
  ],
})
export class AppStatusComponent implements OnDestroy {
  protected readonly statusService = inject(StatusService);

  // Icons
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faXmark = faXmark;

  /**
   * CSS removes transform motion in this mode while the enter/leave opacity
   * transition and dismissal timing continue to work.
   */
  protected readonly reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly hovered = new Set<string>();
  private readonly focused = new Set<string>();
  private readonly pendingActions = new Map<string, () => void>();

  constructor() {
    effect(() => {
      const activeIds = new Set(this.statusService.toasts().map((toast) => toast.id));
      for (const id of this.hovered) {
        if (!activeIds.has(id)) this.hovered.delete(id);
      }
      for (const id of this.focused) {
        if (!activeIds.has(id)) this.focused.delete(id);
      }
    });
  }

  ngOnDestroy() {
    this.hovered.clear();
    this.focused.clear();
    this.pendingActions.clear();
    this.statusService.clearAll();
  }

  protected pauseToast(id: string) {
    this.statusService.pause(id);
  }

  protected enterToast(id: string) {
    this.hovered.add(id);
    this.pauseToast(id);
  }

  protected leaveToast(id: string) {
    this.hovered.delete(id);
    this.resumeToast(id);
  }

  protected focusToast(id: string) {
    this.focused.add(id);
    this.pauseToast(id);
  }

  protected blurToast(id: string, event: FocusEvent) {
    const host = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const next = event.relatedTarget;

    // Focus moving between controls inside the same toast does not resume it.
    if (host && next instanceof Node && host.contains(next)) {
      return;
    }

    this.focused.delete(id);
    this.resumeToast(id);
  }

  protected runAction(toast: StatusMessage) {
    const action = toast.action;
    if (!action) return;

    // A leaving toast can remain in the DOM during its exit animation. Never
    // let its old action fire after the toast has been replaced or dismissed.
    if (!this.statusService.toasts().some((active) => active.id === toast.id)) return;

    this.statusService.pause(toast.id);
    this.pendingActions.set(toast.id, action.callback);
    this.statusService.remove(toast.id);
  }

  protected onToastAnimationDone(id: string, event: AnimationEvent) {
    if (event.phaseName !== 'done' || event.toState !== 'void') return;

    const callback = this.pendingActions.get(id);
    if (!callback) return;

    this.pendingActions.delete(id);
    callback();
  }

  private resumeToast(id: string) {
    if (this.hovered.has(id) || this.focused.has(id)) return;
    this.statusService.resume(id);
  }
}
