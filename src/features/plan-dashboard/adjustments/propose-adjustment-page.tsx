import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { AdjustmentForm } from './adjustment-form';

/** `/plans/:planId/periods/:periodId/adjustments/new`: propose a correction of the period's actuals. */
export function ProposeAdjustmentPage() {
  const { planId = '', periodId = null } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { canWritePeriods } = useCapabilities();
  const zone = usePlantTimezone();
  const period = useProductionPeriod(periodId);
  const back = `/plans/${planId}/periods/${periodId ?? ''}/actuals${search}`;
  const state = dataStateOf(period);
  const detail = period.data?.data;
  return (
    <Page>
      <PageHeader
        title="Propose an actuals adjustment"
        description={detail ? <>Period <PlantTime iso={detail.utcStart} tz={zone.timezone} withDate /> → <PlantTime iso={detail.utcEnd} tz={zone.timezone} withDate />. A manager approver who is not you approves it.</> : undefined}
        back={{ to: back, label: 'Actuals & quality' }}
      />
      {!canWritePeriods ? (
        <DataState state="no-permission" detail="Production engineers and manager approvers propose adjustments." />
      ) : state === 'ready' && detail ? (
        <AdjustmentForm period={detail} timezone={zone.timezone} backTo={back} onSaved={() => navigate(back)} />
      ) : (
        <DataState state={state} error={period.error} />
      )}
    </Page>
  );
}
