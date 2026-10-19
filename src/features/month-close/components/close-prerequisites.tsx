import { Link } from 'react-router-dom';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import { DataTable } from '@/features/ux-kit/data-table';
import { Section } from '@/features/ux-kit/page-layout';
import { useCalendarPreference } from '@/lib/dates';
import type { CloseSection } from '../model/close-section';
import { UncoveredDays as DaysWithoutPlan } from './no-plan-notice';
import { dayColumns, pendingColumns, proposalColumns } from './prerequisite-columns';

function SampleDisclosure({ shown, total }: { shown: number; total: number }) {
  if (shown === 0 && total > 0) return <p role="status" className="text-sm">{total} records reported; sample rows are unavailable.</p>;
  return <p className="text-sm text-muted-foreground">{shown < total ? `First ${shown} of ${total} shown. The server limits this sample to 50 records.` : `All ${total} shown.`}</p>;
}

function PendingPeriods({ view }: { view: MonthCloseView }) {
  const pref = useCalendarPreference();
  const { pending, pendingCount } = view.prerequisites;
  return <Section title="Periods" className="min-w-0" description={`${pendingCount} period${pendingCount === 1 ? '' : 's'} not approved.`}>
    <div className="space-y-3" data-testid="pending-periods">
      {pendingCount === 0 ? <p data-testid="pending-none">Every period of the month is approved.</p> : <>
        <SampleDisclosure shown={pending.length} total={pendingCount} />
        <DataTable caption="Periods not approved" columns={pendingColumns(pref)} rows={pending} getRowKey={(p) => p.periodId}
          pager="none" maxHeight="30rem" empty={{ title: 'Sample unavailable', text: 'The server reported pending periods without sample rows.' }} />
      </>}
      <DaysWithoutPlan view={view} />
      <p className="text-sm"><Link to="/my-queue" className="underline underline-offset-2">Open my queue</Link> for your recent assigned work. It is not a complete list of this month's periods.</p>
    </div>
  </Section>;
}

function UncertifiedDays({ view }: { view: MonthCloseView }) {
  const pref = useCalendarPreference();
  const { days, certifiedDays, uncertifiedDays } = view.prerequisites;
  const count = days - certifiedDays;
  return <Section title="Days" className="min-w-0" description={`${count} of ${days} production days not certified.`}>
    <div className="space-y-3" data-testid="uncertified-days">
      {!view.policy.requireCertifiedDays && <p className="text-sm">Certification does not block close under this policy.</p>}
      {count === 0 ? <p data-testid="days-certified">Every production day is certified ({certifiedDays}).</p> : <>
        <SampleDisclosure shown={uncertifiedDays.length} total={count} />
        <DataTable caption="Days not certified" columns={dayColumns(pref)} rows={uncertifiedDays} getRowKey={(d) => `${d.unitId}-${d.localDate}`}
          pager="none" maxHeight="30rem" empty={{ title: 'Sample unavailable', text: 'The server reported uncertified days without sample rows.' }} />
      </>}
      <DaysWithoutPlan view={view} />
    </div>
  </Section>;
}

function OpenProposals({ view }: { view: MonthCloseView }) {
  const pref = useCalendarPreference();
  const { openProposals, openProposalCount } = view.prerequisites;
  return <Section title="Proposals" className="min-w-0" description={`${openProposalCount} open change proposal${openProposalCount === 1 ? '' : 's'}.`}>
    <div className="space-y-3" data-testid="open-proposals">
      <p className="text-sm">{view.state === 'locked'
        ? 'Review open proposals from their period through the after-close correction workflow.'
        : view.policy.blockOnOpenProposals ? 'Accept or dismiss open proposals from their period before closing.' : 'Open proposals do not block close under this policy.'}</p>
      {openProposalCount === 0 ? <p data-testid="proposals-none">No change proposal is open.</p> : <>
        <SampleDisclosure shown={openProposals.length} total={openProposalCount} />
        <DataTable caption="Open change proposals" columns={proposalColumns(pref, view.deadlines.timezone)} rows={openProposals} getRowKey={(p) => p.proposalId}
          pager="none" maxHeight="30rem" empty={{ title: 'Sample unavailable', text: 'The server reported open proposals without sample rows.' }} />
      </>}
    </div>
  </Section>;
}

/** Authoritative counts and bounded samples; no inferred links or local full-list pagination. */
export function ClosePrerequisites({ view, section }: { view: MonthCloseView; section: CloseSection }) {
  if (section === 'periods') return <PendingPeriods view={view} />;
  if (section === 'days') return <UncertifiedDays view={view} />;
  if (section === 'proposals') return <OpenProposals view={view} />;
  return null;
}
