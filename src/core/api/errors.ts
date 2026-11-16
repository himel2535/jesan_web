export type ApiErrorKind = 'http' | 'network' | 'timeout';

/** The one error shape every API call throws. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status; 0 for network and timeout errors. */
  readonly status: number;
  /** Stable machine-readable code, e.g. `HTTP_404`, `NETWORK`, `TIMEOUT` or the backend's own. */
  readonly code: string;
  readonly details?: unknown;

  constructor(init: {
    kind: ApiErrorKind;
    status: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** 4xx: the request itself is wrong, so retrying it will not help. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Accepts both `{ error: { code, message, details } }` and the NestJS default
 * `{ statusCode, message: string | string[], error }`, so the backend format can settle later.
 */
export function apiErrorFromResponse(status: number, body: unknown): ApiError {
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
    });
  }

  return new ApiError({ kind: 'http', status, code: fallbackCode, message: fallbackMessage });
}
