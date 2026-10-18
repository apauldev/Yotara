import { animate, style, transition, trigger } from '@angular/animations';

/**
 * Soft enter and a slow fade-out. Applied to list items so a task that leaves a
 * list (completed, scheduled, removed) eases out instead of popping.
 */
export const fadeCollapse = trigger('fadeCollapse', [
  transition(':enter', [style({ opacity: 0 }), animate('120ms ease-out', style({ opacity: 1 }))]),
  transition(':leave', [
    animate('260ms ease-in', style({ opacity: 0, transform: 'translateY(-2px)' })),
  ]),
]);
