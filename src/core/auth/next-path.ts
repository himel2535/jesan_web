import { LOGIN_PATH, RESUME_PATH } from './constants';

/**
 * The "come back here after login" target, accepted only as a path on this site.
 * Anything else (other sites, protocol-relative `//x`, `/\x`, schemes, API or login paths) → `/`.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  try {
    const url = new URL(value, 'http://local.invalid');
    if (url.origin !== 'http://local.invalid') return '/';
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}?`) || path.startsWith('/api/')) {
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}

function withNext(base: string, next: string): string {
  const safe = safeNextPath(next);
  return safe === '/' ? base : `${base}?next=${encodeURIComponent(safe)}`;
}

export function loginPath(next = '/'): string {
  return withNext(LOGIN_PATH, next);
}

export function resumePath(next = '/'): string {
  return withNext(RESUME_PATH, next);
}
