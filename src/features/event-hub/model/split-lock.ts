import type { ProductionEventView } from '@/api/v2/types/events';
import { hasSplit } from './reason-split';

/** Owner decision 2026-10-30 (`REASON_SPLITTERS`): the operator records one reason; a split is review work. */
export const SPLIT_LOCKED = 'This event is split across several reasons. A production engineer, reliability engineer or manager changes its reasons.';
export const SPLIT_LOCKED_ID = 'code-split-locked';

/** Whether the coding of `event` is closed to the user: a stored split they may not change. */
export function splitLocked(event: Pick<ProductionEventView, 'reasonWeights'>, canSplitReasons: boolean): boolean {
  return !canSplitReasons && hasSplit(event.reasonWeights);
}
