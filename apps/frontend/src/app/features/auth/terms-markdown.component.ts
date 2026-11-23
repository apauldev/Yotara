import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { MARKDOWN_UI_PROVIDERS } from '../../shared/ui/markdown/markdown.providers';

@Component({
  selector: 'app-terms-markdown',
  standalone: true,
  imports: [MarkdownComponent],
  providers: [...MARKDOWN_UI_PROVIDERS],
  template: `<markdown [data]="content()" />`,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class TermsMarkdownComponent {
  readonly content = input.required<string>();
}
