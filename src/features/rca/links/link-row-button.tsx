import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/features/ux-kit/status-badge';

/** What every link picker receives from the add-link form. */
export interface PickerProps {
  /** links the target (the form owns the request, its message and its error) */
  onLink: (targetId: string) => void;
  busy: boolean;
  /** target ids this investigation is already linked to */
  linkedIds: ReadonlySet<string>;
}

interface LinkRowButtonProps extends PickerProps {
  targetId: string;
  /** accessible name, e.g. "Link occurrence of 12 Oct" */
  label: string;
  /** already linked under another id (a loss line of an earlier run of the same period) */
  linkedElsewhere?: boolean;
}

/** "Link" on a picker row, or "Linked" when this investigation already covers the target. */
export function LinkRowButton({ targetId, label, onLink, busy, linkedIds, linkedElsewhere = false }: LinkRowButtonProps) {
  if (linkedElsewhere || linkedIds.has(targetId)) return <StatusBadge tone="success">Linked</StatusBadge>;
  return (
    <Button type="button" size="sm" variant="outline" disabled={busy} aria-label={label} onClick={() => onLink(targetId)} data-testid="pick-link">
      Link
    </Button>
  );
}
