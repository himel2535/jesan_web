import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations, renderWithIntl } from '../../../test/utils';
import { Pagination } from './pagination';
import { getPageItems, pageRange, parsePageParam, totalPages } from './pagination-logic';

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/sales',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

describe('pagination logic', () => {
  it('parses ?page= safely', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam(['4', '5'])).toBe(4);
    for (const bad of [null, undefined, '', '0', '-2', '1.5', 'abc'])
      expect(parsePageParam(bad)).toBe(1);
  });

  it('counts pages of 10', () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(10)).toBe(1);
    expect(totalPages(53)).toBe(6);
    expect(pageRange(6, 53)).toEqual({ from: 51, to: 53 });
    expect(pageRange(1, 0)).toEqual({ from: 0, to: 0 });
  });

  it('collapses long ranges with ellipses', () => {
    expect(getPageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageItems(5, 20)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 20]);
    expect(getPageItems(1, 20)).toEqual([1, 2, 'ellipsis', 20]);
    expect(getPageItems(20, 20)).toEqual([1, 'ellipsis', 19, 20]);
  });
});

describe('<Pagination>', () => {
  beforeEach(() => {
    nav.search = '';
  });

  it('marks the current page and keeps other query params', () => {
    nav.search = 'q=cement&page=2';
    renderWithIntl(<Pagination totalItems={53} />);
    expect(screen.getByText('Showing 11–20 of 53')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Page 3' })).toHaveAttribute(
      'href',
      '/sales?q=cement&page=3',
    );
    expect(screen.getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/sales?q=cement');
    expect(screen.getByRole('link', { name: /Previous/ })).toBeInTheDocument();
  });

  it('disables Previous on the first page and Next on the last', () => {
    renderWithIntl(<Pagination totalItems={25} />);
    expect(screen.queryByRole('link', { name: /Previous/ })).not.toBeInTheDocument();
    expect(screen.getByText('Previous').closest('[aria-disabled]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    nav.search = 'page=3';
    renderWithIntl(<Pagination totalItems={25} />);
    expect(screen.getAllByText('Next').at(-1)!.closest('[aria-disabled]')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('shows Bengali digits in bn', () => {
    nav.search = 'page=2';
    renderWithIntl(<Pagination totalItems={53} />, { locale: 'bn' });
    expect(screen.getByText('৫৩টির মধ্যে ১১–২০ দেখানো হচ্ছে')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'পাতা ২' })).toHaveAttribute('aria-current', 'page');
  });

  it('has no basic accessibility violations', async () => {
    const { container } = renderWithIntl(<Pagination totalItems={200} />);
    await expectNoA11yViolations(container);
  });
});
