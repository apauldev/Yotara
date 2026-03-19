import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { StartScreenComponent } from './start-screen.component';
import { AuthStateService } from '../../../../core/services/auth-state.service';

describe('StartScreenComponent', () => {
  let fixture: ComponentFixture<StartScreenComponent>;
  let component: StartScreenComponent;
  let authState: jasmine.SpyObj<AuthStateService>;
  let router: jasmine.SpyObj<Router>;
  let activatedRoute: { snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> } };

  beforeEach(async () => {
    authState = jasmine.createSpyObj<AuthStateService>('AuthStateService', ['completeOnboarding']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    activatedRoute = {
      snapshot: {
        queryParamMap: convertToParamMap({}),
      },
    };

    await TestBed.configureTestingModule({
      imports: [StartScreenComponent],
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StartScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows the account-created confirmation when redirected from signup', async () => {
    TestBed.resetTestingModule();
    activatedRoute = {
      snapshot: {
        queryParamMap: convertToParamMap({ created: '1' }),
      },
    };

    await TestBed.configureTestingModule({
      imports: [StartScreenComponent],
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StartScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.accountCreated()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain(
      'Account created. Choose a mode to continue.',
    );
  });

  it('completes onboarding in personal mode and redirects to the default landing page', async () => {
    authState.completeOnboarding.and.resolveTo({
      user: {
        id: 'user-1',
        email: 'person@example.com',
        name: 'Person',
        workspaceMode: 'personal',
        onboardingCompleted: true,
        createdAt: '2026-03-19T00:00:00.000Z',
      },
    });
    router.navigate.and.resolveTo(true);

    component.selectWorkspace('personal');

    await component.continue();

    expect(authState.completeOnboarding).toHaveBeenCalledOnceWith('personal');
    expect(localStorage.getItem('workspaceType')).toBe('personal');
    expect(localStorage.getItem('onboardingCompleted')).toBe('true');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/dashboard']);
    expect(component.error()).toBe('');
    expect(component.loading()).toBeFalse();
  });

  it('shows an error when onboarding cannot be saved', async () => {
    spyOn(console, 'error');
    authState.completeOnboarding.and.rejectWith(new Error('save failed'));

    await component.continue();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.error()).toBe('Could not save your workspace mode');
    expect(component.loading()).toBeFalse();
    expect(console.error).toHaveBeenCalled();
  });
});
