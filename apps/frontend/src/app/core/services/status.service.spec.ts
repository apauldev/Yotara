import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { StatusService } from './status.service';

describe('StatusService', () => {
  let service: StatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StatusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Loading State', () => {
    it('should start with isLoading as false', () => {
      expect(service.isLoading()).toBeFalse();
    });

    it('should set isLoading to true when startLoading is called', () => {
      service.startLoading();
      expect(service.isLoading()).toBeTrue();
    });

    it('should set isLoading to false when stopLoading is called the same number of times as startLoading', () => {
      service.startLoading();
      service.startLoading();
      service.stopLoading();
      expect(service.isLoading()).toBeTrue();
      service.stopLoading();
      expect(service.isLoading()).toBeFalse();
    });

    it('should not go below zero for loading count', () => {
      service.stopLoading();
      expect(service.isLoading()).toBeFalse();
    });
  });

  describe('Toasts', () => {
    it('should start with an empty toasts array', () => {
      expect(service.toasts()).toEqual([]);
    });

    it('should add a toast when show is called', () => {
      service.show('Test message', 'info', 0);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Test message');
      expect(service.toasts()[0].type).toBe('info');
    });

    it('should remove a toast when remove is called', () => {
      const id = service.show('To be removed', 'info', 0);
      expect(service.toasts().length).toBe(1);
      service.remove(id);
      expect(service.toasts().length).toBe(0);
    });

    it('should auto-dismiss toasts after the specified duration', fakeAsync(() => {
      service.show('Auto dismiss', 'success', 1000);
      expect(service.toasts().length).toBe(1);
      tick(1001);
      expect(service.toasts().length).toBe(0);
    }));

    it('pauses and resumes the remaining dismissal time', fakeAsync(() => {
      const id = service.show('Pausable', 'info', 1000);

      tick(400);
      service.pause(id);
      tick(2000);
      expect(service.toasts().length).toBe(1);

      service.resume(id);
      tick(599);
      expect(service.toasts().length).toBe(1);
      tick(1);
      expect(service.toasts().length).toBe(0);
    }));

    it('ignores duplicate pause and resume calls', fakeAsync(() => {
      const id = service.show('Pausable', 'info', 1000);

      tick(200);
      service.pause(id);
      service.pause(id);
      service.resume(id);
      service.resume(id);

      tick(801);
      expect(service.toasts().length).toBe(0);
    }));

    it('replaces an existing toast with the same key and cancels its timer', fakeAsync(() => {
      service.show('First', 'info', 1000, { key: 'task-1' });
      tick(500);

      service.show('Second', 'success', 1000, { key: 'task-1' });
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Second');

      // The replaced toast's timer would have fired by now.
      tick(600);
      expect(service.toasts().length).toBe(1);
      expect(service.toasts()[0].message).toBe('Second');

      tick(400);
      expect(service.toasts().length).toBe(0);
    }));

    it('cancels the dismissal timer when a toast is removed manually', fakeAsync(() => {
      const id = service.show('Manual', 'info', 1000);
      tick(500);
      service.remove(id);

      tick(1000);
      expect(service.toasts().length).toBe(0);
    }));

    it('clears every toast and timer', fakeAsync(() => {
      service.show('One', 'info', 1000);
      service.show('Two', 'error', 1000);
      service.clearAll();
      expect(service.toasts()).toEqual([]);

      tick(1000);
      expect(service.toasts()).toEqual([]);
    }));

    it('retains optional actions and bypasses the timer for duration zero', fakeAsync(() => {
      const callback = jasmine.createSpy('callback');
      service.show('Actionable', 'success', 0, {
        key: 'task-1',
        action: { label: 'View', callback },
      });

      expect(service.toasts()[0].action?.label).toBe('View');
      expect(service.toasts()[0].key).toBe('task-1');
      tick(10_000);
      expect(service.toasts().length).toBe(1);
    }));

    it('should provide helper methods for success and error', () => {
      service.success('Success!');
      expect(service.toasts()[0].type).toBe('success');
      service.error('Error!');
      expect(service.toasts()[1].type).toBe('error');
    });
  });
});
