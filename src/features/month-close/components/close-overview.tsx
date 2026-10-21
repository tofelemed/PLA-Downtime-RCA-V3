import { displayCount } from '@/features/ux-kit/format/plural';
import { Link } from 'react-router-dom';
import type { MonthCloseView } from '@/api/v2/types/month-close';
import { Section } from '@/features/ux-kit/page-layout';
import { closeHeadline } from '../model/close-blockers';
import { closeSearch, type CloseSection } from '../model/close-section';
import { CloseDeadlines } from './close-deadlines';
import { CloseSignOffs } from './close-sign-offs';
import { UncoveredDays } from './no-plan-notice';

function PrerequisiteCounts({ view, params }: { view: MonthCloseView; params: URLSearchParams }) {
  const { prerequisites: p, policy } = view;
  const counts: Array<{ section: CloseSection; label: string; count: number; detail: string }> = [
    { section: 'periods', label: 'Periods not approved', count: p.pendingCount, detail: `${displayCount(p.approved)} of ${displayCount(p.periods)} approved` },
    { section: 'days', label: 'Days not certified', count: p.days - p.certifiedDays,
      detail: policy.requireCertifiedDays ? `${displayCount(p.certifiedDays)} of ${displayCount(p.days)} certified` : 'Certification does not block close under this policy' },
    { section: 'proposals', label: 'Open proposals', count: p.openProposalCount,
      detail: view.state === 'locked' ? 'Review through the after-close correction workflow'
        : policy.blockOnOpenProposals ? 'Settle open proposals before closing' : 'Open proposals do not block close under this policy' },
  ];
  return (
    <div className="space-y-2" data-testid="close-prerequisites" data-met={p.met}>
      <p className="text-sm text-muted-foreground"><span data-testid="close-headline">{closeHeadline(view)}</span> Select a count to inspect its records.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {counts.map(({ section, label, count, detail }) => (
          <Link key={section} to={{ search: `?${closeSearch(params, 'section', section)}` }}
            className="min-w-0 rounded-md border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/50"
            data-testid={`close-count-${section}`}>
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-2xl font-semibold tabular-nums" data-testid={`close-count-${section}-value`}>{count}</span>
            <span className="block text-xs text-muted-foreground">{detail}</span>
          </Link>
        ))}
      </div>
      <UncoveredDays view={view} />
    </div>
  );
}

function Materiality({ view }: { view: MonthCloseView }) {
  const { materiality, signOffs, policy } = view;
  const status = signOffs.materialityRequired
    ? (signOffs.materialityReviewedBy ? 'Required review completed.' : 'An extra review is needed before finance signs off.')
    : (policy.materialityEnabled ? 'No extra review required for this month.' : 'Materiality review is not enabled by this policy.');
  return <Section title="Materiality" headingLevel={3} description={status}>
    {materiality.findings.length > 0 && <p className="text-sm break-words" data-testid="materiality-findings">
      Above the materiality threshold: {materiality.findings.map((f) => `${f.quantity} ${f.uom} adjusted (threshold ${f.threshold} ${f.uom})`).join('; ')}.
    </p>}
  </Section>;
}

/** The decision view keeps authoritative counts and the sole command owner ahead of sampled lists. */
export function CloseOverview({ view, params }: { view: MonthCloseView; params: URLSearchParams }) {
  return <div className="space-y-5">
    <PrerequisiteCounts view={view} params={params} />
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-5"><CloseDeadlines view={view} /><Materiality view={view} /></div>
      <div className="min-w-0" data-testid="close-sign-offs"><CloseSignOffs key={view.monthKey} view={view} /></div>
    </div>
  </div>;
}
