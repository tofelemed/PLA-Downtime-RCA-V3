import { useParams } from 'react-router-dom';
import { useFxRate } from '@/api/v2/queries/valuation';
import type { FxRateView } from '@/api/v2/types/valuation';
import { usePlantDates } from '@/features/codes-admin/hooks/use-plant-dates';
import { DataState } from '@/features/ux-kit/data-state';
import { Fact } from '../components/fact';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { VersionStateBadge } from '../components/version-state-badge';
import { FxVersionActions } from './fx-version-actions';

const BACK = { to: '/finance?tab=fx', label: 'Exchange rates' };


function RatePage({ rate }: { rate: FxRateView }) {
  const dates = usePlantDates();
  return (
    <div className="space-y-6" data-testid="fx-detail" data-state={rate.state} data-version={rate.version}>
      <PageHeader
        title={`${rate.fromCurrency} → ${rate.toCurrency}, version ${rate.version}`}
        back={BACK}
        description={<VersionStateBadge state={rate.state} />}
        actions={<FxVersionActions rate={rate} />}
      />
      <Section title="Rate">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Rate">
            <span className="font-mono" data-testid="fx-rate">1 {rate.fromCurrency} = {rate.rate} {rate.toCurrency}</span>
          </Fact>
          <Fact label="Valid">{dates.validity(rate.effectiveFrom, rate.effectiveTo)}</Fact>
          <Fact label="Source">{rate.source ?? '—'}</Fact>
          {rate.approvedAt && <Fact label="Approved">{dates.dateTime(rate.approvedAt)}</Fact>}
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
          <DataState state={dataStateOf(rate)} error={rate.error} onRetry={() => void rate.refetch()} />
        </>
      )}
    </Page>
  );
}
