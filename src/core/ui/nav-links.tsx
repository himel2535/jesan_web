'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { NavItem } from '@/core/navigation/types';
import { cn } from './cn';
import { navIcons } from './icons';

export function isActive(pathname: string, href: string, exact = false): boolean {
  if (href === '/' || exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Sidebar links. They fetch no data themselves. Prefetch is off unless an item opts in;
 * `'hover'` prefetches only when the pointer or keyboard focus reaches the link (§9.2 rule 2).
 */
export function NavLinks({
  items,
  collapsed = false,
  onNavigate,
}: {
  items: NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = navIcons[item.icon];
        const active = isActive(pathname, item.href, item.exact);
        const hover = item.prefetch === 'hover';
        const prefetchOnIntent = hover ? () => router.prefetch(item.href) : undefined;
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              prefetch={item.prefetch === true}
              onMouseEnter={prefetchOnIntent}
              onFocus={prefetchOnIntent}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                active ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-surface-muted',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
