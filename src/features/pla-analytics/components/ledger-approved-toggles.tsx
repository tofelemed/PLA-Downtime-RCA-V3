import type { LedgerKind } from '@/api/v2/types/period-overview';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { REVISION_OPTIONS } from '../reports/revision-options';
import { FIELD_CLASS, SELECT_CLASS } from './filter-classes';

export interface LedgerApprovedTogglesProps {
  ledger: LedgerKind;
  approvedOnly: boolean;
  showLedger: boolean;
  showApproved: boolean;
  onChange: (patch: { ledger?: LedgerKind; approvedOnly?: boolean }) => void;
}


/**
 * The ledger (plan / capacity, a segmented control) and the revision (approved only, or approved else the
 * draft — the Reports page's Revision select), each labelled above, as the last items of the filter bar.
 */
export function LedgerApprovedToggles({ ledger, approvedOnly, showLedger, showApproved, onChange }: LedgerApprovedTogglesProps) {
  if (!showLedger && !showApproved) return null;
  return (
    <>
      {showLedger && (
        <div className={FIELD_CLASS}>
          <Label id="pla-ledger-label">Ledger</Label>
          <ToggleGroup type="single" size="sm" value={ledger} onValueChange={(next) => next && onChange({ ledger: next as LedgerKind })} aria-labelledby="pla-ledger-label" className="h-9 justify-start gap-0.5 rounded-md border p-0.5" data-testid="pla-scope-toggles">
            <ToggleGroupItem value="plan" className="h-7" data-testid="ledger-plan">
              Plan
            </ToggleGroupItem>
            <ToggleGroupItem value="capacity" className="h-7" data-testid="ledger-capacity">
              Capacity
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
      {showApproved && (
        <div className={FIELD_CLASS}>
          <Label htmlFor="pla-revision">Revision</Label>
          <select id="pla-revision" data-testid="pla-approved" className={SELECT_CLASS} value={approvedOnly ? 'approved' : 'shown'} onChange={(e) => onChange({ approvedOnly: e.target.value === 'approved' })}>
            <option value="approved">{REVISION_OPTIONS.approved}</option>
            <option value="shown">{REVISION_OPTIONS.shown}</option>
          </select>
        </div>
      )}
    </>
  );
}
