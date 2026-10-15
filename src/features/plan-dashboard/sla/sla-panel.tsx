import { usePeriodSla } from '@/api/v2/queries/period-sla';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { roleLabel } from '@/features/ux-kit/labels';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { HOLD_KIND_LABELS, SLA_STAGE_LABELS } from '../model/sla-labels';
import { failedLineLabel } from '../model/failed-lines';
import { HoldControls } from './hold-controls';
import { SlaBadges } from './sla-badges';

const hours = (seconds: number) => `${Math.floor(seconds / 3600)} h`;

/**
 * Deadlines of the period (SME R3 / R6): the server's due times, overdue verdict and escalation, the open
 * "waiting for data" hold and the latest rejection — reason, failed lines and the new due time.
 */
export function SlaPanel({ view, timezone }: { view: ReconciliationView; timezone: string }) {
  const { canWritePeriods } = useCapabilities();
  const query = usePeriodSla(view.periodId);
  const detail = query.data;
  if (!detail) return null;
  const { sla, lastRejection } = detail;
  const openHold = detail.holds.find((h) => h.endedAt === null) ?? null;
  return (
    <section className="space-y-2 rounded-md border p-3 text-sm" data-testid="sla-panel" data-stage={sla.stage}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{SLA_STAGE_LABELS[sla.stage]}</span>
        <SlaBadges sla={sla} />
        {canWritePeriods && sla.stage !== 'done' && <HoldControls detail={detail} />}
      </div>
      {sla.stage !== 'done' && (
        <p>
          Submit by <PlantTime iso={sla.submitDueAt} tz={timezone} withDate /> · approve by <PlantTime iso={sla.approveDueAt} tz={timezone} withDate /> · open for {hours(sla.ageSeconds)}
          {sla.pausedSeconds > 0 ? ` (${hours(sla.pausedSeconds)} waiting for data not counted)` : ''}
        </p>
      )}
      {openHold && (
        <p data-testid="sla-hold">
          Waiting for {HOLD_KIND_LABELS[openHold.kind].toLowerCase()} since <PlantTime iso={openHold.startedAt} tz={timezone} withDate />: {openHold.reason}
        </p>
      )}
      {lastRejection && view.revision.lifecycle === 'draft' && (
        <div data-testid="sla-rejection" className="space-y-1">
          <p>
            Returned <PlantTime iso={lastRejection.at} tz={timezone} withDate />: {lastRejection.reason}
            {lastRejection.resubmitDueAt && (
              <>
                {' '}
                — corrected submission due <PlantTime iso={lastRejection.resubmitDueAt} tz={timezone} withDate />
              </>
            )}
          </p>
          {lastRejection.failedLines.length > 0 && (
            <ul className="list-disc pl-5" data-testid="sla-failed-lines">
              {lastRejection.failedLines.map((ref) => (
                <li key={ref}>{failedLineLabel(view, ref)}</li>
              ))}
            </ul>
          )}
          {lastRejection.escalated && <p>Rejection {lastRejection.rejection} of this revision — escalated to {roleLabel(lastRejection.escalatedTo)}.</p>}
        </div>
      )}
    </section>
  );
}
