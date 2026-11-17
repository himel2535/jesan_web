import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { ApiError } from '@/core/api/errors';
import { serverApiGet } from '@/core/api/server';
import { ACCESS_COOKIE, PATHNAME_HEADER, RESUME_GUARD_COOKIE } from './constants';
import { loginPath, resumePath } from './next-path';
import type { Me } from './types';

export type SessionResult =
  { status: 'authenticated'; me: Me } | { status: 'unauthenticated' } | { status: 'unavailable' };

/**
 * The session, checked on the server with the cookie (GET /auth/me). Called at most once per
 * request (React cache); deliberately not cached across requests, so a permission change in
 * Settings applies on the very next navigation.
 */
export const getSession = cache(async (): Promise<SessionResult> => {
  const cookieStore = await cookies();
  if (!cookieStore.has(ACCESS_COOKIE)) return { status: 'unauthenticated' };
  try {
    return { status: 'authenticated', me: await serverApiGet<Me>('/auth/me') };
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) return { status: 'unauthenticated' };
    return { status: 'unavailable' };
  }
});

/** Where an unauthenticated request should go: resume once, then login (never a loop). */
export async function sessionRedirectTarget(): Promise<string> {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const next = headerStore.get(PATHNAME_HEADER) ?? '/';
  return cookieStore.has(RESUME_GUARD_COOKIE) ? loginPath(next) : resumePath(next);
}

/**
 * Protected pages: returns the session, or redirects. `unavailable` (API down) is returned so the
 * layout can show "server unavailable" instead of sending a logged-in user to the login page.
 */
export async function requireSession(): Promise<
  Exclude<SessionResult, { status: 'unauthenticated' }>
> {
  const session = await getSession();
  if (session.status === 'unauthenticated') redirect(await sessionRedirectTarget());
  return session;
}
