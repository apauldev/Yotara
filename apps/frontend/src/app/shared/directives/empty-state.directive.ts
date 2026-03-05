import { Directive, HostBinding, Input } from '@angular/core';

@Directive({
  selector: '[appEmptyState]',
  standalone: true,
})
export class EmptyStateDirective {
  @Input() appEmptyState = false;

  @HostBinding('class.is-empty')
  get isEmpty(): boolean {
    return this.appEmptyState;
  }
}
