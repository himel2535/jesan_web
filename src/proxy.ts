import { NextResponse, type NextRequest } from 'next/server';
import { ACCESS_COOKIE, PATHNAME_HEADER } from '@/core/auth/constants';
import { resumePath } from '@/core/auth/next-path';

/**
 * Gate for app pages (Next 16 "proxy", formerly middleware). Cheap check only, no API call:
 * - no access cookie → resume the session on the server (refresh), or end up on /login;
 * - otherwise pass the current path to server layouts, which verify the session with GET /auth/me.
 * Real authorization still happens in the API on every request.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const current = `${pathname}${search}`;

  if (!request.cookies.has(ACCESS_COOKIE)) {
    return NextResponse.redirect(new URL(resumePath(current), request.url));
  }

  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, current);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Everything except the API proxy and our auth routes, Next internals, the login page and files.
  matcher: ['/((?!api/|_next/|login(?:/|$)|favicon\\.ico|.*\\.[\\w]+$).*)'],
};
