import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMarkdown } from 'ngx-markdown';
import { MarkdownEditorComponent } from './markdown-editor.component';

describe('MarkdownEditorComponent', () => {
  let component: MarkdownEditorComponent;
  let fixture: ComponentFixture<MarkdownEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownEditorComponent],
      providers: [provideMarkdown()],
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have default input values', () => {
    expect(component.value).toBe('');
    expect(component.placeholder).toBe('');
    expect(component.rows).toBe(7);
    expect(component['previewMode']()).toBe(false);
  });

  describe('Edit mode', () => {
    it('should show textarea when in edit mode', () => {
      const textarea = fixture.debugElement.query(By.css('textarea'));
      expect(textarea).toBeTruthy();
    });

    it('should show format toolbar when in edit mode', () => {
      const toolbar = fixture.debugElement.query(By.css('app-format-toolbar'));
      expect(toolbar).toBeTruthy();
    });

    it('should not show markdown preview when in edit mode', () => {
      const preview = fixture.debugElement.query(By.css('.markdown-preview'));
      expect(preview).toBeFalsy();
    });

    it('should reflect input value in textarea', async () => {
      component.value = '**bold text**';
      fixture.detectChanges();
      await fixture.whenStable();
      const textarea = fixture.debugElement.query(By.css('textarea'));
      expect(textarea.nativeElement.value).toBe('**bold text**');
    });

    it('should emit valueChange when textarea content changes', () => {
      spyOn(component.valueChange, 'emit');
      const textarea = fixture.debugElement.query(By.css('textarea'));
      textarea.nativeElement.value = 'new content';
      textarea.nativeElement.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(component.valueChange.emit).toHaveBeenCalledWith('new content');
    });

    it('should apply placeholder attribute', () => {
      component.placeholder = 'Write something';
      fixture.detectChanges();
      const textarea = fixture.debugElement.query(By.css('textarea'));
      expect(textarea.nativeElement.getAttribute('placeholder')).toBe('Write something');
    });

    it('should apply rows attribute', () => {
      component.rows = 10;
      fixture.detectChanges();
      const textarea = fixture.debugElement.query(By.css('textarea'));
      expect(textarea.nativeElement.getAttribute('rows')).toBe('10');
    });
  });

  describe('Preview mode', () => {
    beforeEach(async () => {
      component.value = '# Heading\n\nSome **bold** text';
      component['previewMode'].set(true);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('should show markdown preview when preview mode is active', () => {
      const preview = fixture.debugElement.query(By.css('.markdown-preview'));
      expect(preview).toBeTruthy();
    });

    it('should hide textarea when in preview mode', () => {
      const textarea = fixture.debugElement.query(By.css('textarea'));
      expect(textarea).toBeFalsy();
    });

    it('should render markdown content in preview', () => {
      const previewContent = fixture.debugElement.query(By.css('.markdown-preview'));
      expect(previewContent.nativeElement.textContent).toContain('Heading');
      expect(previewContent.nativeElement.textContent).toContain('bold');
    });

    it('should show preview badge on hover', () => {
      const preview = fixture.debugElement.query(By.css('.markdown-preview'));
      const badge = preview.query(By.css('.preview-badge'));
      expect(badge).toBeTruthy();
    });

    it('should show the format toolbar with previewMode indicator', () => {
      const toolbar = fixture.debugElement.query(By.css('app-format-toolbar'));
      expect(toolbar).toBeTruthy();
    });
  });

  describe('Toggle preview', () => {
    it('should switch from edit to preview when togglePreview is called', () => {
      expect(component['previewMode']()).toBe(false);
      component['togglePreview']();
      fixture.detectChanges();
      expect(component['previewMode']()).toBe(true);
    });

    it('should switch back to edit when togglePreview is called twice', () => {
      component['togglePreview']();
      fixture.detectChanges();
      component['togglePreview']();
      fixture.detectChanges();
      expect(component['previewMode']()).toBe(false);
    });

    it('should show textarea after toggling back to edit mode', () => {
      component['togglePreview']();
      fixture.detectChanges();
      component['togglePreview']();
      fixture.detectChanges();
      const textarea = fixture.debugElement.query(By.css('textarea'));
      expect(textarea).toBeTruthy();
    });
  });

  describe('Syntax insertion', () => {
    it('should emit valueChange when syntax is inserted', () => {
      spyOn(component.valueChange, 'emit');
      component['onInsertSyntax']({ prefix: '**', suffix: '**' });
      expect(component.valueChange.emit).toHaveBeenCalled();
    });

    it('should wrap selected text with syntax markers', () => {
      // Simulate having a textarea with selected text by setting value directly
      const textarea = fixture.debugElement.query(By.css('textarea'));
      textarea.nativeElement.value = 'some selected text';
      textarea.nativeElement.setSelectionRange(5, 13);
      component['onInsertSyntax']({ prefix: '**', suffix: '**' });
      expect(component.value).toContain('**selected**');
    });
  });

  describe('Edge cases', () => {
    it('should render placeholder when value is empty in preview mode', async () => {
      component.value = '';
      component['previewMode'].set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const preview = fixture.debugElement.query(By.css('.markdown-preview'));
      expect(preview.nativeElement.textContent).toContain('Nothing to preview');
    });

    it('should handle empty initial value', () => {
      expect(component.value).toBe('');
      expect(component).toBeTruthy();
    });

    it('should handle value with special characters', async () => {
      component.value = 'Task & "special" <characters>';
      component['previewMode'].set(true);
      fixture.detectChanges();
      await fixture.whenStable();
      const preview = fixture.debugElement.query(By.css('.markdown-preview'));
      expect(preview.nativeElement.textContent).toContain('Task & "special"');
    });
  });
});
