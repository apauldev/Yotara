import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { InsightPanelComponent } from './insight-panel.component';
import { InsightType } from '../pages/task-list-page/types';

describe('InsightPanelComponent', () => {
  function create(type: InsightType = 'clarity', prompt = 'A short test quote.') {
    const fixture = TestBed.createComponent(InsightPanelComponent);
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('prompt', prompt);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the full prompt in a focusable tooltip', () => {
    const fixture = create('journal', 'A longer quote that may need more than three lines.');
    const quote = fixture.debugElement.query(By.css('.insight-quote'));
    const tooltip = fixture.debugElement.query(By.css('.insight-tooltip'));

    expect(quote.nativeElement.getAttribute('tabindex')).toBe('0');
    expect(quote.nativeElement.getAttribute('aria-describedby')).toBe(tooltip.nativeElement.id);
    expect(tooltip.nativeElement.getAttribute('role')).toBe('tooltip');
    expect(tooltip.nativeElement.getAttribute('aria-hidden')).toBeNull();
    expect(tooltip.nativeElement.textContent.trim()).toBe(
      'A longer quote that may need more than three lines.',
    );
  });

  it('renders the matching heading for each insight type', () => {
    expect(create('clarity').nativeElement.textContent).toContain('Daily Clarity');
    expect(create('journal').nativeElement.textContent).toContain('The Yotara Journal');
  });

  it('emits dismiss when the close button is clicked', () => {
    const fixture = create();
    spyOn(fixture.componentInstance.dismiss, 'emit');

    fixture.debugElement.query(By.css('.insight-dismiss')).nativeElement.click();

    expect(fixture.componentInstance.dismiss.emit).toHaveBeenCalled();
  });
});
