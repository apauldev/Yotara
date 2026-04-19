import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LogoutConfirmModalComponent } from './logout-confirm-modal.component';

describe('LogoutConfirmModalComponent', () => {
  let fixture: ComponentFixture<LogoutConfirmModalComponent>;
  let component: LogoutConfirmModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogoutConfirmModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LogoutConfirmModalComponent);
    component = fixture.componentInstance;
  });

  it('renders the preset logout dialog copy', () => {
    component.open = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Leave the Sanctuary?');
    expect(fixture.nativeElement.textContent).toContain('Stay and Focus');
    expect(fixture.nativeElement.textContent).toContain('Logout');
  });

  it('maps stay and confirm events through the wrapper', () => {
    component.open = true;
    fixture.detectChanges();

    const staySpy = spyOn(component.stay, 'emit');
    const confirmSpy = spyOn(component.confirm, 'emit');
    const closeSpy = spyOn(component.close, 'emit');

    fixture.debugElement.query(By.css('.secondary-button')).nativeElement.click();
    fixture.debugElement.query(By.css('.primary-button')).nativeElement.click();
    fixture.debugElement.query(By.css('.close-button')).nativeElement.click();

    expect(staySpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
