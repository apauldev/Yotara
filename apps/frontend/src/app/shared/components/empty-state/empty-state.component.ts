import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() icon?: IconDefinition;
}
