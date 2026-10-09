import type { ProductionEventView } from '@/api/v2/types/events';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OEE_COMPONENTS, SCHEDULE_CLASSES } from '../model/event-filters';
import { humanize } from '../model/event-states';
import { useBulkCodeFlow } from '../hooks/use-bulk-code-flow';
import { BulkJobProgress } from './bulk-job-progress';
import { BulkPreviewTable } from './bulk-preview-table';
import { CommandError } from './command-error';
import { ReasonCodeSelect } from './reason-code-select';

export interface BulkCodeDialogProps {
  events: ProductionEventView[];
  onClose: () => void;
}

/** Batches up to this size are applied atomically and refused whole on any exclusion (API, DT10). */
const ATOMIC_BULK_LIMIT = 500;

const SELECT_CLASS = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

function EnumSelect({ id, label, values, value, onChange }: { id: string; label: string; values: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={SELECT_CLASS} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— unchanged —</option>
        {values.map((entry) => <option key={entry} value={entry}>{humanize(entry)}</option>)}
      </select>
    </div>
  );
}

/** DT10 bulk coding: codes + reason → server preview → apply (atomic ≤ 500, job above). */
export function BulkCodeDialog({ events, onClose }: BulkCodeDialogProps) {
  const flow = useBulkCodeFlow(events);
  const { step } = flow;
  const done = step.kind === 'applied' || step.kind === 'job';
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="bulk-code-dialog">
        <DialogHeader>
          <DialogTitle>Code {events.length} events</DialogTitle>
          <DialogDescription>Preview first: nothing changes until you apply. More than 500 events run as a job.</DialogDescription>
        </DialogHeader>
        {!done && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ReasonCodeSelect id="bulk-reason-code" value={flow.codes.reasonCodeId} onChange={(v) => flow.edit('reasonCodeId', v)} />
            </div>
            <EnumSelect id="bulk-schedule" label="Schedule class" values={SCHEDULE_CLASSES} value={flow.codes.scheduleClass} onChange={(v) => flow.edit('scheduleClass', v)} />
            <EnumSelect id="bulk-oee" label="OEE component" values={OEE_COMPONENTS} value={flow.codes.oeeComponent} onChange={(v) => flow.edit('oeeComponent', v)} />
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="bulk-why">Why (kept in the history)</Label>
              <Textarea id="bulk-why" value={flow.reason} onChange={(e) => flow.setReason(e.target.value)} maxLength={1000} />
            </div>
          </div>
        )}
        {step.kind === 'preview' && <BulkPreviewTable preview={step.preview} />}
        {step.kind === 'applied' && <p className="text-sm" data-testid="bulk-applied">{step.applied.applied} events coded.</p>}
        {step.kind === 'job' && <BulkJobProgress jobId={step.jobId} />}
        <CommandError error={flow.error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{done ? 'Close' : 'Cancel'}</Button>
          {!done && <Button variant="secondary" disabled={!flow.canPreview} onClick={() => void flow.preview()}>Preview</Button>}
          {step.kind === 'preview' && (
            <Button disabled={flow.pending || (step.preview.exclusions.length > 0 && events.length <= ATOMIC_BULK_LIMIT)} onClick={() => void flow.apply()}>
              Apply to {step.preview.count}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
