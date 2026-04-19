import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let component: ConfirmDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
  });

  it('renders the dialog copy and action labels', () => {
    component.open = true;
    component.title = 'Leave page?';
    component.description = 'You have unsaved changes.';
    component.confirmLabel = 'Leave';
    component.cancelLabel = 'Stay';
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Leave page?');
    expect(fixture.nativeElement.textContent).toContain('You have unsaved changes.');
    expect(fixture.nativeElement.textContent).toContain('Stay');
    expect(fixture.nativeElement.textContent).toContain('Leave');
  });

  it('emits cancel and confirm actions', () => {
    component.open = true;
    fixture.detectChanges();

    const cancelSpy = spyOn(component.cancel, 'emit');
    const confirmSpy = spyOn(component.confirm, 'emit');

    fixture.debugElement.query(By.css('.secondary-button')).nativeElement.click();
    fixture.debugElement.query(By.css('.primary-button')).nativeElement.click();

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it('forwards modal close events', () => {
    component.open = true;
    fixture.detectChanges();

    const closeSpy = spyOn(component.close, 'emit');
    fixture.debugElement.query(By.css('.close-button')).nativeElement.click();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
