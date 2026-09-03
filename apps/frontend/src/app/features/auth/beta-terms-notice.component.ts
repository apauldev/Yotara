import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
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
  /** Two-way bound agreement state owned by the parent signup form. */
  readonly accepted = model(false);

  constructor() {
    void this.legalContent.load();
  }

  protected openTerms(event?: Event) {
    // The link lives inside the checkbox label — don't toggle the box.
    event?.preventDefault();
    event?.stopPropagation();
    this.termsOpen.set(true);
  }

  protected closeTerms() {
    this.termsOpen.set(false);
  }

  protected onToggle(event: Event) {
    this.accepted.set((event.target as HTMLInputElement).checked);
  }
}
