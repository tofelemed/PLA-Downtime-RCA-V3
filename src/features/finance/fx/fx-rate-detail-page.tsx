import { useParams } from 'react-router-dom';
import { useFxRate } from '@/api/v2/queries/valuation';
import type { FxRateView, WithRevaluation } from '@/api/v2/types/valuation';
import { FX_RATE_TYPE_LABELS, labelOf } from '@/features/ux-kit/labels';
import { RevaluationQueued } from '../components/revaluation-queued';
import { FinanceAreaTabs } from '../components/finance-area-tabs';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DataState } from '@/features/ux-kit/data-state';
import { Fact } from '../components/fact';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { ProvisionalRateBadge } from '../components/provisional-rate-badge';
import { VersionStateBadge } from '@/features/ux-kit/version-state-badge';
import { FxVersionActions } from './fx-version-actions';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { SelfDecisionBadge } from '@/features/ux-kit/self-decision-badge';
import { fxRateText } from '../model/fx-rate-text';
import { InfoMark } from '@/features/plans-profiles-calendars/components/info-mark';
import { PolicyPerson } from '../components/policy-person';

const BACK = { to: '/finance?tab=fx', label: 'Exchange rates' };
const PROVISIONAL_NOTE =
  'Provisional rate: it converts only dates without an approved final rate, and every value it converts is shown as provisional. Approving the final rate revalues those figures; approved periods get a change proposal.';

function RatePage({ rate }: { rate: FxRateView & WithRevaluation }) {
  const dates = usePlantDates();
  const { digits } = useNumberFormat();
  return (
    <div className="space-y-6" data-testid="fx-detail" data-state={rate.state} data-version={rate.version}>
      <PageHeader
        title={`${rate.fromCurrency} → ${rate.toCurrency}, version ${rate.version}`}
        back={BACK}
        titleAside={
          <span className="flex items-center gap-1.5">
            <VersionStateBadge state={rate.state} />
            <ProvisionalRateBadge provisional={rate.provisional} />
            {rate.provisional && <InfoMark label="the provisional rate" text={PROVISIONAL_NOTE} testId="fx-provisional-note" />}
          </span>
        }
        actions={<FxVersionActions rate={rate} />}
      />
      <FinanceAreaTabs current="fx" />
      <RevaluationQueued revaluation={rate.revaluation} />
      <Section title="Rate">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Rate">
            <span className="font-mono" data-testid="fx-rate">{fxRateText(rate, digits)}</span>
          </Fact>
          <Fact label="Valid">{dates.validity(rate.effectiveFrom, rate.effectiveTo)}</Fact>
          <Fact label="Rate table">{labelOf(FX_RATE_TYPE_LABELS, rate.rateType)}</Fact>
          <Fact label="Source">{rate.source ?? '—'}</Fact>
          {rate.approvedAt && (
            <Fact label="Approved">
              {dates.dateTime(rate.approvedAt)}
              {rate.approvedBy && <> by <PolicyPerson id={rate.approvedBy} /></>} <SelfDecisionBadge selfDecided={rate.selfDecided} />
            </Fact>
          )}
        </dl>
      </Section>
    </div>
  );
}

/** `/finance/fx/:fxId`: one exchange rate version with approve / retire. */
export function FxRateDetailPage() {
  const { fxId } = useParams();
  const rate = useFxRate(fxId ?? null);
  return (
    <Page>
      {rate.data ? (
        <RatePage rate={rate.data} />
      ) : (
        <>
          <PageHeader title="Exchange rate" back={BACK} />
          <FinanceAreaTabs current="fx" />
          <DataState state={dataStateOf(rate)} error={rate.error} onRetry={() => void rate.refetch()} />
        </>
      )}
    </Page>
  );
}
