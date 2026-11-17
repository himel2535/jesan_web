/**
 * This web site's public origin (scheme + host + port), e.g. `http://localhost:3000`.
 *
 * Used as the `Origin` header when the server calls a state-changing API endpoint for the
 * browser (jesan-api rejects cookie-authenticated POSTs whose Origin is not in CORS_ORIGIN), and
 * for absolute redirect URLs. APP_ORIGIN wins when set (recommended in production behind proxies);
 * otherwise it comes from the incoming request's forwarded or Host headers.
 */
export function webOrigin(
  headers: Headers,
  requestUrl: string,
  appOrigin = process.env.APP_ORIGIN,
) {
  if (appOrigin) return appOrigin.replace(/\/+$/, '');

  const fallback = new URL(requestUrl);
  const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || headers.get('host') || fallback.host;
  const forwardedProto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwardedProto || fallback.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}
