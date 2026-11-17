import { ApiError } from '@/core/api/errors';

export type SettingsErrorKind =
  'duplicate' | 'refused' | 'noPermission' | 'notFound' | 'unavailable' | 'unknown';

/**
 * Which translated message to show for a failed Settings call. Decided by status, never by the
 * API's English `message` text (docs/API.md §9).
 */
export function settingsErrorKind(error: unknown): SettingsErrorKind {
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
