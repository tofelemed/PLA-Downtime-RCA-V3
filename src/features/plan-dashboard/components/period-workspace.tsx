import { lazy, Suspense, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalyticsResponse } from '@/api/v2/types/envelopes';
import type { LedgerKind, PeriodAccountingView, RevisionSelector } from '@/api/v2/types/period-overview';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { AdjustmentsSection } from '../adjustments/adjustments-section';
import { useLossAccountingMode } from '@/features/accounting-mode/use-loss-accounting-mode';
import { CodingGatePanel } from '../coding/coding-gate-panel';
import { PeriodDayPanel } from '../day/day-certification-panel';
import { DispositionsSection } from '../dispositions/dispositions-section';
import { LossLineEditorContent } from '../editor/loss-line-editor';
import { useDraftEditor } from '../hooks/use-draft-editor';
import { useRetainedDraft } from '../hooks/use-retained-draft';
import { useWorkflowActions, type WorkflowActions } from '../hooks/use-workflow-actions';
import { periodPath, PERIOD_SECTIONS } from '../model/period-navigation';
import { stickyPlacement } from '../model/workflow-blockers';
import { RestatementPanel } from '../restatement/restatement-panel';
import { SlaPanel } from '../sla/sla-panel';
import { BridgeReviewPanel } from '../workflow/bridge-review-panel';
import { StickyWorkflowBar } from '../workflow/sticky-workflow-bar';
import { ReviewCorrection } from '../workflow/review-correction';
import { WorkflowBar } from '../workflow/workflow-bar';
import { ActualsProvenance } from './actuals-provenance';
import { DetailToolbar } from './detail-toolbar';
import { LedgerComparison } from './ledger-comparison';
import { MonthLockBanner } from './month-lock-banner';
import type { PeriodDetailProps } from './period-detail';
import { PeriodHeader } from './period-header';
import { PeriodNeighbourNav } from './period-neighbour-nav';
import { PeriodDraftNotices } from './period-draft-notices';
import { ReconciliationSummary } from './reconciliation-summary';
import { ValuationTiles } from './valuation-tiles';

const WaterfallPanel = lazy(() => import('./waterfall-panel').then((m) => ({ default: m.WaterfallPanel })));
const PeriodHistory = lazy(() => import('../workflow/period-history').then((m) => ({ default: m.PeriodHistory })));

interface Props extends PeriodDetailProps {
  data: ReconciliationView;
  accounting: AnalyticsResponse<PeriodAccountingView> | null;
  view: RevisionSelector;
  ledger: LedgerKind;
  onView: (view: RevisionSelector) => void;
  onLedger: (ledger: LedgerKind) => void;
  nav: ReactNode;
  search: string;
}

function ReviewSection({ data, view, timezone, periodId, onView, actions }: Pick<Props, 'data' | 'view' | 'timezone' | 'periodId' | 'onView'> & { actions: WorkflowActions }) {
  const { isDeclared: declared } = useLossAccountingMode(data.unitId);
  return <div className="space-y-6">
    <WorkflowBar view={data} shown={view} onShowCurrent={() => onView('current')} actions={actions} />
    <ReviewCorrection view={data} />
    {view === 'current' && <><BridgeReviewPanel view={data} /><CodingGatePanel view={data} declared={declared} /><SlaPanel view={data} timezone={timezone} /></>}
    {data.revision.supersedesId && <RestatementPanel view={data} />}
    <PeriodDayPanel periodId={periodId} />
  </div>;
}

/** A single draft owner survives section changes; commands and server figures retain their existing components. */
export function PeriodWorkspace({ planId, periodId, unitName, planLabel, planWindow, timezone, section, data, accounting, view, ledger, onView, onLedger, nav, search }: Props) {
  const { canWritePeriods } = useCapabilities();
  const editor = useDraftEditor(data);
  const editable = canWritePeriods && view === 'current' && data.revision.lifecycle === 'draft';
  const basePath = periodPath(planId, periodId);
  const retained = useRetainedDraft(data, editor, editable, basePath);
  const actions = useWorkflowActions(data);
  return (
    <section data-testid="period-detail" data-lifecycle={data.revision.lifecycle} className="space-y-5">
      <PeriodHeader view={data} accounting={accounting} unitName={unitName} planLabel={planLabel} timezone={timezone}
        neighbours={<PeriodNeighbourNav planId={planId} period={data} plan={planWindow} section={section} search={search} />} />
      <MonthLockBanner monthClose={data.monthClose} />
      <DetailToolbar view={view} onView={onView} ledger={ledger} onLedger={onLedger} canShowApproved={data.publishedRevision !== null} />
      <PeriodDraftNotices retained={retained} editable={editable} />
      <StickyWorkflowBar view={data} actions={actions} unsavedLines={editor.draft.dirty} {...stickyPlacement(section, view, `${basePath}/review${search}`)} />
      {editor.draft.dirty && editable && section !== '' && <p role="status" className="rounded-md border border-warning/40 p-3 text-sm">Unsaved loss-line changes. <Link className="font-medium underline" to={`${basePath}${search}`}>Return to Reconciliation to save or discard.</Link></p>}
      {nav}
      <h2 className="text-lg font-semibold" data-testid="period-section-heading">{PERIOD_SECTIONS.find((item) => item.path === section)?.label}</h2>
      {/* Keep the editor subtree alive too: unfinished manual-line fields and conflict dialogs are local state. */}
      <div hidden={section !== ''} className="space-y-6" data-testid="period-reconciliation-panel">
        <ReconciliationSummary view={data} ledger={ledger} />
        <LedgerComparison accounting={accounting} ledger={ledger} />
        <LossLineEditorContent view={data} timezone={timezone} readOnly={!editable || retained.pending !== null || retained.atCapacity} editor={editor} />
        {section === '' && <Suspense fallback={<Skeleton className="h-48 w-full" />}><WaterfallPanel periodId={periodId} ledger={ledger} view={view} /></Suspense>}
      </div>
      {section === 'actuals' && <div className="space-y-6"><ActualsProvenance periodId={periodId} timezone={timezone} /><AdjustmentsSection planId={planId} periodId={periodId} /><DispositionsSection planId={planId} periodId={periodId} timezone={timezone} /></div>}
      {section === 'review' && <ReviewSection data={data} view={view} timezone={timezone} periodId={periodId} onView={onView} actions={actions} />}
      {section === 'value' && <ValuationTiles key={data.revision.id} period={data} ledger={ledger} approvedOnly={view === 'approved'} historyHref={`${basePath}/history${search}`} reviewHref={`${basePath}/review${search}`} />}
      {section === 'history' && <Suspense fallback={<Skeleton className="h-24 w-full" />}><PeriodHistory view={data} timezone={timezone} /></Suspense>}
    </section>
  );
}
