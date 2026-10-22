import { HttpErrorResponse } from '@angular/common/http';
import { existingLabelFromConflict } from './label-conflict';

describe('existingLabelFromConflict', () => {
  function conflict(body: unknown): HttpErrorResponse {
    return new HttpErrorResponse({ status: 409, error: body });
  }

  it('returns the existing label from a duplicate-name response', () => {
    expect(
      existingLabelFromConflict(
        conflict({ existingLabel: { id: 'label-1', name: 'Writing' }, message: 'Conflict' }),
      ),
    ).toEqual({ id: 'label-1', name: 'Writing' });
  });

  it('ignores non-409 errors', () => {
    expect(
      existingLabelFromConflict(
        new HttpErrorResponse({
          status: 400,
          error: { existingLabel: { id: 'label-1', name: 'Writing' } },
        }),
      ),
    ).toBeNull();
  });

  it('ignores malformed conflict payloads', () => {
    expect(existingLabelFromConflict(conflict({ existingLabel: null }))).toBeNull();
    expect(existingLabelFromConflict(conflict({ existingLabel: { id: 'label-1' } }))).toBeNull();
    expect(existingLabelFromConflict(conflict({ message: 'Conflict' }))).toBeNull();
    expect(existingLabelFromConflict(new Error('nope'))).toBeNull();
  });
});
