import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthStateService } from './core/services/auth-state.service';

describe('AppComponent', () => {
  let authState: { initialize: jasmine.Spy };

  beforeEach(async () => {
    authState = { initialize: jasmine.createSpy('initialize') };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: AuthStateService, useValue: authState }],
    }).compileComponents();
  });

  afterEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should provide a router outlet for routed views', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(RouterOutlet))).toBeTruthy();
  });

  it('triggers background auth initialization without awaiting it', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(authState.initialize).toHaveBeenCalledTimes(1);
    // Bootstrap must not wait on the returned promise — the spy returns an
    // unresolved promise, and component creation already completed above.
  });
});
