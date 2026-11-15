import { TestBed } from '@angular/core/testing';
import { TaskQuickActionsCoordinatorService } from './task-quick-actions-coordinator.service';

describe('TaskQuickActionsCoordinatorService', () => {
  let service: TaskQuickActionsCoordinatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaskQuickActionsCoordinatorService],
    });
    service = TestBed.inject(TaskQuickActionsCoordinatorService);
  });

  it('initializes with no active task ID', () => {
    expect(service.activeTaskId()).toBeNull();
    expect(service.isOpen('task-1')).toBeFalse();
  });

  it('sets the active task on open', () => {
    service.open('task-1');
    expect(service.activeTaskId()).toBe('task-1');
    expect(service.isOpen('task-1')).toBeTrue();
    expect(service.isOpen('task-2')).toBeFalse();
  });

  it('switches the active task when opening another task', () => {
    service.open('task-1');
    service.open('task-2');
    expect(service.activeTaskId()).toBe('task-2');
    expect(service.isOpen('task-1')).toBeFalse();
    expect(service.isOpen('task-2')).toBeTrue();
  });

  it('closes the active task unconditionally if no taskId passed', () => {
    service.open('task-1');
    service.close();
    expect(service.activeTaskId()).toBeNull();
    expect(service.isOpen('task-1')).toBeFalse();
  });

  it('closes only when matching taskId is passed', () => {
    service.open('task-1');
    service.close('task-2');
    expect(service.activeTaskId()).toBe('task-1');

    service.close('task-1');
    expect(service.activeTaskId()).toBeNull();
  });
});
