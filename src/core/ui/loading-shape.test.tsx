import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoA11yViolations } from '../../../test/utils';
import { DetailSkeleton, FormSkeleton, ListSkeleton } from './skeleton';

/**
 * There must be no route `loading.tsx` anywhere under the app: a route fallback is a Suspense
 * boundary, so it blanks the page under it and the user then watches the shape change twice
 * (fallback, then the page's own skeleton). The click is answered by `<RouteProgress>` inside the
 * link instead (DECISIONS.md). This is the guard that keeps "one skeleton per page" true.
 */
describe('route fallbacks', () => {
  it('no app route declares its own loading.tsx', async () => {
    const { globSync } = await import('node:fs');
    expect(globSync('src/app/**/loading.tsx')).toEqual([]);
  });
});

describe('page-shaped skeletons', () => {
  it('a list is a toolbar and ten rows, in one busy region', () => {
    const { container } = render(<ListSkeleton />);
    const busy = container.querySelectorAll('[aria-busy="true"]');
    expect(busy).toHaveLength(1);
    // 3 toolbar filters + 10 rows, matching <Pagination>'s ten per page.
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(13);
  });

  it('a detail page is a header, a summary and a table', () => {
    const { container } = render(<DetailSkeleton lines={4} />);
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1 + 6 + 4);
  });

  it('a form is fields, a line area and a button', () => {
    const { container } = render(<FormSkeleton />);
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
  });

  it('is invisible to assistive tech beyond "busy", and raises no a11y violation', async () => {
    const { container } = render(<ListSkeleton rows={2} />);
    for (const block of container.querySelectorAll('.animate-pulse')) {
      expect(block).toHaveAttribute('aria-hidden');
    }
    await expectNoA11yViolations(container);
  });
});
