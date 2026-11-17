// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { managerMe } from '../../../test/fixtures/me';

const state = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  headers: new Map<string, string>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    has: (name: string) => state.cookies.has(name),
    get: (name: string) =>
      state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined,
  }),
  headers: async () => ({ get: (name: string) => state.headers.get(name) ?? null }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { url });
  },
}));

const { getSession, requireSession } = await import('./session');

let fetchMock: ReturnType<typeof vi.fn>;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  state.cookies = new Map([['jesan_at', 'access-token']]);
  state.headers = new Map([['x-jesan-pathname', '/b/example-cement/sales']]);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000/api/v1');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const redirectTarget = () =>
  requireSession().then(
    () => null,
    (error: { url?: string }) => error.url,
  );

describe('getSession (server-side GET /auth/me)', () => {
  it('forwards only the access cookie to the API and returns the session', async () => {
    state.cookies.set('NEXT_LOCALE', 'bn');
    fetchMock.mockResolvedValueOnce(json(200, managerMe));
    await expect(getSession()).resolves.toEqual({ status: 'authenticated', me: managerMe });
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('http://api.internal:4000/api/v1/auth/me');
    expect(new Headers(init.headers).get('cookie')).toBe('jesan_at=access-token');
  });

  it('without an access cookie does not call the API', async () => {
    state.cookies.clear();
    await expect(getSession()).resolves.toEqual({ status: 'unauthenticated' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('401 → unauthenticated; network error or 5xx → unavailable (never a logout)', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401 }));
    await expect(getSession()).resolves.toEqual({ status: 'unauthenticated' });
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(getSession()).resolves.toEqual({ status: 'unavailable' });
    fetchMock.mockResolvedValueOnce(json(503, { statusCode: 503 }));
    await expect(getSession()).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('requireSession (protected pages)', () => {
  it('unauthenticated → resume (server refresh) with the current page as next', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401 }));
    await expect(redirectTarget()).resolves.toBe(
      '/api/v1/auth/resume?next=%2Fb%2Fexample-cement%2Fsales',
    );
  });

  it('right after a resume (guard cookie) → /login, so it can never loop', async () => {
    state.cookies.set('jesan_resumed', '1');
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401 }));
    await expect(redirectTarget()).resolves.toBe('/login?next=%2Fb%2Fexample-cement%2Fsales');
  });

  it('API down → returns "unavailable" instead of redirecting', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(requireSession()).resolves.toEqual({ status: 'unavailable' });
  });
});
