import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CaptureBarComponent } from './capture-bar.component';
import { LabelService } from '../../../core/services/label.service';
import { Label } from '@yotara/shared';

describe('CaptureBarComponent', () => {
  let mockLabelService: any;

  const mockLabels: Label[] = [
    { id: '1', name: 'work', color: '#ff0000', userId: 'user-1' },
    { id: '2', name: 'personal', color: '#00ff00', userId: 'user-1' },
    { id: '3', name: 'health', color: '#0000ff', userId: 'user-1' },
    { id: '4', name: 'work-project', color: '#ff8800', userId: 'user-1' },
    { id: '5', name: 'ideas', color: '#8800ff', userId: 'user-1' },
  ];

  beforeEach(async () => {
    mockLabelService = {
      labels: signal(mockLabels),
    };

    await TestBed.configureTestingModule({
      imports: [CaptureBarComponent, FormsModule],
      providers: [{ provide: LabelService, useValue: mockLabelService }],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(CaptureBarComponent);
    fixture.componentRef.setInput('projects', [
      { id: 'p1', name: 'Inbox' },
      { id: 'p2', name: 'Work' },
    ]);
    fixture.componentRef.setInput('creating', false);
    fixture.componentRef.setInput('defaultProjectId', 'p1');
    fixture.detectChanges();
    return fixture;
  }

  describe('Tag suggestion insertion', () => {
    it('shows tag suggestions dropdown when typing # followed by text', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#wo';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const dropdown = fixture.debugElement.query(By.css('.tag-suggestions'));
      expect(dropdown).toBeTruthy();

      // Both 'work' and 'work-project' match 'wo'
      const items = dropdown.queryAll(By.css('li'));
      expect(items.length).toBe(2);
      expect(items[0].nativeElement.textContent).toContain('work');
    });

    it('shows multiple matching suggestions', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#w';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.tag-suggestions li'));
      expect(items.length).toBe(2);
      expect(items[0].nativeElement.textContent).toContain('work');
      expect(items[1].nativeElement.textContent).toContain('work-project');
    });

    it('hides the dropdown when no tags match', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#zzz';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const dropdown = fixture.debugElement.query(By.css('.tag-suggestions'));
      expect(dropdown).toBeNull();
    });

    it('hides the dropdown when space follows the hash term', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#work more';
      input.nativeElement.selectionStart = 10;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const dropdown = fixture.debugElement.query(By.css('.tag-suggestions'));
      expect(dropdown).toBeNull();
    });

    it('navigates suggestions with ArrowDown', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#w';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.tag-suggestions li'));
      expect(items[0].classes['suggestion-active']).toBeUndefined();
      expect(items[1].classes['suggestion-active']).toBeTrue();
    });

    it('navigates suggestions with ArrowUp', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#w';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // Move down first, then back up
      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      fixture.detectChanges();
      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.tag-suggestions li'));
      expect(items[0].classes['suggestion-active']).toBeTrue();
    });

    it('selects the active suggestion with Enter and inserts the tag', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'buy groceries #wo';
      input.nativeElement.selectionStart = 20;
      input.nativeElement.selectionEnd = 20;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('buy groceries #work ');
    });

    it('selects the active suggestion with Tab and inserts the tag', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#wo';
      input.nativeElement.selectionStart = 4;
      input.nativeElement.selectionEnd = 4;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('#work ');
    });

    it('dismisses the suggestion dropdown with Escape', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#w';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tag-suggestions'))).toBeTruthy();

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tag-suggestions'))).toBeNull();
    });

    it('selects a suggestion by clicking on it', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'call doctor #h';
      input.nativeElement.selectionStart = 16;
      input.nativeElement.selectionEnd = 16;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.tag-suggestions li'));
      expect(items.length).toBe(1);
      items[0].nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('call doctor #health ');
    });
  });

  describe('Submission mode handling', () => {
    it('sets submission type to quick and emits submit when Add Task is clicked', () => {
      const fixture = createFixture();
      spyOn(fixture.componentInstance.submit, 'emit');

      const quickBtn = fixture.debugElement.query(By.css('.capture-submit-quick'));
      quickBtn.nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.getLastSubmissionType()).toBe('quick');
      expect(fixture.componentInstance.submit.emit).toHaveBeenCalled();
    });

    it('sets submission type to capture and emits submit when Add task with details is clicked', () => {
      const fixture = createFixture();
      spyOn(fixture.componentInstance.submit, 'emit');

      const detailsBtn = fixture.debugElement.query(By.css('.capture-submit-details'));
      detailsBtn.nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.getLastSubmissionType()).toBe('capture');
      expect(fixture.componentInstance.submit.emit).toHaveBeenCalled();
    });

    it('sets submission type to default when Enter is pressed in the input', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));

      // Set a non-default mode first
      fixture.componentInstance.setSubmissionType('quick');
      expect(fixture.componentInstance.getLastSubmissionType()).toBe('quick');

      // Press Enter (the template has (keydown.enter)="lastSubmissionType = 'default'")
      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.getLastSubmissionType()).toBe('default');
    });

    it('resetSubmissionType sets mode back to default', () => {
      const fixture = createFixture();

      fixture.componentInstance.setSubmissionType('capture');
      expect(fixture.componentInstance.getLastSubmissionType()).toBe('capture');

      fixture.componentInstance.resetSubmissionType();
      expect(fixture.componentInstance.getLastSubmissionType()).toBe('default');
    });

    it('clears title and resets tag search on clearTitle', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('test #work');
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'test #work';
      input.nativeElement.selectionStart = 11;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.tag-suggestions'))).toBeTruthy();

      fixture.componentInstance.clearTitle();
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('');
      expect(fixture.debugElement.query(By.css('.tag-suggestions'))).toBeNull();
    });

    it('disables buttons when creating input is true', () => {
      const fixture = createFixture();
      fixture.componentRef.setInput('creating', true);
      fixture.detectChanges();

      const quickBtn = fixture.debugElement.query(By.css('.capture-submit-quick'));
      const detailsBtn = fixture.debugElement.query(By.css('.capture-submit-details'));

      expect(quickBtn.nativeElement.disabled).toBeTrue();
      expect(detailsBtn.nativeElement.disabled).toBeTrue();
    });

    it('shows error message when error is set', () => {
      const fixture = createFixture();

      fixture.componentInstance.setError('Something went wrong');
      fixture.detectChanges();

      const errorEl = fixture.debugElement.query(By.css('#capture-error'));
      expect(errorEl).toBeTruthy();
      expect(errorEl.nativeElement.textContent).toContain('Something went wrong');
    });

    it('clears error message when clearError is called', () => {
      const fixture = createFixture();

      fixture.componentInstance.setError('Something went wrong');
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('#capture-error'))).toBeTruthy();

      fixture.componentInstance.clearError();
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('#capture-error'))).toBeNull();
    });
  });
});
