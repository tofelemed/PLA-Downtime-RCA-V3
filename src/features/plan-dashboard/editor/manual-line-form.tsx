import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ManualKind, ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DecimalInput } from '@/features/ux-kit/decimal-input';
import { KIND_LABELS } from '../model/display';
import { ManualDraft, manualProblems } from '../model/draft-lines';
import { categoriesOf, evidenceTypesOf } from '../model/line-evidence';
import { EvidencePicker } from './evidence-picker';
import { LineEvidenceFields } from './line-evidence-fields';
import { ReasonSelect } from './reason-select';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface ManualLineFormProps {
  view: ReconciliationView;
  timezone: string;
  onAdd: (line: Omit<ManualDraft, 'uid'>) => void;
  onCancel: () => void;
}

const KINDS: ManualKind[] = ['availability', 'performance', 'quality', 'bridge', 'gain', 'unaccounted_classified'];
const SELECT = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

/** A bridge is production accounting's (SME R8); an Unaccounted line only where the tolerance policy allows it (R7). */
function kindsFor(view: ReconciliationView, canWriteBridges: boolean): ManualKind[] {
  return KINDS.filter((k) => (k !== 'bridge' || canWriteBridges) && (k !== 'unaccounted_classified' || view.tolerance.allowUnaccountedClassification));
}

/** Changing the kind drops a category or evidence type the new kind does not take. */
function kindPatch(line: Omit<ManualDraft, 'uid'>, kind: ManualKind): Partial<Omit<ManualDraft, 'uid'>> {
  return {
    kind,
    classification: line.classification && categoriesOf(kind).includes(line.classification) ? line.classification : undefined,
    evidenceType: line.evidenceType && evidenceTypesOf(kind).includes(line.evidenceType) ? line.evidenceType : undefined,
  };
}

/** A manual line (ACC07): slice, kind, quantity (decimal text), evidence event(s) or an explicit "no event". */
export function ManualLineForm({ view, timezone, onAdd, onCancel }: ManualLineFormProps) {
  const { number } = useNumberFormat();
  const [line, setLine] = useState<Omit<ManualDraft, 'uid'>>({ sliceId: view.slices[0]?.sliceId ?? '', kind: 'availability', quantity: null, eventIds: [], missingEvent: false, missingCode: false });
  const set = (patch: Partial<Omit<ManualDraft, 'uid'>>) => setLine((current) => ({ ...current, ...patch }));
  const kinds = kindsFor(view, useCapabilities().canWriteBridges);
  const problems = manualProblems({ ...line, uid: 'new' });
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm" data-testid="manual-line-form">
      <div className="grid gap-3 sm:grid-cols-3">
        {view.slices.length > 1 && (
          <div className="space-y-1">
            <Label htmlFor="manualSlice">Slice</Label>
            <select id="manualSlice" className={SELECT} value={line.sliceId} onChange={(e) => set({ sliceId: e.target.value })}>
              {view.slices.map((s, i) => (
                <option key={s.sliceId} value={s.sliceId}>{`Slice ${number(i + 1)} (${s.uom ?? 'unit unknown'})`}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="manualKind">Loss kind</Label>
          <select id="manualKind" className={SELECT} value={line.kind} onChange={(e) => set(kindPatch(line, e.target.value as ManualKind))}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="manualQuantity">Quantity ({view.slices.find((s) => s.sliceId === line.sliceId)?.uom ?? 'unit unknown'})</Label>
          <DecimalInput id="manualQuantity" value={line.quantity} onChange={(q) => set({ quantity: q })} allowNegative={line.kind === 'gain'} />
        </div>
      </div>
      <label className="flex items-center gap-2">
        <Checkbox id="manualNoEvent" checked={line.missingEvent} onCheckedChange={(v) => set({ missingEvent: v === true, eventIds: v === true ? [] : line.eventIds })} />
        <span>No event (cause without an event)</span>
      </label>
      {line.missingEvent ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ReasonSelect id="manualReason" value={line.reasonCodeId ?? ''} disabled={line.missingCode} onChange={(id) => set({ reasonCodeId: id || undefined })} />
          <label className="flex items-center gap-2 pt-6">
            <Checkbox id="manualMissingCode" checked={line.missingCode} onCheckedChange={(v) => set({ missingCode: v === true, reasonCodeId: v === true ? undefined : line.reasonCodeId })} />
            <span>Reason code missing (blocks submission)</span>
          </label>
        </div>
      ) : (
        <EvidencePicker view={view} timezone={timezone} selected={line.eventIds} onChange={(eventIds) => set({ eventIds })} />
      )}
      <LineEvidenceFields line={line} onChange={set} selectClass={SELECT} />
      <div className="space-y-1">
        <Label htmlFor="manualReasonText">Reason / comment</Label>
        <Input id="manualReasonText" value={line.reason ?? ''} onChange={(e) => set({ reason: e.target.value || undefined })} />
      </div>
      {problems.length > 0 && <p className="text-xs text-muted-foreground">{problems.join(' ')}</p>}
      <div className="flex gap-2">
        <Button size="sm" data-testid="manual-line-add" disabled={problems.length > 0} onClick={() => onAdd(line)}>
          Add line
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
