import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { checkBackendHealth } from '@/core/api/health';
import { safeNextPath } from '@/core/auth/next-path';
import { getSession } from '@/core/auth/session';
import { LoginForm } from '@/core/auth/ui/login-form';
import { getShellPrefs } from '@/core/theme/server';
import { cn } from '@/core/ui/cn';
import { LocaleSwitcher } from '@/core/ui/locale-switcher';
import { ThemeToggle } from '@/core/ui/theme-toggle';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('title') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  const [session, backendUp, prefs, t] = await Promise.all([
    getSession(),
    checkBackendHealth(),
    getShellPrefs(),
    getTranslations(),
  ]);

  // Already signed in (e.g. another tab refreshed the session): go where the user was heading.
  if (session.status === 'authenticated') redirect(next);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-end gap-2 p-4">
        <LocaleSwitcher />
        <ThemeToggle initialTheme={prefs.theme} />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md space-y-6 rounded-card glass p-6 sm:p-8">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-fg-muted">{t('common.appName')}</p>
            <h1 className="text-page-title font-semibold text-fg">{t('auth.title')}</h1>
            <p className="text-sm text-fg-muted">{t('auth.subtitle')}</p>
          </div>
          <LoginForm next={next} />
        </div>
      </main>
      <footer className="flex justify-center p-4">
        <p role="status" className="flex items-center gap-2 text-sm text-fg-muted">
          <span
            aria-hidden
            className={cn('size-2.5 rounded-full', backendUp ? 'bg-success' : 'bg-danger')}
          />
          {backendUp ? t('status.backendUp') : t('status.backendDown')}
        </p>
      </footer>
    </div>
  );
}
