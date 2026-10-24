import { useNavigate, useParams } from 'react-router-dom';
import { useCodeList } from '@/api/v2/queries/codes-admin';
import { useValuationPolicy } from '@/api/v2/queries/valuation';
import type { ValuationPolicyView, WithRevaluation } from '@/api/v2/types/valuation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { pageNameOf } from '@/features/auth/navigation-items';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DataState } from '@/features/ux-kit/data-state';
import { InlineError } from '@/features/ux-kit/errors/inline-error';
import { Fact } from '../components/fact';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { DEFAULT_BASIS_LABELS, DEMAND_RULE_LABELS, FX_DATE_RULE_LABELS, FX_POLICY_LABELS, FX_RATE_TYPE_LABELS, labelOf, TIME_BASIS_RULE_LABELS } from '@/features/ux-kit/labels';
import { POLICY_STATUS_LABELS } from '@/features/ux-kit/labels/codes-finance-labels';
import { policyNoteText } from '@/features/ux-kit/format/built-in-default';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { ActionIcon } from '@/lib/icons';
import { currenciesLabel, policyStatus } from '../model/policy-status';
import { PolicyPerson } from '../components/policy-person';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { RevaluationQueued } from '../components/revaluation-queued';
import { FinanceAreaTabs } from '../components/finance-area-tabs';
import { PolicyApprove } from './policy-approve';

const BACK = { to: '/finance?tab=policies', label: 'Valuation policy' };
const trailOf = (version: number) => [{ label: pageNameOf('/finance'), to: '/finance' }, { label: 'Valuation policy', to: BACK.to }, { label: `Version ${version}` }];
/** Why a version cannot be changed, behind the ⓘ beside its status. */
const STATUS_NOTES: Partial<Record<ReturnType<typeof policyStatus>, string>> = {
  approved: 'Approved versions cannot be changed; create a new version instead.',
  placeholder: 'Kept as history from the earlier setup; it has no reporting currency and cannot be approved.',
};
const bodyText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Names of the impact codes counted as independent cost components (never their ids). */
function IndependentCodes({ ids }: { ids: readonly string[] }) {
  const impacts = useCodeList('impact-codes', { includeRetired: true });
  if (ids.length === 0) return <>None</>;
  if (impacts.isLoading) return <>Loading…</>;
  if (impacts.isError) return <InlineError title="Could not load the impact codes." error={impacts.error} onRetry={() => void impacts.refetch()} />;
  return <>{ids.map((id) => impacts.items.find((entry) => entry.id === id)).map((code) => (code ? `${code.code} — ${code.name}` : 'Unknown impact code')).join(', ')}</>;
}

function PolicyFacts({ policy }: { policy: ValuationPolicyView }) {
  const dates = usePlantDates();
  const independent = Array.isArray(policy.body.independentImpactCodeIds) ? policy.body.independentImpactCodeIds.filter((entry): entry is string => typeof entry === 'string') : [];
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Fact label="Reporting currencies">{currenciesLabel(policy)}</Fact>
      <Fact label="Default management view">{labelOf(DEFAULT_BASIS_LABELS, bodyText(policy.body.defaultBasis))}</Fact>
      <Fact label="Time-based costs">{labelOf(TIME_BASIS_RULE_LABELS, bodyText(policy.body.timeBasisRule))}</Fact>
      <Fact label="Currency conversion">{labelOf(FX_POLICY_LABELS, bodyText(policy.body.fxPolicy))}</Fact>
      <Fact label="Exchange-rate table">{labelOf(FX_RATE_TYPE_LABELS, bodyText(policy.body.fxRateType) ?? 'economic')}</Fact>
      <Fact label="Rate date">{labelOf(FX_DATE_RULE_LABELS, bodyText(policy.body.fxDateRule) ?? 'event_date')}</Fact>
      <Fact label="Lost sales">{bodyText(policy.body.demandRule) ? labelOf(DEMAND_RULE_LABELS, bodyText(policy.body.demandRule)) : 'No economic view'}</Fact>
      <Fact label="Valid">{dates.validity(policy.effectiveFrom, policy.effectiveTo)}</Fact>
      <Fact label="Author"><PolicyPerson id={policy.createdBy} /></Fact>
      {policy.approvedAt && (
        <Fact label="Approved">
          {dates.dateTime(policy.approvedAt)}
          {policy.approvedBy && <> by <PolicyPerson id={policy.approvedBy} /></>} <SelfDecisionBadge selfDecided={policy.selfDecided} />
        </Fact>
      )}
      {bodyText(policy.body.timeBasisRule) === 'independent_components' && (
        <Fact label="Independent cost components">
          <IndependentCodes ids={independent} />
        </Fact>
      )}
      {policy.backdateReason && (
        <Fact label="Commissioning backdate">
          {policy.backdateReason}
          {policy.restateApproved ? ' · approved figures in range get change proposals' : ''}
        </Fact>
      )}
      {policy.notes && <Fact label="Notes">{policyNoteText(policy.notes)}</Fact>}
    </dl>
  );
}

function PolicyView({ policy }: { policy: ValuationPolicyView & WithRevaluation }) {
  const navigate = useNavigate();
  const { canMaintainValuation } = useCapabilities();
  const status = policyStatus(policy);
  const actions = (
    <>
      <PolicyApprove policy={policy} status={status} />
      {status !== 'placeholder' && canMaintainValuation && (
        <Button variant="outline" onClick={() => navigate(`/finance/policies/new?from=${policy.id}`)} data-testid="policy-copy">
          <ActionIcon.duplicate aria-hidden="true" />
          New version from this
        </Button>
      )}
    </>
  );
  const note = STATUS_NOTES[status];
  const aside = (
    <span className="flex items-center gap-1.5">
      <Badge variant={policy.approved ? 'default' : 'outline'} className="whitespace-nowrap" data-testid="policy-status">{POLICY_STATUS_LABELS[status]}</Badge>
      {note && <KpiInfo label="this version" text={note} />}
    </span>
  );
  return (
    <div className="space-y-6" data-testid="policy-detail" data-version={policy.version} data-status={status}>
      <PageHeader title={`Valuation policy version ${policy.version}`} back={BACK} breadcrumbs={trailOf(policy.version)} titleAside={aside} actions={actions} />
      <FinanceAreaTabs current="policies" />
      <RevaluationQueued revaluation={policy.revaluation} />
      <Section title="Settings">
        <PolicyFacts policy={policy} />
      </Section>
    </div>
  );
}

/** `/finance/policies/:policyId`: one valuation policy version with its approval. */
export function PolicyDetailPage() {
  const { policyId } = useParams();
  const policy = useValuationPolicy(policyId ?? null);
  return (
    <Page>
      {policy.data ? (
        <PolicyView policy={policy.data} />
      ) : (
        <>
          <PageHeader title="Valuation policy" back={BACK} />
          <FinanceAreaTabs current="policies" />
          <DataState state={dataStateOf(policy)} error={policy.error} onRetry={() => void policy.refetch()} />
        </>
      )}
    </Page>
  );
}
