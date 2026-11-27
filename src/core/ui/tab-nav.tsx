'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/core/ui/cn';

/** Tabs between sections of a page (only those the user may open). */
export function TabNav({
  label,
  items,
  exact = false,
}: {
  label: string;
  items: { href: string; label: string }[];
  /** Match only the exact path (when one tab's path is a prefix of another's). */
  exact?: boolean;
}) {
  const pathname = usePathname();
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className="mb-6 border-b border-border">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.href || (!exact && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-medium whitespace-nowrap',
                  active
                    ? 'border-fg text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
