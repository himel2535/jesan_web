/**
 * Copies every Set-Cookie header from an API response onto our response, byte for byte.
 * Nothing is parsed or rebuilt, so HttpOnly, SameSite, Secure, Max-Age/Expires and Path (notably
 * `jesan_rt`'s `Path=/api/v1/auth`) reach the browser exactly as the API set them.
 */
export function relaySetCookies(from: Headers, to: Headers): void {
  for (const cookie of from.getSetCookie()) to.append('set-cookie', cookie);
}
