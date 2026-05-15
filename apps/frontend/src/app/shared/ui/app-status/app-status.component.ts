import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { animate, style, transition, trigger } from '@angular/animations';
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { StatusService } from '../../../core/services/status.service';

@Component({
  selector: 'app-status',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './app-status.component.html',
  styleUrl: './app-status.component.css',
  animations: [
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
export class AppStatusComponent {
  protected readonly statusService = inject(StatusService);

  // Icons
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faXmark = faXmark;
}
