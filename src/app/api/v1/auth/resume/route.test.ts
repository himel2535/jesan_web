// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// Exactly what jesan-api sends (docs/API.md §2), values replaced.
const API_COOKIES = [
  'jesan_at=new-at; Max-Age=900; Path=/; Expires=Tue, 17 Nov 2026 07:50:25 GMT; HttpOnly; SameSite=Lax',
  'jesan_rt=new-rt; Max-Age=2592000; Path=/api/v1/auth; Expires=Thu, 17 Dec 2026 07:35:25 GMT; HttpOnly; SameSite=Lax; Secure',
];

function apiResponse(status: number, cookies: string[] = []) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(status === 200 ? { status: 'ok' } : { statusCode: status }), {
    status,
    headers,
  });
}

function resumeRequest(next: string, headers: Record<string, string> = {}) {
  return new NextRequest(
    `http://localhost:3000/api/v1/auth/resume?next=${encodeURIComponent(next)}`,
    {
      headers: { host: 'localhost:3000', cookie: 'jesan_rt=old-rt; NEXT_LOCALE=bn', ...headers },
    },
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000/api/v1');
  vi.stubEnv('APP_ORIGIN', '');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/v1/auth/resume', () => {
  it('calls POST /auth/refresh on the API with the cookies and an explicit Origin', async () => {
    fetchMock.mockResolvedValueOnce(apiResponse(200, API_COOKIES));
    await GET(resumeRequest('/b/akij-cement/sales'));

    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe('http://api.internal:4000/api/v1/auth/refresh');
    expect(init.method).toBe('POST');
    expect(headers.get('cookie')).toBe('jesan_rt=old-rt; NEXT_LOCALE=bn');
    // jesan-api's CSRF check: cookie-authenticated POSTs need an allowed Origin (§4).
    expect(headers.get('origin')).toBe('http://localhost:3000');
  });

  it('takes the Origin from APP_ORIGIN when set', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://app.example.com');
    fetchMock.mockResolvedValueOnce(apiResponse(200, API_COOKIES));
    const response = await GET(resumeRequest('/b/x', { host: 'internal:3000' }));
    expect(new Headers((fetchMock.mock.calls[0]![1] as RequestInit).headers).get('origin')).toBe(
      'https://app.example.com',
    );
    expect(response.headers.get('location')).toBe('https://app.example.com/b/x');
  });

  it('takes the Origin from forwarded headers behind a proxy', async () => {
    fetchMock.mockResolvedValueOnce(apiResponse(200, API_COOKIES));
    await GET(
      resumeRequest('/', {
        host: 'internal:3000',
        'x-forwarded-host': 'app.example.com',
        'x-forwarded-proto': 'https',
      }),
    );
    expect(new Headers((fetchMock.mock.calls[0]![1] as RequestInit).headers).get('origin')).toBe(
      'https://app.example.com',
    );
  });

  it('on success relays the Set-Cookie headers byte for byte and returns to next', async () => {
    fetchMock.mockResolvedValueOnce(apiResponse(200, API_COOKIES));
    const response = await GET(resumeRequest('/b/akij-cement/sales?page=2'));

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/b/akij-cement/sales?page=2',
    );
    const cookies = response.headers.getSetCookie();
    // Every attribute intact: HttpOnly, SameSite, Secure, Max-Age, Expires and the refresh Path.
    expect(cookies.slice(0, 2)).toEqual(API_COOKIES);
    expect(cookies[1]).toContain('Path=/api/v1/auth');
    // Plus the short loop guard.
    expect(cookies[2]).toBe('jesan_resumed=1; Max-Age=15; Path=/; HttpOnly; SameSite=Lax');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('on a refused refresh goes to /login with next and relays the cookie-clearing headers', async () => {
    const clearing = [
      'jesan_at=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
      'jesan_rt=; Max-Age=0; Path=/api/v1/auth; HttpOnly; SameSite=Lax',
    ];
    fetchMock.mockResolvedValueOnce(apiResponse(401, clearing));
    const response = await GET(resumeRequest('/b/akij-cement'));
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?next=%2Fb%2Fakij-cement',
    );
    expect(response.headers.getSetCookie()).toEqual(clearing);
  });

  it('when the API is down, goes to /login without crashing', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const response = await GET(resumeRequest('/'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('never redirects to another site', async () => {
    fetchMock.mockResolvedValueOnce(apiResponse(200, API_COOKIES));
    const response = await GET(resumeRequest('https://evil.example/steal'));
    expect(response.headers.get('location')).toBe('http://localhost:3000/');
  });
});
