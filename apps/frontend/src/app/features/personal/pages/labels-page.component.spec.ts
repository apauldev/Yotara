import { TestBed } from '@angular/core/testing';
import { LabelsPageComponent } from './labels-page.component';

describe('LabelsPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabelsPageComponent],
    }).compileComponents();
  });

  it('renders the placeholder label summaries', () => {
    const fixture = TestBed.createComponent(LabelsPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Writing');
    expect(text).toContain('Focus');
    expect(text).toContain('Finance');
    expect(text).toContain('frontend-only');
  });
});
