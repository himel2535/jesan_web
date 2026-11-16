import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_REFRESH_PATH, apiFetch, buildUrl, setAuthFailureHandler } from './client';
import { API_BASE_URL } from './config';
import { ApiError, apiErrorFromResponse } from './errors';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn<Handler>>;

beforeEach(() => {
  fetchMock = vi.fn<Handler>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setAuthFailureHandler(null);
});

const paths = () => fetchMock.mock.calls.map(([url]) => url.replace(API_BASE_URL, ''));

describe('apiFetch', () => {
  it('sends cookies, JSON and returns the parsed body', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await expect(apiFetch('/things', { method: 'POST', body: { a: 1 } })).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_BASE_URL}/things`);
    expect(init.credentials).toBe('include');
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('builds query strings and drops empty values', () => {
    expect(buildUrl('/list', { page: 2, q: 'abc', empty: undefined, none: null })).toBe(
      `${API_BASE_URL}/list?page=2&q=abc`,
    );
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiFetch('/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('throws a normalized ApiError for HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(json(404, { statusCode: 404, message: 'Not found' }));
    const error = await apiFetch('/missing').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'http',
      status: 404,
      code: 'HTTP_404',
      message: 'Not found',
    });
  });

  it('turns network failures into ApiError(kind: network)', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(apiFetch('/x')).rejects.toMatchObject({
      kind: 'network',
      status: 0,
      code: 'NETWORK',
    });
  });

  it('times out after 3 seconds by default', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const result = apiFetch('/slow', { timeoutMs: 20 }).catch((e: unknown) => e);
    await expect(result).resolves.toMatchObject({ kind: 'timeout', code: 'TIMEOUT' });
    expect(timeoutSpy).toHaveBeenCalledWith(20);

    fetchMock.mockResolvedValueOnce(json(200, {}));
    await apiFetch('/fast');
    expect(timeoutSpy).toHaveBeenLastCalledWith(3000);
  });

  it('lets a caller cancellation propagate unchanged', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')));
        }),
    );
    const result = apiFetch('/x', { signal: controller.signal }).catch((e: unknown) => e);
    controller.abort();
    const error = await result;
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as DOMException).name).toBe('AbortError');
  });
});

describe('apiFetch auth refresh', () => {
  it('on 401 refreshes once and retries the request once', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200)) // refresh
      .mockResolvedValueOnce(json(200, { id: 1 }));
    await expect(apiFetch('/me')).resolves.toEqual({ id: 1 });
    expect(paths()).toEqual(['/me', AUTH_REFRESH_PATH, '/me']);
    expect(fetchMock.mock.calls[1]![1].method).toBe('POST');
  });

  it('gives up with 401 and calls the auth-failure handler when refresh fails', async () => {
    const onFailure = vi.fn();
    setAuthFailureHandler(onFailure);
    fetchMock.mockResolvedValueOnce(json(401)).mockResolvedValueOnce(json(401));
    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(paths()).toEqual(['/me', AUTH_REFRESH_PATH]);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it('does not loop when the retried request is still 401', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200))
      .mockResolvedValueOnce(json(401));
    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('shares one refresh between concurrent 401s', async () => {
    let resolveRefresh: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url) => {
      if (url.endsWith(AUTH_REFRESH_PATH)) {
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        });
      }
      const retried = fetchMock.mock.calls.filter(([u]) => u === url).length > 1;
      return json(retried ? 200 : 401, { url });
    });
    const both = Promise.all([apiFetch('/a'), apiFetch('/b')]);
    await vi.waitFor(() => expect(paths().filter((p) => p === AUTH_REFRESH_PATH)).toHaveLength(1));
    resolveRefresh(json(200));
    await both;
    expect(paths().filter((p) => p === AUTH_REFRESH_PATH)).toHaveLength(1);
  });

  it('never refreshes for /auth/* calls or when skipped', async () => {
    fetchMock.mockResolvedValue(json(401));
    await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    });
    await expect(apiFetch('/me', { skipAuthRefresh: true })).rejects.toMatchObject({ status: 401 });
    expect(paths()).toEqual(['/auth/login', '/me']);
  });
});

describe('apiErrorFromResponse', () => {
  it('reads the { error: { code, message, details } } shape', () => {
    expect(
      apiErrorFromResponse(409, {
        error: { code: 'STOCK_LOW', message: 'Not enough stock', details: { left: 3 } },
      }),
    ).toMatchObject({
      status: 409,
      code: 'STOCK_LOW',
      message: 'Not enough stock',
      details: { left: 3 },
    });
  });

  it('joins NestJS validation messages', () => {
    const error = apiErrorFromResponse(400, {
      statusCode: 400,
      message: ['qty must be positive', 'date is required'],
      error: 'Bad Request',
    });
    expect(error.message).toBe('qty must be positive; date is required');
    expect(error.details).toEqual(['qty must be positive', 'date is required']);
    expect(error.isClientError).toBe(true);
  });

  it('falls back for unknown bodies', () => {
    expect(apiErrorFromResponse(500, 'oops')).toMatchObject({ code: 'HTTP_500', kind: 'http' });
  });
});
