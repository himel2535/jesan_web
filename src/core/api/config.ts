const DEFAULT_API_URL = 'http://localhost:4000/api/v1';

/** Base URL of jesan-api, without a trailing slash. */
export const API_BASE_URL: string = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(
  /\/+$/,
  '',
);
