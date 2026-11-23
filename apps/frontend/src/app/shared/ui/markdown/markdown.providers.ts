import type { Provider } from '@angular/core';
import { SANITIZE, provideMarkdown } from 'ngx-markdown';
import DOMPurify from 'dompurify';

export const MARKDOWN_UI_PROVIDERS: Provider[] = [
  ...provideMarkdown(),
  {
    provide: SANITIZE,
    useValue: (html: string) => DOMPurify.sanitize(html),
  },
];
