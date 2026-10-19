import type { PagerModel } from '@/features/ux-kit/data-table/pager-model';

/** The server's number of History entries of the case, from the first page (`totalCount`, QA L8). */
export function historyTotalOf(pages: ReadonlyArray<unknown> | undefined): number | null {
  const first = pages?.[0];
  if (typeof first !== 'object' || first === null) return null;
  const total = (first as { totalCount?: unknown }).totalCount;
  return typeof total === 'number' && Number.isInteger(total) && total >= 0 ? total : null;
}

/** QA L8: "1–20 of 43 · Page 1 of 3" on every page once the server names the total. */
export function withTotal(pager: PagerModel, total: number | null): PagerModel {
  if (total === null || pager.totalCount !== null) return pager;
  return { ...pager, totalCount: total, pageCount: Math.max(1, Math.ceil(total / pager.pageSize)) };
}
