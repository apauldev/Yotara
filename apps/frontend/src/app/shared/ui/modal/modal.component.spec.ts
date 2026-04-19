import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalComponent } from './modal.component';

describe('ModalComponent', () => {
  let fixture: ComponentFixture<ModalComponent>;
  let component: ModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('does not render content when closed', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('renders the dialog and locks body scroll when open', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Example modal');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('emits close from the backdrop and close button', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();

    const closeSpy = spyOn(component.close, 'emit');
    fixture.debugElement.query(By.css('.backdrop')).nativeElement.click();
    fixture.debugElement.query(By.css('.close-button')).nativeElement.click();

    expect(closeSpy).toHaveBeenCalledTimes(2);
  });

  it('emits afterOpen once the modal is rendered', () => {
    const afterOpenSpy = spyOn(component.afterOpen, 'emit');

    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();

    expect(afterOpenSpy).toHaveBeenCalledTimes(1);
  });
});
