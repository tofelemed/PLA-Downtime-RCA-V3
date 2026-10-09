import { useCallback, useState } from 'react';
import type { ProductionEventView } from '@/api/v2/types/events';
import type { EventHubDialog } from '@/features/event-hub/hooks/use-event-hub-state';

/** Event drawer and the 3.2 dialogs (code / close / split) opened from the downtime page. */
export function useEventActions() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EventHubDialog>(null);
  const openDetail = useCallback((event: Pick<ProductionEventView, 'id'> | null) => setDetailId(event?.id ?? null), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  const settle = useCallback((openEventId: string | null) => {
    setDialog(null);
    setDetailId(openEventId);
  }, []);
  return { detailId, dialog, openDetail, openDialog: setDialog, closeDialog, settle };
}

export type EventActions = ReturnType<typeof useEventActions>;
