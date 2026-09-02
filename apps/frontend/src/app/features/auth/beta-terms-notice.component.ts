import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { LegalContentService } from '../../core/services/legal-content.service';
import { ModalComponent } from '../../shared/ui/modal/modal.component';

@Component({
  selector: 'app-beta-terms-notice',
  standalone: true,
  imports: [MarkdownComponent, ModalComponent],
  templateUrl: './beta-terms-notice.component.html',
  styleUrl: './beta-terms-notice.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class BetaTermsNoticeComponent {
  protected readonly legalContent = inject(LegalContentService);
  protected readonly termsOpen = signal(false);

  constructor() {
    void this.legalContent.load();
  }

  protected openTerms() {
    this.termsOpen.set(true);
  }

  protected closeTerms() {
    this.termsOpen.set(false);
  }
}
