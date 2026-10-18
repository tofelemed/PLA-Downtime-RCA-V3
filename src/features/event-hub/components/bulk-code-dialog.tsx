import { useEffect, useState } from 'react';
import type { BulkTarget } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { OEE_COMPONENTS, SCHEDULE_CLASSES } from '../model/event-filters';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { labelOf, OEE_COMPONENT_LABELS, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { useBulkCodeFlow } from '../hooks/use-bulk-code-flow';
import { BulkExtraFields } from './bulk-extra-fields';
import { BulkJobProgress } from './bulk-job-progress';
import { BulkPreviewTable } from './bulk-preview-table';
import { BulkReferenceError } from './bulk-reference-error';
import { AuditReasonField } from './audit-reason-field';
import { CommandError } from './command-error';
import { ReasonCodeSelect } from './reason-code-select';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface BulkCodeDialogProps {
  events: readonly BulkTarget[];
  onClose: () => void;
  /** E-6: the codes were applied (or the job accepted): the caller drops its now stale selection */
  onApplied?: () => void;
}

/** Batches up to this size are applied atomically and refused whole on any exclusion (API, DT10). */
const ATOMIC_BULK_LIMIT = 500;

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

interface EnumSelectProps {
  id: string;
  label: string;
  values: readonly string[];
  labels: Readonly<Record<string, string>>;
  value: string;
  onChange: (v: string) => void;
}

function EnumSelect({ id, label, values, labels, value, onChange }: EnumSelectProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— unchanged —</option>
        {values.map((entry) => <option key={entry} value={entry}>{labelOf(labels, entry)}</option>)}
      </select>
    </div>
  );
}

type BulkCodeFlow = ReturnType<typeof useBulkCodeFlow>;

/** The codes to set (only chosen ones are sent) and why. */
function BulkCodeFields({ events, flow }: { events: readonly BulkTarget[]; flow: BulkCodeFlow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <ReasonCodeSelect id="bulk-reason-code" value={flow.codes.reasonCodeId} onChange={(v) => flow.edit('reasonCodeId', v)} />
      </div>
      <EnumSelect id="bulk-schedule" label="Schedule class" values={SCHEDULE_CLASSES} labels={SCHEDULE_CLASS_LABELS} value={flow.codes.scheduleClass} onChange={(v) => flow.edit('scheduleClass', v)} />
      <EnumSelect id="bulk-oee" label="OEE component" values={OEE_COMPONENTS} labels={OEE_COMPONENT_LABELS} value={flow.codes.oeeComponent} onChange={(v) => flow.edit('oeeComponent', v)} />
      <BulkExtraFields events={events} codes={flow.codes} edit={flow.edit} />
      <AuditReasonField id="bulk-why" value={flow.reason} onChange={flow.setReason} maxLength={1000} className="sm:col-span-2" />
    </div>
  );
}

/**
 * DT10 bulk coding: codes (reason, classes, asset of one unit, investigation pending) + reason → server
 * preview → apply (atomic ≤ 500, job above). The events are fixed when the dialog opens, so clearing the list selection after apply does not change the result shown.
 */
export function BulkCodeDialog({ events: chosen, onClose, onApplied }: BulkCodeDialogProps) {
  const { number } = useNumberFormat();
  const [events] = useState(chosen);
  const flow = useBulkCodeFlow(events);
  const { step } = flow;
  const done = step.kind === 'applied' || step.kind === 'job';
  useEffect(() => {
    if (done) onApplied?.();
  }, [done, onApplied]);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="bulk-code-dialog">
        <DialogHeader>
          <DialogTitle>Code {number(events.length)} events</DialogTitle>
          <DialogDescription>Preview first: nothing changes until you apply. More than 500 events run as a job.</DialogDescription>
        </DialogHeader>
        {!done && <BulkCodeFields events={events} flow={flow} />}
        {step.kind === 'preview' && (
          <BulkPreviewTable preview={step.preview} events={events} show={{ asset: Boolean(flow.codes.assetId), investigation: flow.codes.investigationPending !== 'unchanged' }} />
        )}
        {step.kind === 'applied' && <p className="text-sm" data-testid="bulk-applied">{step.applied.applied} events coded.</p>}
        {step.kind === 'job' && <BulkJobProgress jobId={step.jobId} />}
        <CommandError error={flow.error} />
        <BulkReferenceError error={flow.error} events={events} />
        {!done && <DisabledReason id="bulk-blocked" reason={flow.previewBlocked} />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{done ? 'Close' : 'Cancel'}</Button>
          {!done && <Button variant="secondary" disabled={!flow.canPreview} aria-describedby={flow.previewBlocked ? 'bulk-blocked' : undefined} onClick={() => void flow.preview()}>Preview</Button>}
          {step.kind === 'preview' && (
            <Button disabled={flow.pending || (step.preview.exclusions.length > 0 && events.length <= ATOMIC_BULK_LIMIT)} onClick={() => void flow.apply()}>
              Apply to {number(step.preview.count)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
