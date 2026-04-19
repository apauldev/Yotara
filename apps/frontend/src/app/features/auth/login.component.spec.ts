import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthStateService } from '../../core/services/auth-state.service';
import { Router } from '@angular/router';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let router: { navigate: jasmine.Spy; navigateByUrl: jasmine.Spy };
  let authState: {
    signIn: jasmine.Spy;
    signUp: jasmine.Spy;
    getPostAuthRedirectUrl: jasmine.Spy;
  };

  beforeEach(async () => {
    router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
    };

    authState = {
      signIn: jasmine.createSpy('signIn').and.resolveTo({ error: null }),
      signUp: jasmine.createSpy('signUp').and.resolveTo({ error: null }),
      getPostAuthRedirectUrl: jasmine.createSpy('getPostAuthRedirectUrl').and.returnValue('/inbox'),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthStateService, useValue: authState },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  it('renders the sign in form by default', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Welcome to Yotara');
    expect(fixture.nativeElement.textContent).toContain('Sign In');
    expect(fixture.nativeElement.textContent).not.toContain('Name');
  });

  it('switches to sign up mode and shows the name field', () => {
    fixture.detectChanges();

    component.toggleMode();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Create your Yotara account');
    expect(fixture.nativeElement.textContent).toContain('Name');
    expect(fixture.nativeElement.textContent).toContain('Create account');
  });

  it('blocks submission when validation fails', async () => {
    fixture.detectChanges();

    component.email.set('invalid-email');
    component.password.set('');

    await component.onSubmit();
    fixture.detectChanges();

    expect(authState.signIn).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Enter a valid email address');
    expect(fixture.nativeElement.textContent).toContain('Password is required');
  });

  it('signs in and navigates to the post-auth redirect', async () => {
    fixture.detectChanges();

    component.email.set('  alex@example.com ');
    component.password.set('secret-password');

    await component.onSubmit();

    expect(authState.signIn).toHaveBeenCalledWith('alex@example.com', 'secret-password');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/inbox');
  });

  it('signs up and sends onboarding users through the created redirect', async () => {
    fixture.detectChanges();
    component.toggleMode();
    authState.getPostAuthRedirectUrl.and.returnValue('/onboarding');

    component.name.set('Alex Rivers');
    component.email.set('alex@example.com');
    component.password.set('long-enough-password');

    await component.onSubmit();

    expect(authState.signUp).toHaveBeenCalledWith(
      'alex@example.com',
      'long-enough-password',
      'Alex Rivers',
    );
    expect(router.navigate).toHaveBeenCalledWith(['/onboarding'], {
      queryParams: { created: '1' },
    });
  });
});
