import type { ListResponse } from '@/api/v2/types/envelopes';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { pageCountText } from './for-you-model';

/** The count text of the first server page of a list without a total (undefined while it loads). */
export function usePageCount(page: Pick<ListResponse<unknown>, 'items' | 'nextCursor'> | undefined): string | undefined {
  const { number } = useNumberFormat();
  return page ? pageCountText(page.items.length, Boolean(page.nextCursor), number) : undefined;
}
