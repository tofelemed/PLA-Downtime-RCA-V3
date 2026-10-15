import { lazy, Suspense, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useReconciliation } from '@/api/v2/queries/period-overview';
import { usePeriodAccounting } from '@/api/v2/queries/production-periods';
import type { LedgerKind, RevisionSelector } from '@/api/v2/types/period-overview';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { AdjustmentsSection } from '../adjustments/adjustments-section';
import { CodingGatePanel } from '../coding/coding-gate-panel';
import { DispositionsSection } from '../dispositions/dispositions-section';
import { LossLineEditor } from '../editor/loss-line-editor';
import { PeriodDayPanel } from '../day/day-certification-panel';
import { RestatementPanel } from '../restatement/restatement-panel';
import { SlaPanel } from '../sla/sla-panel';
import { WorkflowBar } from '../workflow/workflow-bar';
import { ActualsProvenance } from './actuals-provenance';
import { DetailToolbar } from './detail-toolbar';
import { LedgerComparison } from './ledger-comparison';
import { PeriodHeader } from './period-header';
import { ReconciliationSummary } from './reconciliation-summary';
import { ValuationTiles } from './valuation-tiles';

const WaterfallPanel = lazy(() => import('./waterfall-panel').then((m) => ({ default: m.WaterfallPanel })));
const PeriodHistory = lazy(() => import('../workflow/period-history').then((m) => ({ default: m.PeriodHistory })));

export interface PeriodDetailProps {
  planId: string;
  periodId: string;
  unitName: string;
  planLabel: string;
  timezone: string;
}

/**
 * One period's accounting workspace: header, the shown revision (current or approved), both ledgers with
 * the ledger toggle (plan by default), actuals provenance and adjustments, the loss-line editor (drafts
 * only), workflow, waterfall, value and history.
 */
export function PeriodDetail({ planId, periodId, unitName, planLabel, timezone }: PeriodDetailProps) {
  const { canWritePeriods } = useCapabilities();
  const [view, setView] = useState<RevisionSelector>('current');
  const [ledger, setLedger] = useState<LedgerKind>('plan');
  const reconciliation = useReconciliation(periodId, view);
  const revisionNumber = reconciliation.data?.revision.revision ?? null;
  const accounting = usePeriodAccounting(revisionNumber === null ? null : periodId, revisionNumber === null ? {} : { revision: revisionNumber });
  const state = dataStateOf(reconciliation);
  if (state !== 'ready' || !reconciliation.data) {
    const detail = state === 'error' ? 'No accounting revision for this view yet (the period is not calculated, or nothing is approved).' : undefined;
    return (
      <section data-testid="period-detail" className="space-y-2">
        <DetailToolbar view={view} onView={setView} ledger={ledger} onLedger={setLedger} canShowApproved />
        <DataState state={state} error={reconciliation.error} detail={detail} />
      </section>
    );
  }
  const data = reconciliation.data;
  const editable = canWritePeriods && view === 'current' && data.revision.lifecycle === 'draft';
  return (
    <section data-testid="period-detail" data-lifecycle={data.revision.lifecycle} className="space-y-6">
      <PeriodHeader view={data} accounting={accounting.data ?? null} unitName={unitName} planLabel={planLabel} timezone={timezone} />
      <DetailToolbar view={view} onView={setView} ledger={ledger} onLedger={setLedger} canShowApproved={data.publishedRevision !== null} />
      <ReconciliationSummary view={data} />
      <LedgerComparison accounting={accounting.data ?? null} ledger={ledger} />
      <ActualsProvenance periodId={periodId} timezone={timezone} />
      <AdjustmentsSection planId={planId} periodId={periodId} />
      <DispositionsSection planId={planId} periodId={periodId} timezone={timezone} />
      <LossLineEditor key={data.revision.id} view={data} timezone={timezone} readOnly={!editable} />
      <WorkflowBar view={data} shown={view} onShowCurrent={() => setView('current')} />
      {view === 'current' && <CodingGatePanel view={data} />}
      {view === 'current' && <SlaPanel view={data} timezone={timezone} />}
      {data.revision.supersedesId && <RestatementPanel view={data} />}
      <PeriodDayPanel periodId={periodId} />
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <WaterfallPanel periodId={periodId} ledger={ledger} view={view} />
      </Suspense>
      <ValuationTiles period={data} ledger={ledger} approvedOnly={view === 'approved'} />
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <PeriodHistory view={data} timezone={timezone} />
      </Suspense>
    </section>
  );
}
