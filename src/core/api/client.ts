import { API_BASE_URL } from './config';
import { ApiError, apiErrorFromResponse } from './errors';

export const DEFAULT_TIMEOUT_MS = 3000;

/** Refresh endpoint of jesan-api (cookie based). Align with the backend when auth lands. */
export const AUTH_REFRESH_PATH = '/auth/refresh';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Plain objects are sent as JSON; FormData is sent as-is. */
  body?: unknown;
  query?: QueryParams;
  headers?: HeadersInit;
  /** Caller cancellation, e.g. TanStack Query's signal. */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Skip the automatic refresh-and-retry on 401. */
  skipAuthRefresh?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;
let onAuthFailure: (() => void) | null = null;

/** Called when the session cannot be refreshed (the login step will redirect here). */
export function setAuthFailureHandler(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

export function buildUrl(path: string, query?: QueryParams): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function send(path: string, options: ApiRequestOptions): Promise<Response> {
  const { method = 'GET', body, query, headers, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  const finalHeaders = new Headers(headers);
  finalHeaders.set('Accept', 'application/json');
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers: finalHeaders,
      body: payload,
      credentials: 'include',
      signal: combined,
    });
  } catch (cause) {
    // A cancellation by the caller is not an API error: let it propagate unchanged.
    if (signal?.aborted) throw cause;
    if (timeoutSignal.aborted) {
      throw new ApiError({
        kind: 'timeout',
        status: 0,
        code: 'TIMEOUT',
        message: `Request timed out after ${timeoutMs} ms`,
      });
    }
    throw new ApiError({
      kind: 'network',
      status: 0,
      code: 'NETWORK',
      message: 'Network error: the server could not be reached',
      details: cause,
    });
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** One refresh at a time: concurrent 401s share the same refresh request. */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= send(AUTH_REFRESH_PATH, { method: 'POST', skipAuthRefresh: true })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function isAuthPath(path: string): boolean {
  return path.replace(/^\/?/, '/').startsWith('/auth/');
}

/**
 * fetch-based API call: cookies included, 3 s timeout, one normalized error type (ApiError).
 * On 401 it refreshes the session once and retries the request once.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && !options.skipAuthRefresh && !isAuthPath(path)) {
    if (await refreshSession()) {
      response = await send(path, options);
    }
    if (response.status === 401) onAuthFailure?.();
  }

  const body = await readBody(response);
  if (!response.ok) throw apiErrorFromResponse(response.status, body);
  return body as T;
}
