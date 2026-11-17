import { NextResponse, type NextRequest } from 'next/server';
import { serverApiBaseUrl } from '@/core/api/config';
import { RESUME_GUARD_COOKIE, RESUME_GUARD_SECONDS } from '@/core/auth/constants';
import { relaySetCookies } from '@/core/auth/cookies';
import { loginPath, safeNextPath } from '@/core/auth/next-path';
import { webOrigin } from '@/core/auth/origin';

const REFRESH_TIMEOUT_MS = 3000;

/**
 * Silent session resume for page loads (DECISIONS.md, "Session").
 *
 * The access cookie lives 15 minutes; when it is gone, src/proxy.ts sends the browser here. This
 * path is under /api/v1/auth, so the refresh cookie (Path=/api/v1/auth) arrives with the request.
 * We call POST /auth/refresh from the server, copy the API's Set-Cookie headers back unchanged and
 * return to `next` — or to /login when the refresh is refused.
 *
 * This file wins over the /api/v1/* rewrite because Next checks real routes before rewrites.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const origin = webOrigin(request.headers, request.url);

  let apiResponse: Response | null = null;
  try {
    apiResponse = await fetch(`${serverApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Cookie: request.headers.get('cookie') ?? '',
        // jesan-api rejects cookie-authenticated POSTs from origins outside CORS_ORIGIN; a
        // server-side fetch sends no Origin by itself, so we state this site's origin.
        Origin: origin,
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    apiResponse = null;
  }

  const refreshed = apiResponse?.ok === true;
  const response = NextResponse.redirect(new URL(refreshed ? next : loginPath(next), origin), 303);
  response.headers.set('Cache-Control', 'no-store');
  if (apiResponse) relaySetCookies(apiResponse.headers, response.headers);
  if (refreshed) {
    // Raw header on purpose: response.cookies.set() would re-serialize every Set-Cookie header,
    // including the relayed API cookies.
    response.headers.append(
      'set-cookie',
      `${RESUME_GUARD_COOKIE}=1; Max-Age=${RESUME_GUARD_SECONDS}; Path=/; HttpOnly; SameSite=Lax`,
    );
  }
  return response;
}
