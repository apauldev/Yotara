import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Event, NavigationEnd, provideRouter, Router, RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
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

  it('should remove boot skeleton on NavigationEnd', async () => {
    document.getElementById('boot-skeleton')?.remove();
    const skeleton = document.createElement('div');
    skeleton.id = 'boot-skeleton';
    document.body.appendChild(skeleton);

    const eventsSubject = new Subject<Event>();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: Router,
          useValue: { events: eventsSubject.asObservable() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    eventsSubject.next(new NavigationEnd(1, '/test', '/test'));
    expect(document.getElementById('boot-skeleton')).toBeFalsy();
    fixture.destroy();
    eventsSubject.complete();

    // Restore default TestBed for remaining tests
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should remove boot skeleton after fallback timeout', fakeAsync(() => {
    const skeleton = document.createElement('div');
    skeleton.id = 'boot-skeleton';
    document.body.appendChild(skeleton);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    fixture.componentInstance.ngAfterViewInit();
    tick(4000);
    expect(document.getElementById('boot-skeleton')).toBeFalsy();
    fixture.destroy();
  }));

  it('should handle missing skeleton gracefully', () => {
    document.getElementById('boot-skeleton')?.remove();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(() => {
      (fixture.componentInstance as unknown as { removeSkeleton: () => void }).removeSkeleton();
    }).not.toThrow();
    fixture.destroy();
  });
});
