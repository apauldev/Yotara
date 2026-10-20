import { HttpErrorResponse } from '@angular/common/http';

export interface ExistingLabelConflict {
  id: string;
  name: string;
}

/**
 * Extracts the label named in a duplicate-name 409 response. The API returns
 * `{ existingLabel: { id, name }, message }`; anything else is not a usable
 * conflict payload.
 */
export function existingLabelFromConflict(error: unknown): ExistingLabelConflict | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
    return null;
  }

  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const candidate = (body as { existingLabel?: unknown }).existingLabel;
  if (typeof candidate !== 'object' || candidate === null) {
    return null;
  }

  const { id, name } = candidate as { id?: unknown; name?: unknown };
  return typeof id === 'string' && typeof name === 'string' ? { id, name } : null;
}
