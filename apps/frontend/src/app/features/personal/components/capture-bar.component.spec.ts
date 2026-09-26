import { signal } from '@angular/core';
import { DateTime } from 'luxon';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CaptureBarComponent } from './capture-bar.component';
import { LabelService } from '../../../core/services/label.service';
import { DatePickerComponent } from '../../../shared/ui/date-picker/date-picker.component';
import { Label } from '@yotara/shared';

describe('CaptureBarComponent', () => {
  let mockLabelService: any;

  const referenceDate = DateTime.fromObject({ year: 2026, month: 9, day: 28 }, { zone: 'UTC' });

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
    fixture.componentRef.setInput('referenceDate', referenceDate);
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

  describe('Natural-language due date draft', () => {
    it('shows the matched phrase and resolved local date', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();

      const preview = fixture.debugElement.query(By.css('.capture-date-preview'));
      expect(preview).toBeTruthy();
      expect(preview.nativeElement.textContent).toContain('Friday resolves to');
      expect(preview.nativeElement.textContent).toContain('Friday, Oct 2, 2026');
      expect(fixture.componentInstance.getDueDateDraft()).toEqual(
        jasmine.objectContaining({
          value: '2026-10-02',
          source: 'inferred',
          matchedText: 'Friday',
        }),
      );
    });

    it('does not fail open when the supplied local reference is invalid', () => {
      const fixture = createFixture();
      fixture.componentRef.setInput('referenceDate', DateTime.invalid('bad reference'));
      fixture.detectChanges();
      fixture.componentInstance.setTitle('Call Sam today');

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
      expect(fixture.componentInstance.getParserResult()?.status).toBe('unsupported');
    });

    it('does not show a preview for rejected input', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.capture-date-preview'))).toBeNull();
      expect(fixture.componentInstance.getParserResult()?.status).toBe('time');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
    });

    it('explains that a time is kept as text rather than showing nothing', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');
      fixture.detectChanges();

      const note = fixture.debugElement.query(By.css('.capture-date-note'));
      expect(note).toBeTruthy();
      expect(note.nativeElement.getAttribute('role')).toBe('status');
      expect(note.nativeElement.textContent).toContain("Times aren't supported yet");

      const input = fixture.debugElement.query(By.css('input'));
      expect(input.nativeElement.getAttribute('aria-describedby')).toContain('capture-date-note');
    });

    it('explains that repeating is not set from the title', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Pay rent every friday');
      fixture.detectChanges();

      const note = fixture.debugElement.query(By.css('.capture-date-note'));
      expect(note).toBeTruthy();
      expect(note.nativeElement.textContent).toContain("Repeating isn't set from the title");
    });

    it('removes the notice once a supported phrase is used', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.capture-date-note'))).toBeTruthy();

      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.capture-date-note'))).toBeNull();
    });

    it('shows no notice for ordinary task text', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam about the project');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.capture-date-note'))).toBeNull();
    });

    it('re-evaluates an inferred date when the local reference changes', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-10-02');

      fixture.componentRef.setInput(
        'referenceDate',
        DateTime.fromObject({ year: 2026, month: 9, day: 25 }, { zone: 'UTC' }),
      );
      fixture.detectChanges();

      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-09-25');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('inferred');
    });

    it('re-evaluates the draft when the title changes', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-10-02');

      fixture.componentInstance.setTitle('Call Sam tomorrow');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-09-29');

      fixture.componentInstance.setTitle('Call Sam without a date');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
    });

    it('clears the date without submitting and keeps it cleared until the phrase changes', () => {
      const fixture = createFixture();
      const submitSpy = spyOn(fixture.componentInstance.submit, 'emit');

      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();

      const clearButton = fixture.debugElement.query(By.css('button[aria-label="Clear due date"]'));
      expect(clearButton.nativeElement.type).toBe('button');
      clearButton.nativeElement.click();
      fixture.detectChanges();

      expect(submitSpy).not.toHaveBeenCalled();
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('cleared');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('');
      expect(fixture.nativeElement.textContent).toContain('Due date cleared');

      fixture.componentInstance.setTitle('Call Sam tomorrow');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('inferred');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-09-29');
    });

    it('opens the date picker through the Change action', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();

      const picker = fixture.debugElement.query(By.directive(DatePickerComponent))
        .componentInstance as DatePickerComponent;
      const openSpy = spyOn(picker, 'open').and.callThrough();
      const changeButton = fixture.debugElement.query(
        By.css('button[aria-label="Change due date"]'),
      );

      expect(changeButton.nativeElement.type).toBe('button');
      changeButton.nativeElement.click();

      expect(openSpy).toHaveBeenCalled();
    });

    it('makes a manual date authoritative across later title edits', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();

      const picker = fixture.debugElement.query(By.directive(DatePickerComponent))
        .componentInstance as DatePickerComponent;
      picker.valueChange.emit('2026-10-05');
      fixture.detectChanges();

      expect(fixture.componentInstance.getDueDateDraft()).toEqual(
        jasmine.objectContaining({ value: '2026-10-05', source: 'manual' }),
      );

      fixture.componentInstance.setTitle('Call Sam Friday and follow up');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-10-05');
    });

    it('clears a manual date when the capture title is emptied', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();

      const picker = fixture.debugElement.query(By.directive(DatePickerComponent))
        .componentInstance as DatePickerComponent;
      picker.valueChange.emit('2026-10-05');
      fixture.componentInstance.setTitle('');
      fixture.detectChanges();

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('');
      expect(fixture.componentInstance.getParserResult()).toBeNull();
    });

    it('does not preserve a cleared phrase when its date modifier changes', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.componentInstance['clearDueDate']();
      fixture.componentInstance.setTitle('Call Sam next Friday');

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('inferred');
      expect(fixture.componentInstance.getDueDateDraft().matchedText).toBe('next Friday');
    });

    it('does not preserve a cleared phrase inside a command token', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.componentInstance['clearDueDate']();
      fixture.componentInstance.setTitle('Call Sam #friday');

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
    });

    it('preserves priority and label command tokens while inferring a date', () => {
      const fixture = createFixture();
      const title = 'Call Sam Friday !high #work';

      fixture.componentInstance.setTitle(title);

      expect(fixture.componentInstance.getTitle()).toBe(title);
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-10-02');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('inferred');
    });

    it('keeps a manually changed date clearable without reapplying the old phrase', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();

      const picker = fixture.debugElement.query(By.directive(DatePickerComponent))
        .componentInstance as DatePickerComponent;
      picker.valueChange.emit('2026-10-05');
      fixture.componentInstance['clearDueDate']();
      fixture.componentInstance.setTitle('Call Sam Friday notes');

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('cleared');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('');
    });

    it('does not infer dates from date-like command tokens', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday #friday');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('inferred');

      fixture.componentInstance.setTitle('Call Sam #friday');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
    });

    it('resets title, parser state, date draft, error, and submission mode', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.componentInstance.setError('Failed');
      fixture.componentInstance.setSubmissionType('quick');

      fixture.componentInstance.resetCapture();

      expect(fixture.componentInstance.getTitle()).toBe('');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
      expect(fixture.componentInstance.getParserResult()).toBeNull();
      expect(fixture.componentInstance.getError()).toBe('');
      expect(fixture.componentInstance.getLastSubmissionType()).toBe('default');
    });

    it('connects the preview to the capture input accessible description', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[name="captureTitle"]'));
      expect(input.nativeElement.getAttribute('aria-describedby')).toContain(
        'capture-date-preview',
      );
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
