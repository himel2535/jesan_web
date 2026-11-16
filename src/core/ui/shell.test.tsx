import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations, renderWithIntl } from '../../../test/utils';
import { buildCoreNav } from '@/core/navigation/core-nav';
import type { NavItem } from '@/core/navigation/types';
import { AppShell } from './app-shell';
import { LocaleSwitcher } from './locale-switcher';
import { Modal } from './modal';
import { ThemeToggle } from './theme-toggle';

const router = vi.hoisted(() => ({ refresh: vi.fn(), prefetch: vi.fn(), pathname: '/' }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => router.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const items: NavItem[] = [
  { key: 'home', label: 'Home', href: '/', icon: 'home', prefetch: 'hover' },
  { key: 'ui', label: 'UI demo', href: '/dev/ui', icon: 'palette' },
];

beforeEach(() => {
  router.refresh.mockReset();
  router.prefetch.mockReset();
  router.pathname = '/';
});

describe('<ThemeToggle>', () => {
  it('switches the theme on <html> and remembers it in a cookie', async () => {
    renderWithIntl(<ThemeToggle initialTheme="system" />);
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.cookie).toContain('theme=dark');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('<LocaleSwitcher>', () => {
  it('saves the language cookie and re-renders on the server', async () => {
    renderWithIntl(<LocaleSwitcher />, { locale: 'en' });
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'বাংলা' }));

    expect(document.cookie).toContain('NEXT_LOCALE=bn');
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('does nothing when the current language is chosen again', async () => {
    renderWithIntl(<LocaleSwitcher />, { locale: 'en' });
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe('<AppShell>', () => {
  const renderShell = (collapsed = false) =>
    renderWithIntl(
      <AppShell navItems={items} initialCollapsed={collapsed} theme="light">
        <p>content</p>
      </AppShell>,
    );

  it('marks the current page and has a skip link to main content', () => {
    router.pathname = '/dev/ui';
    renderShell();
    const sidebarNav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(sidebarNav).getByRole('link', { name: 'UI demo' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebarNav).getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });

  it('collapses the sidebar and remembers it', async () => {
    renderShell();
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(document.cookie).toContain('sidebar=collapsed');
  });

  it('prefetches only hover-enabled links, and only on hover or focus', async () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(router.prefetch).not.toHaveBeenCalled();

    await userEvent.hover(within(nav).getByRole('link', { name: 'UI demo' }));
    expect(router.prefetch).not.toHaveBeenCalled();

    await userEvent.hover(within(nav).getByRole('link', { name: 'Home' }));
    expect(router.prefetch).toHaveBeenCalledWith('/');
  });

  it('opens the mobile drawer from the menu button and closes it', async () => {
    renderShell();
    const drawer = screen.getByRole('dialog', { hidden: true });
    expect(drawer).not.toHaveAttribute('open');

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(drawer).toHaveAttribute('open');

    await userEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    expect(drawer).not.toHaveAttribute('open');
  });

  it('has no basic accessibility violations', async () => {
    const { container } = renderShell();
    await expectNoA11yViolations(container);
  });
});

describe('<Modal>', () => {
  it('is labelled by its title and calls onClose from the close button', async () => {
    const onClose = vi.fn();
    renderWithIntl(
      <Modal open onClose={onClose} title="Example">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Example' });
    expect(dialog).toHaveAttribute('open');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('buildCoreNav', () => {
  it('hides development-only entries in production', () => {
    const label = (key: string) => key;
    expect(buildCoreNav(label, false).map((i) => i.href)).toEqual(['/', '/dev/ui']);
    expect(buildCoreNav(label, true).map((i) => i.href)).toEqual(['/']);
  });
});
