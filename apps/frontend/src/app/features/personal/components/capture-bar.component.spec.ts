import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DateTime } from 'luxon';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { CaptureBarComponent } from './capture-bar.component';
import { LabelService } from '../../../core/services/label.service';
import { DatePickerComponent } from '../../../shared/ui/date-picker/date-picker.component';
import { parseTaskCommand } from '../utils/task-command-parser';
import { Label } from '@yotara/shared';

describe('CaptureBarComponent', () => {
  let mockLabelService: any;

  const referenceDate = DateTime.fromObject({ year: 2026, month: 9, day: 28 }, { zone: 'UTC' });

  const mockLabels: Label[] = [
    { id: '1', name: 'work', color: '#ff0000', icon: 'briefcase', pinned: false, userId: 'user-1' },
    { id: '2', name: 'personal', color: '#00ff00', icon: 'heart', pinned: false, userId: 'user-1' },
    {
      id: '3',
      name: 'health',
      color: '#0000ff',
      icon: 'dumbbell',
      pinned: false,
      userId: 'user-1',
    },
    {
      id: '4',
      name: 'work-project',
      color: '#ff8800',
      icon: 'laptop-code',
      pinned: false,
      userId: 'user-1',
    },
    {
      id: '5',
      name: 'ideas',
      color: '#8800ff',
      icon: 'lightbulb',
      pinned: false,
      userId: 'user-1',
    },
  ];

  beforeEach(async () => {
    mockLabelService = {
      labels: signal(mockLabels),
      createLabel: jasmine.createSpy('createLabel'),
      refresh: jasmine.createSpy('refresh'),
    };

    await TestBed.configureTestingModule({
      imports: [CaptureBarComponent, FormsModule],
      providers: [{ provide: LabelService, useValue: mockLabelService }],
    }).compileComponents();
  });

  const defaultProjects = [
    { id: 'p1', name: 'Inbox' },
    { id: 'p2', name: 'Work' },
  ];

  function createFixture(projects = defaultProjects) {
    const fixture = TestBed.createComponent(CaptureBarComponent);
    fixture.componentRef.setInput('projects', projects);
    fixture.componentRef.setInput('creating', false);
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

      // Both 'work' and 'work-project' match 'wo', plus the create option.
      const items = dropdown.queryAll(By.css('li'));
      expect(items.length).toBe(3);
      expect(items[0].nativeElement.textContent).toContain('work');
      expect(items[2].nativeElement.textContent).toContain('Create');
    });

    it('shows multiple matching suggestions', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#w';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.tag-suggestions li'));
      expect(items.length).toBe(3);
      expect(items[0].nativeElement.textContent).toContain('work');
      expect(items[1].nativeElement.textContent).toContain('work-project');
    });

    it('offers to create a label when no tags match', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#zzz';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const create = fixture.debugElement.query(By.css('.tag-suggestions .suggestion-create'));
      expect(create).toBeTruthy();
      expect(create.nativeElement.textContent).toContain('Create “zzz”');
    });

    it('creates the typed label with its suggested icon and inserts the tag', async () => {
      mockLabelService.createLabel.and.resolveTo({
        id: 'new-label',
        name: 'writing',
        color: '#82d7a9',
        icon: 'pen',
        pinned: false,
        userId: 'user-1',
      });
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'focus time #writing';
      input.nativeElement.selectionStart = input.nativeElement.value.length;
      input.nativeElement.selectionEnd = input.nativeElement.value.length;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.componentInstance.setTitle('focus time #writing');
      fixture.detectChanges();

      const create = fixture.debugElement.query(By.css('.suggestion-create'));
      create.nativeElement.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(mockLabelService.createLabel).toHaveBeenCalledWith({
        name: 'writing',
        icon: 'pen',
      });
      expect(fixture.componentInstance.getTitle()).toBe('focus time #writing ');
      expect(fixture.componentInstance.getCreatedLabels()).toEqual([
        { id: 'new-label', name: 'writing' },
      ]);
    });

    it('selects the existing label when capture creation hits a 409', async () => {
      mockLabelService.createLabel.and.rejectWith(
        new HttpErrorResponse({
          status: 409,
          error: { existingLabel: { id: 'existing-label', name: 'hidden' } },
        }),
      );
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#hidden';
      input.nativeElement.selectionStart = 7;
      input.nativeElement.selectionEnd = 7;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.componentInstance.setTitle('#hidden');
      fixture.detectChanges();

      const create = fixture.debugElement.query(By.css('.suggestion-create'));
      create.nativeElement.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(mockLabelService.refresh).toHaveBeenCalled();
      expect(fixture.componentInstance.getCreatedLabels()).toEqual([
        { id: 'existing-label', name: 'hidden' },
      ]);
      expect(fixture.componentInstance.getTitle()).toBe('#hidden ');
    });

    it('does not mangle a token that grows while creation is in flight', async () => {
      let resolveCreate!: (label: Label) => void;
      mockLabelService.createLabel.and.returnValue(
        new Promise<Label>((resolve) => {
          resolveCreate = resolve;
        }),
      );
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));

      input.nativeElement.value = '#tea';
      input.nativeElement.selectionStart = 4;
      input.nativeElement.selectionEnd = 4;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.componentInstance.setTitle('#tea');
      fixture.detectChanges();

      const create = fixture.debugElement.query(By.css('.suggestion-create'));
      create.nativeElement.click();

      // The user keeps typing while the label request is still pending.
      input.nativeElement.value = '#teal';
      input.nativeElement.selectionStart = 5;
      input.nativeElement.selectionEnd = 5;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.componentInstance.setTitle('#teal');
      fixture.detectChanges();

      resolveCreate({
        id: 'new-label',
        name: 'tea',
        color: '#82d7a9',
        icon: 'tag',
        pinned: false,
        userId: 'user-1',
      });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('#teal');
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

    it('exposes the active label option through aria-selected and aria-activedescendant', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = '#w';
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(input.nativeElement.getAttribute('aria-activedescendant')).toBe(
        'capture-tag-suggestion-0',
      );
      let items = fixture.debugElement.queryAll(By.css('.tag-suggestions li'));
      expect(items[0].nativeElement.getAttribute('aria-selected')).toBe('true');
      expect(items[1].nativeElement.getAttribute('aria-selected')).toBe('false');

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      fixture.detectChanges();

      items = fixture.debugElement.queryAll(By.css('.tag-suggestions li'));
      expect(items[0].nativeElement.getAttribute('aria-selected')).toBe('false');
      expect(items[1].nativeElement.getAttribute('aria-selected')).toBe('true');
      expect(input.nativeElement.getAttribute('aria-activedescendant')).toBe(
        'capture-tag-suggestion-1',
      );
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
      expect(items.length).toBe(2);
      expect(items[0].nativeElement.textContent).toContain('health');
      items[0].nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('call doctor #health ');
    });
  });

  describe('Project suggestion insertion', () => {
    it('opens project suggestions when typing @ followed by text', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file draft @w';
      input.nativeElement.selectionStart = 13;
      input.nativeElement.selectionEnd = 13;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const dropdown = fixture.debugElement.query(By.css('.project-suggestions'));
      expect(dropdown).toBeTruthy();
      const items = dropdown.queryAll(By.css('li'));
      expect(items.length).toBe(1);
      expect(items[0].nativeElement.textContent).toContain('Work');
    });

    it('hides projects whose names the @token grammar cannot read back', () => {
      const fixture = createFixture([
        { id: 'p1', name: 'Inbox' },
        { id: 'p2', name: 'Garden' },
        { id: 'p3', name: 'Garden Renovation' },
        { id: 'p4', name: 'Café' },
        { id: 'p5', name: 'Q1-' },
      ]);
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'plan @';
      input.nativeElement.selectionStart = 6;
      input.nativeElement.selectionEnd = 6;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // Garden Renovation (space), Café (non-ASCII) and Q1- (trailing hyphen)
      // cannot round-trip through [\w-]+\b, so offering them would silently
      // misfile the task or mangle the title on submit.
      const items = fixture.debugElement.queryAll(By.css('.project-suggestions li'));
      expect(items.length).toBe(2);
      const names = items.map((item) => item.nativeElement.textContent.trim());
      expect(names).toEqual(['@Inbox', '@Garden']);
    });

    it('offers a safe project that substring-matches an unsafe sibling', () => {
      const fixture = createFixture([
        { id: 'p1', name: 'Garden' },
        { id: 'p2', name: 'Garden Renovation' },
      ]);
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'plan @gar';
      input.nativeElement.selectionStart = 9;
      input.nativeElement.selectionEnd = 9;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.project-suggestions li'));
      expect(items.length).toBe(1);
      expect(items[0].nativeElement.textContent).toContain('Garden');
      expect(items[0].nativeElement.textContent).not.toContain('Renovation');
    });

    it('shows the no-match row when every match is inline-unsafe', () => {
      const fixture = createFixture([
        { id: 'p1', name: 'Inbox' },
        { id: 'p2', name: 'Café' },
      ]);
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'plan @ca';
      input.nativeElement.selectionStart = 8;
      input.nativeElement.selectionEnd = 8;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // 'Café' substring-matches the query but cannot be inserted, so the
      // honest answer is the muted no-match row rather than a broken token.
      const dropdown = fixture.debugElement.query(By.css('.project-suggestions'));
      expect(dropdown).toBeTruthy();
      expect(dropdown.queryAll(By.css('li')).length).toBe(1);
      const empty = dropdown.query(By.css('.suggestion-empty'));
      expect(empty).toBeTruthy();
      expect(empty.nativeElement.textContent).toContain('No project named');
    });

    it('inserts only @tokens the parser reads back unchanged', () => {
      const projects = [
        { id: 'p1', name: 'Inbox' },
        { id: 'p2', name: 'Garden' },
        { id: 'p3', name: 'Garden Renovation' },
        { id: 'p4', name: 'Café' },
        { id: 'p5', name: 'Q1-' },
      ];
      const fixture = createFixture(projects);
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'plan @';
      input.nativeElement.selectionStart = 6;
      input.nativeElement.selectionEnd = 6;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.project-suggestions li'));
      expect(items.length).toBe(2);
      const knownProjectNames = projects.map((project) => project.name);
      for (const item of items) {
        const token = item.nativeElement.textContent.trim();
        const parsed = parseTaskCommand(`file ${token} now`, { knownProjectNames });
        expect(parsed.projectName).toBe(token.slice(1));
        expect(parsed.title).toBe('file now');
      }
    });

    it('does not suggest a project while typing the local part of an email', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      fixture.componentInstance.setTitle('email bob@exa');
      fixture.detectChanges();
      input.nativeElement.value = 'email bob@exa';
      input.nativeElement.selectionStart = 13;
      input.nativeElement.selectionEnd = 13;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // The @ is mid-word, so it never starts a project search even though the
      // caret sits immediately after it.
      expect(fixture.debugElement.query(By.css('.project-suggestions'))).toBeNull();
      const hint = fixture.debugElement.query(By.css('.capture-hint'));
      expect(hint.nativeElement.textContent).toContain('use # for labels');
    });

    it('does not project-highlight an address-style @ mid-word', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      fixture.componentInstance.setTitle('email bob@example later');
      fixture.detectChanges();

      input.nativeElement.selectionStart = 23;
      input.nativeElement.selectionEnd = 23;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const highlighter = fixture.debugElement.query(By.css('.capture-highlighter'));
      expect(highlighter.nativeElement.innerHTML).not.toContain('hl-project');
    });

    it('shows a muted no-match row instead of a create affordance', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file draft @zzz';
      input.nativeElement.selectionStart = 15;
      input.nativeElement.selectionEnd = 15;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const dropdown = fixture.debugElement.query(By.css('.project-suggestions'));
      expect(dropdown).toBeTruthy();
      const empty = dropdown.query(By.css('.suggestion-empty'));
      expect(empty).toBeTruthy();
      expect(empty.nativeElement.textContent).toContain('No project named');
      expect(empty.nativeElement.textContent).toContain('zzz');
      expect(dropdown.query(By.css('.suggestion-create'))).toBeNull();
    });

    it('gives the no-match row full active-option semantics', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file draft @zzz';
      input.nativeElement.selectionStart = 15;
      input.nativeElement.selectionEnd = 15;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const empty = fixture.debugElement.query(By.css('.project-suggestions .suggestion-empty'));
      expect(empty.nativeElement.id).toBe('capture-project-suggestion-0');
      expect(empty.nativeElement.getAttribute('aria-selected')).toBe('true');
      expect(input.nativeElement.getAttribute('aria-activedescendant')).toBe(
        'capture-project-suggestion-0',
      );
    });

    it('closes the project list from the no-match row without touching the title', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('file draft @zzz');
      fixture.detectChanges();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file draft @zzz';
      input.nativeElement.selectionStart = 15;
      input.nativeElement.selectionEnd = 15;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const dropdown = fixture.debugElement.query(By.css('.project-suggestions'));
      expect(dropdown).toBeTruthy();

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('file draft @zzz');
      expect(fixture.debugElement.query(By.css('.project-suggestions'))).toBeNull();
    });

    it('selects the active project with Enter and inserts the token', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file draft @wo';
      input.nativeElement.selectionStart = 14;
      input.nativeElement.selectionEnd = 14;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('file draft @Work ');
      expect(fixture.debugElement.query(By.css('.project-suggestions'))).toBeNull();
    });

    it('replaces the typed partial token at the caret without touching the rest', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('file @wo quickly now');
      fixture.detectChanges();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file @wo quickly now';
      input.nativeElement.selectionStart = 8;
      input.nativeElement.selectionEnd = 8;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('file @Work quickly now');
    });

    it('navigates project suggestions with ArrowDown', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file @';
      input.nativeElement.selectionStart = 6;
      input.nativeElement.selectionEnd = 6;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.project-suggestions li'));
      expect(items.length).toBe(2);
      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      fixture.detectChanges();

      const activeItems = fixture.debugElement.queryAll(By.css('.project-suggestions li'));
      expect(activeItems[0].classes['suggestion-active']).toBeUndefined();
      expect(activeItems[1].classes['suggestion-active']).toBeTrue();
    });

    it('exposes the active project option and clears it on Escape', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file @';
      input.nativeElement.selectionStart = 6;
      input.nativeElement.selectionEnd = 6;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(input.nativeElement.getAttribute('aria-activedescendant')).toBe(
        'capture-project-suggestion-0',
      );
      let items = fixture.debugElement.queryAll(By.css('.project-suggestions li'));
      expect(items[0].nativeElement.getAttribute('aria-selected')).toBe('true');
      expect(items[1].nativeElement.getAttribute('aria-selected')).toBe('false');

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      fixture.detectChanges();

      items = fixture.debugElement.queryAll(By.css('.project-suggestions li'));
      expect(items[1].nativeElement.getAttribute('aria-selected')).toBe('true');
      expect(input.nativeElement.getAttribute('aria-activedescendant')).toBe(
        'capture-project-suggestion-1',
      );

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(input.nativeElement.getAttribute('aria-activedescendant')).toBeNull();
    });

    it('selects a project suggestion by clicking on it', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file draft @';
      input.nativeElement.selectionStart = 12;
      input.nativeElement.selectionEnd = 12;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const items = fixture.debugElement.queryAll(By.css('.project-suggestions li'));
      items[1].nativeElement.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.getTitle()).toBe('file draft @Work ');
    });

    it('dismisses project suggestions with Escape and keeps the title', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('file draft @w');
      fixture.detectChanges();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file draft @w';
      input.nativeElement.selectionStart = 13;
      input.nativeElement.selectionEnd = 13;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.project-suggestions'))).toBeTruthy();

      input.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.project-suggestions'))).toBeNull();
      expect(fixture.componentInstance.getTitle()).toBe('file draft @w');
    });

    it('does not offer project suggestions while a later # hashtag is active', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      input.nativeElement.value = 'file @work #';
      input.nativeElement.selectionStart = 12;
      input.nativeElement.selectionEnd = 12;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      // '#' is closest to the caret, so the tag list owns the suggestions.
      const tagList = fixture.debugElement.query(
        By.css('.tag-suggestions:not(.project-suggestions)'),
      );
      expect(tagList).toBeTruthy();
      const list = fixture.debugElement.query(By.css('.project-suggestions'));
      if (list) {
        expect(list.queryAll(By.css('li')).length).toBe(0);
      }
      expect(list === null || list.queryAll(By.css('li')).length === 0).toBeTrue();
    });
  });

  describe('Inline command guidance', () => {
    it('shows the inline-command tip while typing and hides it when the field is empty', () => {
      const fixture = createFixture();
      expect(fixture.debugElement.query(By.css('.capture-hint'))).toBeNull();

      fixture.componentInstance.setTitle('Water the plants');
      fixture.detectChanges();
      const hint = fixture.debugElement.query(By.css('.capture-hint'));
      expect(hint).toBeTruthy();
      expect(hint.nativeElement.textContent).toContain('# for labels');
      expect(hint.nativeElement.textContent).toContain('@ for projects');
      expect(hint.nativeElement.textContent).toContain('!high');

      fixture.componentInstance.setTitle('');
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.capture-hint'))).toBeNull();
    });

    it('switches to choose-a-label guidance while the caret is in a # token', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      fixture.componentInstance.setTitle('file draft');
      fixture.detectChanges();

      input.nativeElement.value = 'file draft #w';
      input.nativeElement.selectionStart = 13;
      input.nativeElement.selectionEnd = 13;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const hint = fixture.debugElement.query(By.css('.capture-hint'));
      expect(hint.nativeElement.textContent).toContain('Choose or create a label for this task');
    });

    it('switches to choose-a-project guidance while the caret is in an @ token', () => {
      const fixture = createFixture();
      const input = fixture.debugElement.query(By.css('input'));
      fixture.componentInstance.setTitle('file draft');
      fixture.detectChanges();

      input.nativeElement.value = 'file draft @w';
      input.nativeElement.selectionStart = 13;
      input.nativeElement.selectionEnd = 13;
      input.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const hint = fixture.debugElement.query(By.css('.capture-hint'));
      expect(hint.nativeElement.textContent).toContain('Choose a project for this task');
      expect(hint.nativeElement.getAttribute('aria-live')).toBe('polite');
    });

    it('ties the inline hint to the accessible description of the input', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Water the plants');
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input[name="captureTitle"]'));
      expect(input.nativeElement.getAttribute('aria-describedby')).toContain('capture-inline-hint');
    });

    it('shows the muted won-t-apply style for an unresolved token', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('go to meeting !admin');
      fixture.detectChanges();

      const highlighter = fixture.debugElement.query(By.css('.capture-highlighter'));
      expect(highlighter.nativeElement.innerHTML).toContain(
        '<span class="hl-unresolved">!admin</span>',
      );
    });

    it('colors a resolved @project token differently from unresolved ones', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('file into @Work and @Later');
      fixture.detectChanges();

      const highlighter = fixture.debugElement.query(By.css('.capture-highlighter'));
      expect(highlighter.nativeElement.innerHTML).toContain(
        '<span class="hl-project">@Work</span>',
      );
      expect(highlighter.nativeElement.innerHTML).toContain(
        '<span class="hl-unresolved">@Later</span>',
      );
    });

    it('tints a resolved label token with its own color', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('fix the #work bug');
      fixture.detectChanges();

      const highlighter = fixture.debugElement.query(By.css('.capture-highlighter'));
      expect(highlighter.nativeElement.innerHTML).toContain(
        '<span class="hl-label" style="--token-color:#ff0000">#work</span>',
      );
    });

    it('tints a resolved project token with the project palette color', () => {
      const fixture = TestBed.createComponent(CaptureBarComponent);
      fixture.componentRef.setInput('projects', [{ id: 'p2', name: 'Work', color: 'teal' }]);
      fixture.componentRef.setInput('creating', false);
      fixture.componentRef.setInput('referenceDate', referenceDate);
      fixture.detectChanges();
      fixture.componentInstance.setTitle('file into @Work');
      fixture.detectChanges();

      const highlighter = fixture.debugElement.query(By.css('.capture-highlighter'));
      expect(highlighter.nativeElement.innerHTML).toContain(
        '<span class="hl-project" style="--token-color:#2d7b75">@Work</span>',
      );
    });

    it('keeps the date preview when a capture token follows the phrase', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('go to meeting tomorrow at 9am @Work');
      fixture.detectChanges();

      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-09-29');
      expect(fixture.componentInstance.getDueDateDraft().dueTime).toBe('09:00');
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
          dueTime: null,
          source: 'inferred',
          matchedText: 'Friday',
        }),
      );
    });

    it('shows the matched phrase with its resolved time', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');
      fixture.detectChanges();

      const preview = fixture.debugElement.query(By.css('.capture-date-preview'));
      expect(preview).toBeTruthy();
      expect(preview.nativeElement.textContent).toContain('Friday at 3pm resolves to');
      expect(preview.nativeElement.textContent).toContain('Friday, Oct 2, 2026, 3:00 PM');
      expect(fixture.componentInstance.getDueDateDraft()).toEqual(
        jasmine.objectContaining({
          value: '2026-10-02',
          dueTime: '15:00',
          source: 'inferred',
          matchedText: 'Friday at 3pm',
        }),
      );
    });

    it('resolves a time that precedes the date phrase', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Go to dentist at 5pm Friday');
      fixture.detectChanges();

      const preview = fixture.debugElement.query(By.css('.capture-date-preview'));
      expect(preview.nativeElement.textContent).toContain('at 5pm Friday resolves to');
      expect(preview.nativeElement.textContent).toContain('5:00 PM');
      expect(fixture.componentInstance.getDueDateDraft()).toEqual(
        jasmine.objectContaining({
          value: '2026-10-02',
          dueTime: '17:00',
          source: 'inferred',
          matchedText: 'at 5pm Friday',
        }),
      );
    });

    it('preserves an inferred time when the date is changed manually', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');
      fixture.detectChanges();

      const picker = fixture.debugElement.query(By.directive(DatePickerComponent))
        .componentInstance as DatePickerComponent;
      picker.valueChange.emit('2026-10-05');
      fixture.detectChanges();

      expect(fixture.componentInstance.getDueDateDraft()).toEqual(
        jasmine.objectContaining({
          value: '2026-10-05',
          dueTime: '15:00',
          source: 'manual',
        }),
      );
      const preview = fixture.debugElement.query(By.css('.capture-date-preview'));
      expect(preview.nativeElement.textContent).toContain('3:00 PM');
    });

    it('drops the time when the phrase no longer carries one', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');
      expect(fixture.componentInstance.getDueDateDraft().dueTime).toBe('15:00');

      fixture.componentInstance.setTitle('Call Sam Friday');

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('inferred');
      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-10-02');
      expect(fixture.componentInstance.getDueDateDraft().dueTime).toBeNull();
    });

    it('clears the inferred time together with the date', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');

      fixture.componentInstance['clearDueDate']();

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('cleared');
      expect(fixture.componentInstance.getDueDateDraft().dueTime).toBeNull();
    });

    it('keeps the resolved time when the local reference changes', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');

      fixture.componentRef.setInput(
        'referenceDate',
        DateTime.fromObject({ year: 2026, month: 9, day: 25 }, { zone: 'UTC' }),
      );
      fixture.detectChanges();

      expect(fixture.componentInstance.getDueDateDraft().value).toBe('2026-09-25');
      expect(fixture.componentInstance.getDueDateDraft().dueTime).toBe('15:00');
    });

    it('does not fail open when the supplied local reference is invalid', () => {
      const fixture = createFixture();
      fixture.componentRef.setInput('referenceDate', DateTime.invalid('bad reference'));
      fixture.detectChanges();
      fixture.componentInstance.setTitle('Call Sam today');

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
      expect(fixture.componentInstance.getParserResult()?.status).toBe('unsupported');
    });

    it('does not infer a valid date while an invalid relative expression remains', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam in 0 days Friday');
      fixture.detectChanges();

      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
      expect(fixture.componentInstance.getParserResult()?.status).toBe('unsupported');
      expect(fixture.debugElement.query(By.css('.capture-date-preview'))).toBeNull();
    });

    it('does not show a preview for rejected input', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday morning');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.capture-date-preview'))).toBeNull();
      expect(fixture.componentInstance.getParserResult()?.status).toBe('time');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
    });

    it('explains that a date and exact time are required rather than showing nothing', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday morning');
      fixture.detectChanges();

      const note = fixture.debugElement.query(By.css('.capture-date-note'));
      expect(note).toBeTruthy();
      expect(note.nativeElement.getAttribute('role')).toBe('status');
      expect(note.nativeElement.textContent).toContain(
        'To set a timed due date, include a date and exact time (e.g. Friday at 3pm)',
      );

      const input = fixture.debugElement.query(By.css('input'));
      expect(input.nativeElement.getAttribute('aria-describedby')).toContain('capture-date-note');
    });

    it('explains why a standalone exact time is kept as text', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Set a reminder for 9am');
      fixture.detectChanges();

      const note = fixture.debugElement.query(By.css('.capture-date-note'));
      expect(note).toBeTruthy();
      expect(note.nativeElement.textContent).toContain('include a date and exact time');
      expect(fixture.componentInstance.getDueDateDraft().source).toBe('none');
    });

    it('explains that repeating is not set from the title', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Pay rent every friday');
      fixture.detectChanges();

      const note = fixture.debugElement.query(By.css('.capture-date-note'));
      expect(note).toBeTruthy();
      expect(note.nativeElement.textContent).toContain("Repeating isn't set from the title");
    });

    it('removes the notice once an exact time is used', () => {
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday morning');
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.capture-date-note'))).toBeTruthy();

      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('.capture-date-note'))).toBeNull();
      expect(fixture.debugElement.query(By.css('.capture-date-preview'))).toBeTruthy();
    });

    it('warns that a picked-up time may not fire when the browser has no timezone', () => {
      spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').and.returnValue(
        {} as Intl.ResolvedDateTimeFormatOptions,
      );
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday at 3pm');
      fixture.detectChanges();

      const preview = fixture.debugElement.query(By.css('.capture-date-preview'));
      expect(preview).toBeTruthy();
      expect(preview.nativeElement.textContent).toContain('3:00 PM');

      const note = fixture.debugElement.query(By.css('.capture-date-note'));
      expect(note).toBeTruthy();
      expect(note.nativeElement.textContent).toContain(
        "Couldn't detect your timezone — the 3:00 PM reminder may not arrive on time.",
      );

      const input = fixture.debugElement.query(By.css('input'));
      expect(input.nativeElement.getAttribute('aria-describedby')).toContain('capture-date-note');
    });

    it('says nothing about the timezone for a date-only task', () => {
      spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').and.returnValue(
        {} as Intl.ResolvedDateTimeFormatOptions,
      );
      const fixture = createFixture();

      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('.capture-date-preview'))).toBeTruthy();
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

    it('resets title, project, parser state, date draft, error, and submission mode', () => {
      const fixture = createFixture();
      fixture.componentInstance.setTitle('Call Sam Friday');
      fixture.componentInstance['projectId'].set('p2');
      fixture.componentInstance.setError('Failed');
      fixture.componentInstance.setSubmissionType('quick');

      fixture.componentInstance.resetCapture();

      expect(fixture.componentInstance.getTitle()).toBe('');
      expect(fixture.componentInstance.getProjectId()).toBeNull();
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

  describe('Project selection', () => {
    it('starts with no project and offers an explicit No project option', () => {
      const fixture = createFixture();
      const select = fixture.debugElement.query(By.css('select[name="captureProjectId"]'));

      expect(fixture.componentInstance.getProjectId()).toBeNull();
      expect(select.nativeElement.options[0].textContent).toContain('No project');
    });

    it('returns the selected project id', async () => {
      const fixture = createFixture();
      await fixture.whenStable();
      fixture.detectChanges();

      const select = fixture.debugElement.query(By.css('select[name="captureProjectId"]'))
        .nativeElement as HTMLSelectElement;
      const workOption = Array.from(select.options).find(
        (option) => option.textContent?.trim() === 'Work',
      );

      select.selectedIndex = Array.from(select.options).indexOf(workOption!);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();

      expect(fixture.componentInstance.getProjectId()).toBe('p2');
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
