import type { LedgerKind } from '@/api/v2/types/period-overview';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface LedgerApprovedTogglesProps {
  ledger: LedgerKind;
  approvedOnly: boolean;
  showLedger: boolean;
  showApproved: boolean;
  onChange: (patch: { ledger?: LedgerKind; approvedOnly?: boolean }) => void;
}

/** Ledger (plan / capacity) and "Approved only" as one compact segmented row (UX audit D-13). */
export function LedgerApprovedToggles({ ledger, approvedOnly, showLedger, showApproved, onChange }: LedgerApprovedTogglesProps) {
  if (!showLedger && !showApproved) return null;
  return (
    <div className="flex items-center gap-1 rounded-md border p-0.5 text-sm" data-testid="pla-scope-toggles">
      {showLedger && (
        <ToggleGroup type="single" size="sm" value={ledger} onValueChange={(next) => next && onChange({ ledger: next as LedgerKind })} aria-label="Ledger">
          <ToggleGroupItem value="plan" data-testid="ledger-plan">
            Plan ledger
          </ToggleGroupItem>
          <ToggleGroupItem value="capacity" data-testid="ledger-capacity">
            Capacity ledger
          </ToggleGroupItem>
        </ToggleGroup>
      )}
      {showLedger && showApproved && <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />}
      {showApproved && (
        <Toggle size="sm" pressed={approvedOnly} onPressedChange={(pressed) => onChange({ approvedOnly: pressed })} data-testid="pla-approved">
          Approved only
        </Toggle>
      )}
    </div>
  );
}
