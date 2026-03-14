import { TestBed } from '@angular/core/testing';
import { AuthService } from '@yotara/shared';
import { AuthStateService } from './auth-state.service';

describe('AuthStateService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('falls back to unauthenticated state when initial session refresh fails', async () => {
    spyOn(console, 'error');
    spyOn(AuthService, 'getSession').and.rejectWith(new Error('network down'));

    const service = TestBed.inject(AuthStateService);

    await expectAsync(service.initialize()).toBeResolvedTo(null);

    expect(service.initialized()).toBeTrue();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
    expect(AuthService.getSession).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });
});
