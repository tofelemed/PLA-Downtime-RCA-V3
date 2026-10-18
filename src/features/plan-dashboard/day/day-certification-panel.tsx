import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCertifyDay, useProductionDay } from '@/api/v2/queries/production-days';
import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import type { DayView } from '@/api/v2/types/production-day';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { useCurrentUserId } from '@/features/auth/use-current-user-id';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { WORKFLOW_LABELS } from '../model/display';
import { DayCodingGate } from './day-coding-gate';
import type { GridWorkflowState } from '@/api/v2/types/period-overview';

const STATE_LABELS: Record<DayView['state'], string> = { open: 'Shifts in progress', ready: 'Ready to certify', certified: 'Day certified' };

function Rollup({ day }: { day: DayView }) {
  const { digits } = useCalendarPreference();
  if (day.rollup.length === 0) return null;
  return (
    <p className="text-sm" data-testid="day-rollup">
      Day total (approved shifts):{' '}
      {day.rollup.map((r) => `${r.actual === null ? '—' : formatDecimal(r.actual, 2, digits)} of ${r.target === null ? '—' : formatDecimal(r.target, 2, digits)}${r.uom ? ` ${r.uom}` : ''} (${r.periods} shifts)`).join('; ')}
    </p>
  );
}

/**
 * The production day of the period (owner decision 14 Oct 2026, SME R2): its shifts' workflow, the roll-up of
 * the approved shifts and the one approval that certifies the day — plant management, never a submitter of
 * its shifts (the server decides; the button only hides what it would refuse).
 */
export function DayCertificationPanel({ unitId, localDate }: { unitId: string; localDate: string }) {
  const pref = useCalendarPreference();
  const { canCertifyDay, isSuperAdmin } = useCapabilities();
  const userId = useCurrentUserId();
  const query = useProductionDay(unitId, localDate);
  const certify = useCertifyDay();
  const day = query.data;
  if (!day) return null;
  const submitted = !isSuperAdmin && day.periods.some((p) => p.submittedBy === userId);
  return (
    <section className="space-y-2 rounded-md border p-3" data-testid="day-certification" data-state={day.state}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Production day {formatOperationalDate(day.localDate, pref)}</span>
        <Badge variant={day.state === 'certified' ? 'default' : 'secondary'}>{STATE_LABELS[day.state]}</Badge>
        {canCertifyDay && day.state === 'ready' && (
          <Button size="sm" data-testid="day-certify" disabled={certify.isPending || submitted} onClick={() => void certify.submit({ unitId, localDate }).catch(() => undefined)}>
            Certify the day
          </Button>
        )}
      </div>
      <ul className="flex flex-wrap gap-3 text-xs">
        {day.periods.map((p) => (
          <li key={p.periodId}>
            {p.shiftName ?? 'Day'}: {WORKFLOW_LABELS[p.workflow as GridWorkflowState] ?? p.workflow}
          </li>
        ))}
      </ul>
      <Rollup day={day} />
      <DayCodingGate gate={day.codingGate} />
      {canCertifyDay && day.state === 'ready' && submitted && <p className="text-xs text-muted-foreground">You submitted a shift of this day; another manager certifies it.</p>}
      {day.certification?.state === 'reopened' && <p className="text-xs" data-testid="day-reopened">Reopened by a correction: {day.certification.reopenReason}</p>}
      {certify.error ? <FriendlyErrorAlert error={certify.error} /> : null}
    </section>
  );
}

/** The day panel of a period: its unit and operational date come from the period record. */
export function PeriodDayPanel({ periodId }: { periodId: string }) {
  const period = useProductionPeriod(periodId).data?.data;
  if (!period) return null;
  return <DayCertificationPanel unitId={period.unitId} localDate={period.localDate} />;
}
