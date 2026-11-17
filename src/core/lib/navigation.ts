/**
 * Full-page navigation (not client-side routing). Used after sign-in, sign-out and when the
 * session is over, so the server renders with the new cookies and every cached query is dropped.
 * One function so tests can replace it.
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
