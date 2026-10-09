import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { LedgerKind, RevisionSelector } from '@/api/v2/types/period-overview';

export interface DetailToolbarProps {
  view: RevisionSelector;
  onView: (view: RevisionSelector) => void;
  ledger: LedgerKind;
  onLedger: (ledger: LedgerKind) => void;
  canShowApproved: boolean;
}

/** Revision shown (current draft / review vs the published approved one) and the ledger toggle (D04). */
export function DetailToolbar({ view, onView, ledger, onLedger, canShowApproved }: DetailToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm" data-testid="detail-toolbar">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Revision</span>
        <ToggleGroup type="single" value={view} onValueChange={(next) => next && onView(next as RevisionSelector)} aria-label="Revision shown">
          <ToggleGroupItem value="current" data-testid="view-current">
            Current
          </ToggleGroupItem>
          <ToggleGroupItem value="approved" data-testid="view-approved" disabled={!canShowApproved && view !== 'approved'}>
            Approved
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Ledger</span>
        <ToggleGroup type="single" value={ledger} onValueChange={(next) => next && onLedger(next as LedgerKind)} aria-label="Ledger">
          <ToggleGroupItem value="plan" data-testid="ledger-plan">
            Plan
          </ToggleGroupItem>
          <ToggleGroupItem value="capacity" data-testid="ledger-capacity">
            Capacity
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
