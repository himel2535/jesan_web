import { cookies } from 'next/headers';
import { ACCESS_COOKIE } from '@/core/auth/constants';
import { serverApiBaseUrl } from './config';
import { ApiError, apiErrorFromResponse } from './errors';
import { DEFAULT_TIMEOUT_MS, queryString, type ApiGetter } from './client';

/**
 * Server-side API call from Server Components. The browser's cookies do not travel by themselves
 * here (docs/API.md §3), so the access cookie of the incoming request is forwarded. Only GETs:
 * server components cannot set cookies, so no refresh happens here — an expired session goes
 * through the resume route instead (see src/core/auth/session.ts).
 */
export async function serverApiGet<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const cookieStore = await cookies();
  const access = cookieStore.get(ACCESS_COOKIE)?.value;
  const headers = new Headers({ Accept: 'application/json' });
  if (access) headers.set('Cookie', `${ACCESS_COOKIE}=${access}`);

  let response: Response;
  try {
    response = await fetch(`${serverApiBaseUrl()}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
    throw new ApiError({
      kind: timedOut ? 'timeout' : 'network',
      status: 0,
      code: timedOut ? 'TIMEOUT' : 'NETWORK',
      message: timedOut ? 'API request timed out' : 'API could not be reached',
      details: cause,
    });
  }

  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) throw apiErrorFromResponse(response.status, body, response.headers);
  return body as T;
}

/** `serverApiGet` as an `ApiGetter`, so a query factory can be prefetched in a Server Component. */
export const serverGetter: ApiGetter = (path, { query }) =>
  serverApiGet(`${path}${queryString(query)}`);
