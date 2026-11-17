import { serverApiBaseUrl } from './config';

const HEALTH_TIMEOUT_MS = 3000;

/**
 * Server-side: true when GET {API_INTERNAL_URL}/health answers with a 2xx status.
 * Any network error, timeout or non-2xx status counts as "down".
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${serverApiBaseUrl()}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
