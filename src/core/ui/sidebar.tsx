'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { NavItem } from '@/core/navigation/types';
import { cn } from './cn';
import { NavLinks } from './nav-links';

export interface SidebarProps {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
}

/** Desktop sidebar (md and up). On phones the same links live in <MobileDrawer>. */
export function Sidebar({ title, items, collapsed, onToggle }: SidebarProps) {
  const t = useTranslations();

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 rounded-none border-y-0 border-l-0 glass p-3 md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn('flex items-center gap-2', collapsed ? 'justify-center' : 'justify-between')}
      >
        {collapsed ? null : (
          <span className="truncate px-2 text-base font-semibold text-fg">{title}</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? t('shell.expandSidebar') : t('shell.collapseSidebar')}
          aria-expanded={!collapsed}
          className="inline-flex size-10 items-center justify-center rounded-lg text-fg hover:bg-surface-muted"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-5" />
          ) : (
            <PanelLeftClose aria-hidden className="size-5" />
          )}
        </button>
      </div>
      {/* The menu scrolls inside itself on short screens; the page never has to. */}
      <nav aria-label={t('nav.label')} className="min-h-0 flex-1 overflow-y-auto">
        <NavLinks items={items} collapsed={collapsed} />
      </nav>
    </aside>
  );
}
