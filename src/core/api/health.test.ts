// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_API_BASE, DEFAULT_INTERNAL_API_URL, serverApiBaseUrl } from './config';
import { checkBackendHealth } from './health';

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('API addresses after removing NEXT_PUBLIC_API_URL', () => {
  it('browser code always uses the same-origin proxy path', () => {
    expect(BROWSER_API_BASE).toBe('/api/v1');
  });

  it('server code uses API_INTERNAL_URL, defaulting to the local API', () => {
    vi.stubEnv('API_INTERNAL_URL', '');
    expect(serverApiBaseUrl()).toBe(DEFAULT_INTERNAL_API_URL);
    vi.stubEnv('API_INTERNAL_URL', 'https://api.example.com/api/v1/');
    expect(serverApiBaseUrl()).toBe('https://api.example.com/api/v1');
  });
});

describe('checkBackendHealth (login page status line)', () => {
  it('calls {API_INTERNAL_URL}/health from the server and reports up/down', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.internal:4000/api/v1');
    fetchMock.mockResolvedValueOnce(new Response('{"status":"ok"}', { status: 200 }));
    await expect(checkBackendHealth()).resolves.toBe(true);
    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.internal:4000/api/v1/health');

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(checkBackendHealth()).resolves.toBe(false);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(checkBackendHealth()).resolves.toBe(false);
  });
});
