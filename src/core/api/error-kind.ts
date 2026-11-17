import { ApiError } from './errors';

export type ApiErrorKind =
  'duplicate' | 'refused' | 'noPermission' | 'notFound' | 'unavailable' | 'unknown';

/**
 * Which translated message to show for a failed call. Decided by status, never by the API's
 * English `message` text (docs/API.md §10). 400 has no machine-readable field or code yet
 * (DECISIONS.md, API gap: 400 code/field), so it maps to one general "refused" message.
 */
export function apiErrorKind(error: unknown): ApiErrorKind {
  if (!(error instanceof ApiError)) return 'unknown';
  if (error.isServerUnavailable) return 'unavailable';
  switch (error.status) {
    case 409:
      return 'duplicate';
    case 400:
      return 'refused';
    case 403:
      return 'noPermission';
    case 404:
      return 'notFound';
    default:
      return 'unknown';
  }
}
