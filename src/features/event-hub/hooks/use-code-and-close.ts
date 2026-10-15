import { useCloseEvent } from '@/api/v2/queries/event-commands';
import { usePatchProductionEvent } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';

export interface CloseStopInput {
  endTime: string;
  reason: string;
  /** '' or the current code: the stop is only closed */
  reasonCodeId: string;
}

/**
 * FE-06 close with a reason: a new reason code is saved first (PATCH, `If-Match`), then the stop is
 * closed with the row version that save returned — two user revisions, each checked by the server. If
 * the close is refused the code stays (coding an open stop is valid on its own).
 */
export function useCloseStop(event: ProductionEventView) {
  const patch = usePatchProductionEvent();
  const close = useCloseEvent();
  const submit = async ({ endTime, reason, reasonCodeId }: CloseStopInput): Promise<boolean> => {
    const recode = reasonCodeId !== '' && reasonCodeId !== event.reasonCodeId;
    const coded = recode ? await patch.submit({ event, changes: { reasonCodeId } }).catch(() => null) : event;
    if (!coded) return false;
    const closed = await close.submit({ event: coded, body: { endTime, reason: reason.trim() } }).catch(() => null);
    return closed !== null;
  };
  return { submit, error: patch.error ?? close.error, pending: patch.isPending || close.isPending };
}

/** FE-06 inline "Code": only the reason code changes; the server applies the code's classification defaults. */
export function useCodeEvent(event: ProductionEventView) {
  const patch = usePatchProductionEvent();
  /** a reason code, or SME D12 "investigation pending" while no specific reason is known yet */
  const submit = async (changes: { reasonCodeId?: string; investigationPending?: boolean }): Promise<boolean> =>
    (await patch.submit({ event, changes }).catch(() => null)) !== null;
  return { submit, error: patch.error, pending: patch.isPending };
}
