import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMarkdown } from 'ngx-markdown';
import { signal } from '@angular/core';
import { LegalContentService, type LegalDocument } from '../../core/services/legal-content.service';
import { BetaTermsNoticeComponent } from './beta-terms-notice.component';

const legalDocument: LegalDocument = {
  type: 'terms-of-service',
  version: '1.0',
  effectiveDate: '2026-09-02',
  title: 'Yotara Beta Terms of Service',
  content: '# Terms\n\nUse the beta responsibly.',
};

describe('BetaTermsNoticeComponent', () => {
  let fixture: ComponentFixture<BetaTermsNoticeComponent>;
  let configured: ReturnType<typeof signal<boolean>>;
  let document: ReturnType<typeof signal<LegalDocument | null>>;
  let load: jasmine.Spy;

  beforeEach(async () => {
    configured = signal(false);
    document = signal<LegalDocument | null>(null);
    load = jasmine.createSpy('load').and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [BetaTermsNoticeComponent],
      providers: [
        provideMarkdown(),
        {
          provide: LegalContentService,
          useValue: { configured, document, load },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BetaTermsNoticeComponent);
  });

  it('does not render when legal content is not configured', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.terms-notice')).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('renders and opens the configured terms document', async () => {
    configured.set(true);
    document.set(legalDocument);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Beta Terms of Service');

    fixture.debugElement.query(By.css('.terms-link')).nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Use the beta responsibly.');

    fixture.debugElement.query(By.css('.close-button')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
