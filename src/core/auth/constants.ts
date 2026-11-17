/** Cookie names set by jesan-api (docs/API.md §2). The browser's JavaScript never reads them. */
export const ACCESS_COOKIE = 'jesan_at';
export const REFRESH_COOKIE = 'jesan_rt';

/**
 * Set for a few seconds after a successful server-side resume. If the API still answers 401
 * during that window, the session check goes to /login instead of resuming again (no loop).
 */
export const RESUME_GUARD_COOKIE = 'jesan_resumed';
export const RESUME_GUARD_SECONDS = 15;

/** Request header set by src/proxy.ts so server layouts know the path to come back to. */
export const PATHNAME_HEADER = 'x-jesan-pathname';

export const LOGIN_PATH = '/login';
/** Our own route handler (src/app/api/v1/auth/resume): refreshes on the server, then returns. */
export const RESUME_PATH = '/api/v1/auth/resume';
