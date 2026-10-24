import { Button } from '@/components/ui/button';
import type { DayView } from '@/api/v2/types/production-day';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { DayCodingGate } from './day-coding-gate';

export interface CertifyDayButtonProps {
  day: DayView;
  disabled: boolean;
  onCertify: () => Promise<unknown>;
}

function RollupSummary({ day }: { day: DayView }) {
  const { decimal } = useNumberFormat();
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm" data-testid="day-certify-summary">
      {day.rollup.map((r) => {
        const uom = r.uom ? ` ${r.uom}` : '';
        return (
          <li key={r.uom ?? '-'}>
            Good {decimal(r.actual)}
            {uom} of target {decimal(r.target)}
            {uom} · loss {decimal(r.gap)}
            {uom} (attributed {decimal(r.attributed)}
            {uom}, residual {decimal(r.residual)}
            {uom}) · {r.periods} shifts
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Certify the day" behind a confirmation that repeats the server's day roll-up (good, loss, attributed,
 * residual) and its stop-coding verdict, so the one approval of the day is never a single stray click.
 */
export function CertifyDayButton({ day, disabled, onCertify }: CertifyDayButtonProps) {
  return (
    <ConfirmDialog
      size="md"
      trigger={
        <Button size="sm" data-testid="day-certify" disabled={disabled}>
          Certify the day
        </Button>
      }
      title="Certify this production day?"
      description="The certification records the approved shifts' totals below. A later correction reopens the day."
      confirmLabel="Certify the day"
      onConfirm={onCertify}
    >
      <RollupSummary day={day} />
      {day.codingGate && day.codingGate.stops > 0 ? <DayCodingGate gate={day.codingGate} /> : <p className="text-sm">No stops on this day.</p>}
    </ConfirmDialog>
  );
}
