import type { ListResponse } from '@/api/v2/types/envelopes';
import { useNumberFormat } from './use-number-format';

/**
 * A count from one server page of a list without a total: the page's row count, with "+" when the
 * server has a further page (the Event Hub "Current stops (50+)" rule). Nothing is summed in the browser.
 */
export function pageCountText(rows: number, hasMore: boolean, format: (value: number) => string): string {
  return hasMore ? `${format(rows)}+` : format(rows);
}

/** The count text of the first server page of a list without a total (undefined while it loads). */
export function usePageCount(page: Pick<ListResponse<unknown>, 'items' | 'nextCursor'> | undefined): string | undefined {
  const { number } = useNumberFormat();
  return page ? pageCountText(page.items.length, Boolean(page.nextCursor), number) : undefined;
}
