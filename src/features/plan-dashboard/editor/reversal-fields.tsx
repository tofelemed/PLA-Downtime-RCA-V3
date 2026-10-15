import { Label } from '@/components/ui/label';
import { useReversibleLines } from '@/api/v2/queries/reversible-lines';
import type { ReversibleLineView } from '@/api/v2/types/reconciliation';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { KIND_LABELS } from '../model/display';

export interface ReversalFieldsProps {
  periodId: string;
  value: string | undefined;
  onChange: (reversesLineId: string | undefined) => void;
  selectClass: string;
}

/**
 * SME R9: the approved line of an earlier period of the unit a reversal reverses — date and shift in the
 * plant calendar, kind, approved quantity and what is still left to reverse (all from the server).
 */
export function ReversalFields({ periodId, value, onChange, selectClass }: ReversalFieldsProps) {
  const lines = useReversibleLines(periodId);
  const preference = useCalendarPreference();
  const { decimal } = useNumberFormat();
  const items = lines.data?.items ?? [];
  const label = (l: ReversibleLineView) =>
    [formatOperationalDate(l.localDate, preference), l.shiftName, KIND_LABELS[l.kind] ?? l.kind, `${decimal(l.quantity)} ${l.uom ?? ''}`.trim(), `left ${decimal(l.remainingQuantity)}`]
      .filter(Boolean)
      .join(' · ');
  return (
    <div className="space-y-1" data-testid="reversal-fields">
      <Label htmlFor="manualReverses">Reverses the approved line</Label>
      <select id="manualReverses" className={selectClass} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{lines.isLoading ? 'Loading…' : items.length ? 'Choose a line' : 'No approved line of an earlier period to reverse'}</option>
        {items.map((l) => (
          <option key={l.id} value={l.id}>
            {label(l)}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">Enter the quantity with the opposite sign; it corrects that period and never balances this one.</p>
    </div>
  );
}
