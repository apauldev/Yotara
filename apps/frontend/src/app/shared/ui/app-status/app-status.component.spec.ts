import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import type { AnimationEvent } from '@angular/animations';
import { AppStatusComponent } from './app-status.component';
import { StatusService } from '../../../core/services/status.service';

describe('AppStatusComponent', () => {
  let fixture: ComponentFixture<AppStatusComponent>;
  let component: AppStatusComponent;
  let statusService: StatusService;

  function createComponent() {
    fixture = TestBed.createComponent(AppStatusComponent);
    component = fixture.componentInstance;
    statusService = TestBed.inject(StatusService);
    return fixture;
  }

  function animationDone(toState: string, phaseName: 'start' | 'done' = 'done'): AnimationEvent {
    return { toState, phaseName } as AnimationEvent;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppStatusComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();
  });

  afterEach(() => {
    if (fixture) {
      fixture.destroy();
    }
  });

  it('renders an accessible View action alongside the message', () => {
    createComponent();
    const callback = jasmine.createSpy('callback');
    statusService.show('Moved to Today', 'success', 3000, {
      action: { label: 'View', callback },
    });
    fixture.detectChanges();

    const toast = fixture.debugElement.query(By.css('.toast')).nativeElement as HTMLElement;
    expect(toast.textContent).toContain('Moved to Today');

    const action = fixture.debugElement.query(By.css('.toast-action'))
      .nativeElement as HTMLButtonElement;
    expect(action.textContent?.trim()).toBe('View');
    expect(action.tagName).toBe('BUTTON');
  });

  it('only captures pointer events for action toasts', () => {
    createComponent();
    statusService.show('Informational', 'info', 0);
    fixture.detectChanges();

    const informational = fixture.debugElement.query(By.css('.toast')).nativeElement as HTMLElement;
    expect(informational.classList.contains('toast-actionable')).toBeFalse();
    expect(getComputedStyle(informational).pointerEvents).toBe('none');

    statusService.show('Actionable', 'success', 0, {
      action: { label: 'View', callback: () => {} },
    });
    fixture.detectChanges();

    const actionable = fixture.debugElement.queryAll(By.css('.toast'))[1]
      .nativeElement as HTMLElement;
    expect(actionable.classList.contains('toast-actionable')).toBeTrue();
    expect(getComputedStyle(actionable).pointerEvents).toBe('auto');
  });

  it('dismisses immediately but runs the action only after the leave animation', () => {
    createComponent();
    const callback = jasmine.createSpy('callback');
    const id = statusService.show('Moved to Today', 'success', 3000, {
      action: { label: 'View', callback },
    });
    fixture.detectChanges();

    const action = fixture.debugElement.query(By.css('.toast-action'))
      .nativeElement as HTMLButtonElement;
    action.click();

    expect(statusService.toasts()).toEqual([]);
    expect(callback).not.toHaveBeenCalled();

    component['onToastAnimationDone'](id, animationDone('void'));
    expect(callback).toHaveBeenCalledTimes(1);

    // A duplicated done event must not run the action twice.
    component['onToastAnimationDone'](id, animationDone('void'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not run an action for enter animation events', () => {
    createComponent();
    const callback = jasmine.createSpy('callback');
    const id = statusService.show('Moved to Today', 'success', 0, {
      action: { label: 'View', callback },
    });
    fixture.detectChanges();

    component['onToastAnimationDone'](id, animationDone('void', 'start'));
    component['onToastAnimationDone'](id, animationDone('*'));

    expect(callback).not.toHaveBeenCalled();
  });

  it('pauses while hovered and resumes the remaining time on leave', fakeAsync(() => {
    createComponent();
    statusService.show('Hover me', 'info', 1000);
    fixture.detectChanges();

    const toast = fixture.debugElement.query(By.css('.toast')).nativeElement as HTMLElement;
    toast.dispatchEvent(new MouseEvent('mouseenter'));

    tick(2000);
    expect(statusService.toasts().length).toBe(1);

    toast.dispatchEvent(new MouseEvent('mouseleave'));
    tick(999);
    expect(statusService.toasts().length).toBe(1);
    tick(1);
    expect(statusService.toasts().length).toBe(0);
  }));

  it('pauses while focused and resumes on focus leaving the toast', fakeAsync(() => {
    createComponent();
    statusService.show('Focus me', 'info', 1000);
    fixture.detectChanges();

    const toast = fixture.debugElement.query(By.css('.toast')).nativeElement as HTMLElement;
    toast.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    tick(2000);
    expect(statusService.toasts().length).toBe(1);

    toast.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    tick(1000);
    expect(statusService.toasts().length).toBe(0);
  }));

  it('does not run a dismissed action after a same-key replacement', () => {
    createComponent();
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');

    const firstId = statusService.show('Moved to Today', 'success', 3000, {
      key: 'task-movement:task-1',
      action: { label: 'View', callback: first },
    });
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.toast-action')).nativeElement.click();
    expect(statusService.toasts()).toEqual([]);

    const secondId = statusService.show('Moved to Work', 'success', 3000, {
      key: 'task-movement:task-1',
      action: { label: 'View', callback: second },
    });
    fixture.detectChanges();

    component['onToastAnimationDone'](firstId, animationDone('void'));
    expect(first).not.toHaveBeenCalled();

    fixture.debugElement.query(By.css('.toast-action')).nativeElement.click();
    component['onToastAnimationDone'](secondId, animationDone('void'));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('replaces a task toast without keeping the old action alive', fakeAsync(() => {
    createComponent();
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');

    statusService.show('Moved to Today', 'success', 3000, {
      key: 'task-movement:task-1',
      action: { label: 'View', callback: first },
    });
    fixture.detectChanges();
    const firstToast = statusService.toasts()[0];

    const secondId = statusService.show('Moved to Work', 'success', 3000, {
      key: 'task-movement:task-1',
      action: { label: 'View', callback: second },
    });
    fixture.detectChanges();
    tick(250);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.toast')).length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Moved to Work');

    // Even if the leaving DOM node's handler is invoked, it must be inert.
    component['runAction'](firstToast);
    expect(first).not.toHaveBeenCalled();
    expect(statusService.toasts().length).toBe(1);

    fixture.debugElement.query(By.css('.toast-action')).nativeElement.click();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    component['onToastAnimationDone'](secondId, animationDone('void'));
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  }));

  it('clears timers and toasts when the host is torn down', fakeAsync(() => {
    createComponent();
    statusService.show('Temporary', 'info', 1000);
    fixture.detectChanges();

    fixture.destroy();

    expect(statusService.toasts()).toEqual([]);
    tick(1000);
    expect(statusService.toasts()).toEqual([]);
  }));

  it('marks toasts for reduced transform motion when requested', () => {
    spyOn(window, 'matchMedia').and.callFake(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );

    createComponent();
    statusService.show('Reduced motion', 'info', 0);
    fixture.detectChanges();

    const toast = fixture.debugElement.query(By.css('.toast')).nativeElement as HTMLElement;
    expect(component['reducedMotion']).toBeTrue();
    expect(toast.classList.contains('toast-reduced-motion')).toBeTrue();
  });
});
