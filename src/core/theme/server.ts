import { cookies } from 'next/headers';
import { SIDEBAR_COOKIE, THEME_COOKIE, resolveTheme, type Theme } from './config';

/** Display preferences read on the server, so the first HTML is already right (no flash). */
export async function getShellPrefs(): Promise<{ theme: Theme; sidebarCollapsed: boolean }> {
  const cookieStore = await cookies();
  return {
    theme: resolveTheme(cookieStore.get(THEME_COOKIE)?.value),
    sidebarCollapsed: cookieStore.get(SIDEBAR_COOKIE)?.value === 'collapsed',
  };
}
