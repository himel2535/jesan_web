export const themes = ['light', 'dark', 'system'] as const;
export type Theme = (typeof themes)[number];

export const THEME_COOKIE = 'theme';
export const defaultTheme: Theme = 'system';

export function resolveTheme(value?: string | null): Theme {
  return (themes as readonly string[]).includes(value ?? '') ? (value as Theme) : defaultTheme;
}

export const SIDEBAR_COOKIE = 'sidebar';
export type SidebarState = 'expanded' | 'collapsed';
