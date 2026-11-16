/** Every list in the app shows 10 rows per page (proposal §5). */
export const PAGE_SIZE = 10;

export type PageItem = number | 'ellipsis';

/** Reads `?page=` safely: anything invalid becomes page 1. */
export function parsePageParam(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function totalPages(totalItems: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

/** First, last, current ±1, with ellipses for gaps: 1 … 4 5 6 … 20 */
export function getPageItems(current: number, pages: number): PageItem[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, current - 1, current, current + 1]);
  const items: PageItem[] = [];
  let previous = 0;
  for (let page = 1; page <= pages; page++) {
    if (!keep.has(page)) continue;
    if (page - previous > 1) items.push('ellipsis');
    items.push(page);
    previous = page;
  }
  return items;
}

/** 1-based range shown on `page`, e.g. page 2 of 53 items → { from: 11, to: 20 }. */
export function pageRange(page: number, totalItems: number, pageSize = PAGE_SIZE) {
  if (totalItems === 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  return { from, to: Math.min(page * pageSize, totalItems) };
}
