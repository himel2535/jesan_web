import { ApiError } from './errors';

export type ApiErrorKind =
  'duplicate' | 'refused' | 'noPermission' | 'notFound' | 'unavailable' | 'unknown';

/**
 * The general kind of a failed call, by HTTP status — never by the API's English `message`.
 * Used as the fallback when the stable `code` has no message of its own (`useErrorMessage`).
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
