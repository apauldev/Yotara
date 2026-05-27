import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormatToolbarComponent } from './format-toolbar.component';

describe('FormatToolbarComponent', () => {
  let component: FormatToolbarComponent;
  let fixture: ComponentFixture<FormatToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormatToolbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FormatToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have previewMode default to false', () => {
    expect(component.previewMode).toBe(false);
  });

  describe('Toolbar buttons', () => {
    it('should render heading button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="# text"]'));
      expect(btn).toBeTruthy();
    });

    it('should render bold button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="**text**"]'));
      expect(btn).toBeTruthy();
    });

    it('should render italic button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="_text_"]'));
      expect(btn).toBeTruthy();
    });

    it('should render strikethrough button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="~~text~~"]'));
      expect(btn).toBeTruthy();
    });

    it('should render blockquote button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="> text"]'));
      expect(btn).toBeTruthy();
    });

    it('should render bullet list button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="- item"]'));
      expect(btn).toBeTruthy();
    });

    it('should render numbered list button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="1. item"]'));
      expect(btn).toBeTruthy();
    });

    it('should render checklist button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="- [ ] item"]'));
      expect(btn).toBeTruthy();
    });

    it('should render link button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="[text](url)"]'));
      expect(btn).toBeTruthy();
    });

    it('should render image button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="![alt](url)"]'));
      expect(btn).toBeTruthy();
    });

    it('should render horizontal rule button', () => {
      const btn = fixture.debugElement.query(By.css('[data-syntax="---"]'));
      expect(btn).toBeTruthy();
    });

    it('should render inline code button', () => {
      // The code button uses the backtickSyntax property for data-syntax
      const codeBtn = fixture.debugElement
        .queryAll(By.css('.tb'))
        .find((el) => el.nativeElement.getAttribute('aria-label') === 'Inline code');
      expect(codeBtn).toBeTruthy();
    });
  });

  describe('Syntax insertion', () => {
    it('should emit insertSyntax with heading syntax when heading button is clicked', () => {
      spyOn(component.insertSyntax, 'emit');
      const btn = fixture.debugElement.query(By.css('[data-syntax="# text"]'));
      btn.nativeElement.click();
      expect(component.insertSyntax.emit).toHaveBeenCalledWith({
        prefix: '# ',
        suffix: '',
        multiline: true,
      });
    });

    it('should emit insertSyntax with bold syntax when bold button is clicked', () => {
      spyOn(component.insertSyntax, 'emit');
      const btn = fixture.debugElement.query(By.css('[data-syntax="**text**"]'));
      btn.nativeElement.click();
      expect(component.insertSyntax.emit).toHaveBeenCalledWith({ prefix: '**', suffix: '**' });
    });

    it('should emit insertSyntax with italic syntax when italic button is clicked', () => {
      spyOn(component.insertSyntax, 'emit');
      const btn = fixture.debugElement.query(By.css('[data-syntax="_text_"]'));
      btn.nativeElement.click();
      expect(component.insertSyntax.emit).toHaveBeenCalledWith({ prefix: '_', suffix: '_' });
    });

    it('should emit insertSyntax with link syntax when link button is clicked', () => {
      spyOn(component.insertSyntax, 'emit');
      const btn = fixture.debugElement.query(By.css('[data-syntax="[text](url)"]'));
      btn.nativeElement.click();
      expect(component.insertSyntax.emit).toHaveBeenCalledWith({ prefix: '[', suffix: '](url)' });
    });

    it('should emit insertSyntax with bullet list syntax when list button is clicked', () => {
      spyOn(component.insertSyntax, 'emit');
      const btn = fixture.debugElement.query(By.css('[data-syntax="- item"]'));
      btn.nativeElement.click();
      expect(component.insertSyntax.emit).toHaveBeenCalledWith({
        prefix: '- ',
        suffix: '',
        multiline: true,
      });
    });

    it('should emit insertSyntax with blockquote syntax when blockquote button is clicked', () => {
      spyOn(component.insertSyntax, 'emit');
      const btn = fixture.debugElement.query(By.css('[data-syntax="> text"]'));
      btn.nativeElement.click();
      expect(component.insertSyntax.emit).toHaveBeenCalledWith({
        prefix: '> ',
        suffix: '',
        multiline: true,
      });
    });
  });

  describe('Preview toggle', () => {
    it('should emit togglePreview when preview button is clicked', () => {
      spyOn(component.togglePreview, 'emit');
      const previewBtn = fixture.debugElement.query(By.css('.tb-toggle'));
      previewBtn.nativeElement.click();
      expect(component.togglePreview.emit).toHaveBeenCalled();
    });

    it('should show eye icon when previewMode is false', () => {
      component.previewMode = false;
      fixture.detectChanges();
      const previewBtn = fixture.debugElement.query(By.css('.tb-toggle'));
      expect(previewBtn.nativeElement.getAttribute('title')).toBe('Preview');
    });

    it('should show edit icon when previewMode is true', () => {
      component.previewMode = true;
      fixture.detectChanges();
      const previewBtn = fixture.debugElement.query(By.css('.tb-toggle'));
      expect(previewBtn.nativeElement.getAttribute('title')).toBe('Edit — make changes');
    });

    it('should add active class when in preview mode', () => {
      component.previewMode = true;
      fixture.detectChanges();
      const previewBtn = fixture.debugElement.query(By.css('.tb-toggle'));
      expect(previewBtn.nativeElement.classList.contains('tb-active')).toBe(true);
    });

    it('should not have active class when not in preview mode', () => {
      component.previewMode = false;
      fixture.detectChanges();
      const previewBtn = fixture.debugElement.query(By.css('.tb-toggle'));
      expect(previewBtn.nativeElement.classList.contains('tb-active')).toBe(false);
    });
  });

  describe('Scroll buttons', () => {
    it('should render scroll left button', () => {
      const scrollBtn = fixture.debugElement.query(By.css('[aria-label="Scroll left"]'));
      expect(scrollBtn).toBeTruthy();
    });

    it('should render scroll right button', () => {
      const scrollBtn = fixture.debugElement.query(By.css('[aria-label="Scroll right"]'));
      expect(scrollBtn).toBeTruthy();
    });
  });

  describe('Toolbar separators', () => {
    it('should render separator elements', () => {
      const separators = fixture.debugElement.queryAll(By.css('.tb-sep'));
      expect(separators.length).toBe(2);
    });
  });
});
