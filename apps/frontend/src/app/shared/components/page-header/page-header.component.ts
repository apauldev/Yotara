import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header>
      <h1>{{ title }}</h1>
      <p class="tagline">{{ subtitle }}</p>
    </header>
  `,
  styles: [
    `
      .tagline {
        color: #6b7280;
        font-style: italic;
        margin-top: -0.5rem;
      }
    `,
  ],
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
