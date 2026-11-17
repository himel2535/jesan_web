/**
 * Where the API lives (DECISIONS.md, "Session and same-site proxy").
 *
 * The browser never talks to jesan-api directly: it calls this site's own `/api/v1/...`, which
 * next.config.ts rewrites to API_INTERNAL_URL. The API's cookies are therefore set on this site,
 * so server components see `jesan_at` and the refresh cookie path `/api/v1/auth` still matches.
 */
export const BROWSER_API_BASE = '/api/v1';

export const DEFAULT_INTERNAL_API_URL = 'http://localhost:4000/api/v1';

/** Server-only: the API's real address (rewrite destination and server-side fetches). */
export function serverApiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL || DEFAULT_INTERNAL_API_URL).replace(/\/+$/, '');
}
