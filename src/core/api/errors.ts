export type ApiErrorKind = 'http' | 'network' | 'timeout';

/** The one error shape every API call throws. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status; 0 for network and timeout errors. */
  readonly status: number;
  /** Stable machine-readable code, e.g. `HTTP_404`, `NETWORK`, `TIMEOUT` or the backend's own. */
  readonly code: string;
  readonly details?: unknown;
  /** From the Retry-After header (429): seconds to wait before trying again. */
  readonly retryAfterSeconds?: number;
  /** Errors of single form fields (docs/API.md §11 `errors[]`, or `field` + `code`). */
  readonly fieldErrors: readonly FieldError[];

  constructor(init: {
    kind: ApiErrorKind;
    status: number;
    code: string;
    message: string;
    details?: unknown;
    retryAfterSeconds?: number;
    fieldErrors?: readonly FieldError[];
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.fieldErrors = init.fieldErrors ?? [];
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** 4xx: the request itself is wrong, so retrying it will not help. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** The server could not be reached or is failing: show "server unavailable", not "wrong input". */
  get isServerUnavailable(): boolean {
    return this.kind !== 'http' || this.status >= 500;
  }
}

/** One field's error: the request-body key (dot path for nested) and its stable code. */
export interface FieldError {
  field: string;
  code: string;
}

/** `errors[]` entries with a string field and code; else the top-level `field` + `code`. */
function parseFieldErrors(body: Record<string, unknown>): FieldError[] {
  if (Array.isArray(body.errors)) {
    return body.errors.flatMap((e) =>
      isRecord(e) && typeof e.field === 'string' && typeof e.code === 'string'
        ? [{ field: e.field, code: e.code }]
        : [],
    );
  }
  if (typeof body.field === 'string' && typeof body.code === 'string') {
    return [{ field: body.field, code: body.code }];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Accepts both `{ error: { code, message, details } }` and the NestJS default
 * `{ statusCode, message: string | string[], error }`, so the backend format can settle later.
 */
export function apiErrorFromResponse(status: number, body: unknown, headers?: Headers): ApiError {
  const retryAfterSeconds = parseRetryAfter(headers?.get('retry-after'));
  const fallbackCode = `HTTP_${status}`;
  const fallbackMessage = `Request failed with status ${status}`;

  if (isRecord(body) && isRecord(body.error)) {
    const { code, message, details } = body.error;
    return new ApiError({
      kind: 'http',
      status,
      code: typeof code === 'string' ? code : fallbackCode,
      message: typeof message === 'string' ? message : fallbackMessage,
      details,
      retryAfterSeconds,
    });
  }

  if (isRecord(body) && 'message' in body) {
    const { message, error } = body;
    const list = Array.isArray(message) ? message.filter((m) => typeof m === 'string') : undefined;
    return new ApiError({
      kind: 'http',
      status,
      code: typeof body.code === 'string' ? body.code : fallbackCode,
      message: list ? list.join('; ') : typeof message === 'string' ? message : fallbackMessage,
      details: list ?? (typeof error === 'string' ? error : undefined),
      retryAfterSeconds,
      fieldErrors: parseFieldErrors(body),
    });
  }

  return new ApiError({
    kind: 'http',
    status,
    code: fallbackCode,
    message: fallbackMessage,
    retryAfterSeconds,
  });
}

/** Retry-After is either seconds or an HTTP date; returns whole seconds, or undefined. */
export function parseRetryAfter(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - now) / 1000));
}
