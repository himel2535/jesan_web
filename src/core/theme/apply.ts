import { setPreferenceCookie } from '@/core/lib/cookies';
import { THEME_COOKIE, type Theme } from './config';

/** Switch the theme instantly (CSS reacts to <html data-theme>) and remember it for the server. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  setPreferenceCookie(THEME_COOKIE, theme);
}
