'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/core/api/client';
import { DEFAULT_STALE_TIME_MS } from '@/core/api/query-client';
import { createModuleKeys } from '@/core/api/query-keys';
import { useCurrentBusiness } from '@/core/auth/session-context';
import type { ListPrefetch } from '@/core/module-system/types';
import type { NavItem } from '@/core/navigation/types';
import { cn } from './cn';
import { navIcons } from './icons';
import { RouteProgress } from './route-progress';
import { PendingApprovalsBadge } from '@/core/approvals/pending-badge';

export function isActive(pathname: string, href: string, exact = false): boolean {
  if (href === '/' || exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Warms the one query the hovered page asks for first, under exactly the key that page's own
 * hook builds (`[type, businessId, entity, 'list', params]`), so the click finds the rows ready.
 * Returns undefined when there is nothing to warm, so no handler is attached at all.
 */
function useListWarmer(listPrefetch: ListPrefetch | undefined): (() => void) | undefined {
  const queryClient = useQueryClient();
  const business = useCurrentBusiness();
  if (!listPrefetch || !business) return undefined;

  const { entity, path, params } = listPrefetch;
  const query = params ?? {};
  return () =>
    void queryClient.prefetchQuery({
      queryKey: createModuleKeys(business.type).list(business.id, entity, query),
      queryFn: ({ signal }) =>
        apiFetch(`/b/${encodeURIComponent(business.slug)}/${path}`, { query, signal }),
      staleTime: DEFAULT_STALE_TIME_MS,
    });
}

/**
 * Sidebar links. They fetch nothing on their own: prefetch is off unless an item opts in, and
 * `'hover'` acts only when the pointer or keyboard focus reaches the link (§9.2 rule 2). For a
 * light list page an item may also name its first list query, which is then warmed on that same
 * hover or focus — one request, never on render (DECISIONS.md).
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

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink
          key={item.key}
          item={item}
          active={isActive(pathname, item.href, item.exact)}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const warmList = useListWarmer(item.listPrefetch);
  const Icon = navIcons[item.icon];
  const hover = item.prefetch === 'hover';
  const prefetchOnIntent =
    hover || warmList
      ? () => {
          if (hover) router.prefetch(item.href);
          warmList?.();
        }
      : undefined;

  return (
    <li>
      <Link
        href={item.href}
        prefetch={item.prefetch === true}
        onMouseEnter={prefetchOnIntent}
        onFocus={prefetchOnIntent}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? item.label : undefined}
        className={cn(
          'relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium',
          active ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-surface-muted',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon aria-hidden className="size-5 shrink-0" />
        <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
        {item.badge === 'pendingApprovals' ? <PendingApprovalsBadge collapsed={collapsed} /> : null}
        {/* Answers the click while the next page is still being rendered on the server. */}
        <RouteProgress />
      </Link>
    </li>
  );
}
