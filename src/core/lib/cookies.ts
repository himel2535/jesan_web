const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Writes a non-sensitive preference cookie (theme, language, sidebar) from the browser. */
export function setPreferenceCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
