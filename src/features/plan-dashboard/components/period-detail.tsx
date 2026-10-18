import { useSearchParams } from 'react-router-dom';
import { useReconciliation } from '@/api/v2/queries/period-overview';
import { usePeriodAccounting } from '@/api/v2/queries/production-periods';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { periodPath, periodSelection, withPeriodSelection, type PeriodSection } from '../model/period-navigation';
import { DetailToolbar } from './detail-toolbar';
import { PeriodSectionNav } from './period-section-nav';
import { PeriodWorkspace } from './period-workspace';
import { usePeriodDraftOwner } from '../hooks/use-period-draft-owner';
import type { PlanWindow } from '../model/period-neighbours';

export interface PeriodDetailProps {
  planId: string;
  periodId: string;
  unitName: string;
  planLabel: string;
  timezone: string;
  section: PeriodSection;
  /** the plan version's validity: bounds of the previous / next period links */
  planWindow: PlanWindow;
}

/** Persistent period owner: URL-selected revision/ledger and authoritative accounting reads. */
export function PeriodDetail(props: PeriodDetailProps) {
  const { planId, periodId } = props;
  const draftOwner = usePeriodDraftOwner();
  const [search, setSearch] = useSearchParams();
  const { view, ledger } = periodSelection(search);
  const reconciliation = useReconciliation(periodId, view);
  const revisionNumber = reconciliation.data?.revision.revision ?? null;
  const accounting = usePeriodAccounting(revisionNumber === null ? null : periodId, revisionNumber === null ? {} : { revision: revisionNumber });
  const state = reconciliation.isPlaceholderData ? 'loading' : dataStateOf(reconciliation);
  const onView = (next: typeof view) => setSearch(withPeriodSelection(search, 'view', next));
  const onLedger = (next: typeof ledger) => setSearch(withPeriodSelection(search, 'ledger', next));
  const query = search.size ? `?${search}` : '';
  const nav = <PeriodSectionNav basePath={periodPath(planId, periodId)} search={query} />;
  if (state !== 'ready' || !reconciliation.data) {
    const detail = state === 'error' ? 'No accounting revision for this view yet (the period is not calculated, or nothing is approved).' : undefined;
    return (
      <section data-testid="period-detail" className="space-y-4">
        <DetailToolbar view={view} onView={onView} ledger={ledger} onLedger={onLedger} canShowApproved />
        {nav}
        <DataState state={state} error={reconciliation.error} detail={detail} />
      </section>
    );
  }
  return <PeriodWorkspace key={`${draftOwner}:${reconciliation.data.revision.id}`} {...props} data={reconciliation.data} accounting={accounting.data ?? null}
    view={view} ledger={ledger} onView={onView} onLedger={onLedger} nav={nav} search={query} />;
}
