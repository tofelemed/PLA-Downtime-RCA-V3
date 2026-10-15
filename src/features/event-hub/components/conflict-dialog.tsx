import { useEffect } from 'react';
import { useProductionEvent } from '@/api/v2/queries/production-events';
import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { changedFields, type EventDraft } from '../model/event-draft';
import { formValuesOf, type EventFormValues } from '../model/event-form';
import { useEventHubEnv } from '../use-event-hub-env';

export interface ConflictDialogProps {
  open: boolean;
  eventId: string;
  draft: EventDraft;
  onApplyMine: (latest: ProductionEventView) => void;
  onDiscardMine: () => void;
  onCancel: () => void;
}

const FIELD_LABEL: Readonly<Record<keyof EventFormValues, string>> = {
  unitId: 'Unit',
  startLocal: 'Start',
  endLocal: 'End',
  durationMinutes: 'Duration (min)',
  physicalType: 'Type',
  scheduleClass: 'Schedule class',
  reasonCodeId: 'Reason code',
  description: 'Description',
  impactMode: 'Impact on production',
  impactPercent: 'Output lost (%)',
  originUnitId: 'Caused by unit',
  originAssetId: 'Caused by asset',
  plannedEndLocal: 'Approved planned end',
  failureMode: 'Failure mode',
  failureSeverity: 'Failure severity',
  maintainableItem: 'Maintainable item',
  failureMechanism: 'Failure mechanism',
  failureCause: 'Failure cause',
  detectionMethod: 'Detection method',
  quantity: 'Quantity',
  quantityUom: 'Unit of quantity',
  dispositionClass: 'Disposition',
};

/**
 * 412 STALE_REVISION review (UX04): the latest server values next to the user's changes for every
 * field the user touched; applying re-sends the user's changes with the latest revision as `If-Match`.
 */
export function ConflictDialog({ open, eventId, draft, onApplyMine, onDiscardMine, onCancel }: ConflictDialogProps) {
  const env = useEventHubEnv();
  const latest = useProductionEvent(eventId);
  const { refetch } = latest;
  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);
  const server = latest.data ? formValuesOf(latest.data, env.timezone) : null;
  const fields = changedFields(draft.initial, draft.values);
  const show = (field: keyof EventFormValues, value: string) => (field === 'reasonCodeId' ? env.reasonName(value || null) : value || '—');
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="conflict-dialog">
        <DialogHeader>
          <DialogTitle>Someone changed this event</DialogTitle>
          <DialogDescription>
            You started from revision {draft.baseRevision}; the server now holds revision {latest.data?.rowVersion ?? '…'}. Review before saving.
          </DialogDescription>
        </DialogHeader>
        <DataState state={dataStateOf(latest)} error={latest.error}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Server now</TableHead>
                <TableHead>Mine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field}>
                  <TableCell>{FIELD_LABEL[field]}</TableCell>
                  <TableCell>{server ? show(field, server[field]) : '…'}</TableCell>
                  <TableCell className="font-medium">{show(field, draft.values[field])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataState>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onDiscardMine}>Discard my changes</Button>
          <Button disabled={!latest.data} onClick={() => latest.data && onApplyMine(latest.data)}>Apply my changes to the latest</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
