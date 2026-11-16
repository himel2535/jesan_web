'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { applyTheme } from '@/core/theme/apply';
import { themes, type Theme } from '@/core/theme/config';
import { cn } from './cn';

const icons = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Light / dark / system. The server already rendered <html data-theme> from the cookie, so there
 * is no flash on load; here we only switch the attribute and remember the choice.
 */
export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const t = useTranslations('theme');
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const choose = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex items-center rounded-lg border border-border p-0.5"
    >
      {themes.map((value) => {
        const Icon = icons[value];
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={theme === value}
            aria-label={t(value)}
            title={t(value)}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-md',
              theme === value ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-surface-muted',
            )}
          >
            <Icon aria-hidden className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
