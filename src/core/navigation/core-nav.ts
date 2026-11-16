import type { NavIconName } from '@/core/ui/icons';
import type { NavItem, NavPrefetch } from './types';

interface CoreNavEntry {
  key: string;
  labelKey: 'home' | 'uiDemo';
  href: string;
  icon: NavIconName;
  prefetch?: NavPrefetch;
  devOnly?: boolean;
}

const coreNav: readonly CoreNavEntry[] = [
  { key: 'home', labelKey: 'home', href: '/', icon: 'home', prefetch: 'hover' },
  { key: 'ui-demo', labelKey: 'uiDemo', href: '/dev/ui', icon: 'palette', devOnly: true },
];

export function buildCoreNav(
  translate: (key: CoreNavEntry['labelKey']) => string,
  isProduction = process.env.NODE_ENV === 'production',
): NavItem[] {
  return coreNav
    .filter((entry) => !(entry.devOnly && isProduction))
    .map(({ labelKey, devOnly: _devOnly, ...rest }) => ({ ...rest, label: translate(labelKey) }));
}
