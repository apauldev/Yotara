import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DeleteAccountModalComponent } from './delete-account-modal.component';
import { AuthStateService } from '../../../core/services/auth-state.service';

describe('DeleteAccountModalComponent', () => {
  let component: DeleteAccountModalComponent;
  let fixture: ComponentFixture<DeleteAccountModalComponent>;
  let deleteAccountSpy: jasmine.Spy;
  let loadingSignal: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    loadingSignal = signal(false);
    deleteAccountSpy = jasmine.createSpy('deleteAccount').and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [DeleteAccountModalComponent],
      providers: [
        {
          provide: AuthStateService,
          useValue: {
            loading: loadingSignal,
            deleteAccount: deleteAccountSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteAccountModalComponent);
    component = fixture.componentInstance;
    component.userEmail = 'test@example.com';
    component.open = true;
    fixture.detectChanges();
  });

  it('renders confirm step with data counts', () => {
    component.taskCount = 5;
    component.projectCount = 3;
    component.labelCount = 2;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('5 tasks');
    expect(text).toContain('3 projects');
    expect(text).toContain('2 labels');
  });

  it('renders singular forms for counts of 1', () => {
    component.taskCount = 1;
    component.projectCount = 1;
    component.labelCount = 1;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1 task');
    expect(text).toContain('1 project');
    expect(text).toContain('1 label');
  });

  it('hides counts that are zero', () => {
    component.taskCount = 0;
    component.projectCount = 5;
    component.labelCount = 0;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('0 tasks');
    expect(text).toContain('5 projects');
    expect(text).not.toContain('0 labels');
  });

  it('transitions to verify step on confirm', () => {
    expect(component['step']()).toBe('confirm');

    component['onConfirm']();
    fixture.detectChanges();

    expect(component['step']()).toBe('verify');
  });

  it('shows email and password inputs on verify step', () => {
    component['onConfirm']();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('#delete-account-email'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('#delete-account-password'))).not.toBeNull();
  });

  it('shows email mismatch warning when email does not match', () => {
    component['onConfirm']();
    component['emailInputValue'].set('wrong@example.com');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Email does not match your account');
  });

  it('hides email warning when email matches', () => {
    component['onConfirm']();
    component['emailInputValue'].set('test@example.com');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Email does not match your account');
  });

  it('canDelete is false when email does not match', () => {
    component['onConfirm']();
    component['emailInputValue'].set('wrong@example.com');
    component['passwordInputValue'].set('password123');

    expect(component['canDelete']).toBe(false);
  });

  it('canDelete is false when password is empty', () => {
    component['onConfirm']();
    component['emailInputValue'].set('test@example.com');
    component['passwordInputValue'].set('');

    expect(component['canDelete']).toBe(false);
  });

  it('canDelete is true when email matches and password is provided', () => {
    component['onConfirm']();
    component['emailInputValue'].set('test@example.com');
    component['passwordInputValue'].set('password123');

    expect(component['canDelete']).toBe(true);
  });

  it('canDelete is false when loading', () => {
    component['onConfirm']();
    component['emailInputValue'].set('test@example.com');
    component['passwordInputValue'].set('password123');
    loadingSignal.set(true);

    expect(component['canDelete']).toBe(false);
  });

  it('calls deleteAccount and emits deleted on successful submission', async () => {
    component['onConfirm']();
    component['emailInputValue'].set('test@example.com');
    component['passwordInputValue'].set('password123');

    const deletedSpy = spyOn(component.deleted, 'emit');
    await component['onConfirm']();

    expect(deleteAccountSpy).toHaveBeenCalledWith('password123');
    expect(deletedSpy).toHaveBeenCalledTimes(1);
  });

  it('displays error message on failure', async () => {
    deleteAccountSpy.and.rejectWith(new Error('Something went wrong'));

    component['onConfirm']();
    component['emailInputValue'].set('test@example.com');
    component['passwordInputValue'].set('password123');

    await component['onConfirm']();
    fixture.detectChanges();

    expect(component['error']()).toBe('Something went wrong');
    expect(component['passwordInputValue']()).toBe('');
  });

  it('displays rate limit message for rate limit errors', async () => {
    deleteAccountSpy.and.rejectWith(new Error('Too many requests'));

    component['onConfirm']();
    component['emailInputValue'].set('test@example.com');
    component['passwordInputValue'].set('password123');

    await component['onConfirm']();
    fixture.detectChanges();

    expect(component['error']()).toContain('Too many attempts');
  });

  it('back button returns to confirm step and resets', () => {
    component['onConfirm']();
    expect(component['step']()).toBe('verify');

    component['onCancel']();
    fixture.detectChanges();

    expect(component['step']()).toBe('confirm');
    expect(component['emailInputValue']()).toBe('');
    expect(component['passwordInputValue']()).toBe('');
  });

  it('cancel on confirm step emits close', () => {
    const closeSpy = spyOn(component.close, 'emit');

    component['onCancel']();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('onClose resets and emits close event', () => {
    const closeSpy = spyOn(component.close, 'emit');

    component['onClose']();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(component['step']()).toBe('confirm');
    expect(component['emailInputValue']()).toBe('');
  });

  it('onClose does nothing when loading', () => {
    loadingSignal.set(true);
    const closeSpy = spyOn(component.close, 'emit');

    component['onClose']();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('onDelete prevents default and blocks when canDelete is false', () => {
    const event = new Event('submit');
    const preventDefaultSpy = spyOn(event, 'preventDefault');
    const deletedSpy = spyOn(component.deleted, 'emit');

    component['onDelete'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(deletedSpy).not.toHaveBeenCalled();
  });

  it('onDelete submits when canDelete is true', async () => {
    component['onConfirm']();
    component['emailInputValue'].set('test@example.com');
    component['passwordInputValue'].set('password123');

    const event = new Event('submit');
    spyOn(event, 'preventDefault');
    const deletedSpy = spyOn(component.deleted, 'emit');

    await component['onDelete'](event);

    expect(deleteAccountSpy).toHaveBeenCalled();
    expect(deletedSpy).toHaveBeenCalled();
  });

  it('shows error banner when error is set', () => {
    component['onConfirm']();
    component['error'].set('Something failed');
    fixture.detectChanges();

    const banner = fixture.debugElement.query(By.css('.error-banner'));
    expect(banner).not.toBeNull();
    expect(banner.nativeElement.textContent).toContain('Something failed');
  });

  it('hides error banner when error is null', () => {
    component['onConfirm']();
    component['error'].set(null);
    fixture.detectChanges();

    const banner = fixture.debugElement.query(By.css('.error-banner'));
    expect(banner).toBeNull();
  });
});
