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

    it('should provide helper methods for success and error', () => {
      service.success('Success!');
      expect(service.toasts()[0].type).toBe('success');
      service.error('Error!');
      expect(service.toasts()[1].type).toBe('error');
    });
  });
});
