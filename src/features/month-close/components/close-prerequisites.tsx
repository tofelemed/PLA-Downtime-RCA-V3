import type { MonthCloseView } from '@/api/v2/types/month-close';
import { Section } from '@/features/ux-kit/page-layout';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { PENDING_WORKFLOW_LABELS, PROPOSAL_TRIGGER_LABELS } from '../model/close-labels';

function PendingPeriods({ view }: { view: MonthCloseView }) {
  const pref = useCalendarPreference();
  const { pending, pendingCount } = view.prerequisites;
  if (pendingCount === 0) return <p data-testid="pending-none">Every period of the month is approved.</p>;
  return (
    <div className="space-y-1">
      <p className="font-medium">
        {pendingCount} period{pendingCount === 1 ? '' : 's'} not approved{pending.length < pendingCount ? ` (first ${pending.length} shown)` : ''}
      </p>
      <ul className="space-y-0.5 text-sm" data-testid="pending-periods">
        {pending.map((p) => (
          <li key={p.periodId} data-period-id={p.periodId}>
            {p.unitName ?? 'Unit'} · {formatOperationalDate(p.localDate, pref)}
            {p.shiftName ? ` · ${p.shiftName}` : ''} — {PENDING_WORKFLOW_LABELS[p.workflow] ?? p.workflow}
          </li>
        ))}
      </ul>
    </div>
  );
}

function OpenProposals({ view }: { view: MonthCloseView }) {
  const pref = useCalendarPreference();
  const { openProposals, openProposalCount } = view.prerequisites;
  if (openProposalCount === 0) return <p data-testid="proposals-none">No change proposal is open.</p>;
  return (
    <div className="space-y-1">
      <p className="font-medium">
        {openProposalCount} open change proposal{openProposalCount === 1 ? '' : 's'}
        {view.policy.blockOnOpenProposals ? ' — accept or dismiss them before closing' : ''}
      </p>
      <ul className="space-y-0.5 text-sm" data-testid="open-proposals">
        {openProposals.map((p) => (
          <li key={p.proposalId}>
            {formatOperationalDate(p.localDate, pref)} — {PROPOSAL_TRIGGER_LABELS[p.trigger] ?? p.trigger}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UncertifiedDays({ view }: { view: MonthCloseView }) {
  const pref = useCalendarPreference();
  const { days, certifiedDays, uncertifiedDays } = view.prerequisites;
  if (!view.policy.requireCertifiedDays) return null;
  if (days === certifiedDays) return <p data-testid="days-certified">Every production day is certified ({certifiedDays}).</p>;
  return (
    <div className="space-y-1">
      <p className="font-medium">
        {days - certifiedDays} of {days} production days not certified{uncertifiedDays.length < days - certifiedDays ? ` (first ${uncertifiedDays.length} shown)` : ''}
      </p>
      <ul className="space-y-0.5 text-sm" data-testid="uncertified-days">
        {uncertifiedDays.map((d) => (
          <li key={`${d.unitId}-${d.localDate}`}>
            {d.unitName ?? 'Unit'} · {formatOperationalDate(d.localDate, pref)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What has to be true before the month closes (server counts; the lists are capped). */
export function ClosePrerequisites({ view }: { view: MonthCloseView }) {
  const { prerequisites } = view;
  return (
    <Section
      title="Prerequisites"
      description={`${prerequisites.approved} of ${prerequisites.periods} periods approved.`}
    >
      <div className="space-y-3" data-testid="close-prerequisites" data-met={prerequisites.met}>
        <PendingPeriods view={view} />
        <UncertifiedDays view={view} />
        <OpenProposals view={view} />
        {view.materiality.findings.length > 0 && (
          <p className="text-sm" data-testid="materiality-findings">
            Above the materiality threshold:{' '}
            {view.materiality.findings.map((f) => `${f.quantity} ${f.uom} adjusted (threshold ${f.threshold} ${f.uom})`).join('; ')} — an extra review is needed
            before finance signs off.
          </p>
        )}
      </div>
    </Section>
  );
}
