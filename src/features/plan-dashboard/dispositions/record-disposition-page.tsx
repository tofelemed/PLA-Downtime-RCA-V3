import { useNavigate, useParams } from 'react-router-dom';
import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { DispositionForm } from './disposition-form';

/** `/plans/:planId/periods/:periodId/dispositions/new`: record a lot disposition or a recovery movement. */
export function RecordDispositionPage() {
  const { planId = '', periodId = null } = useParams();
  const navigate = useNavigate();
  const { canWriteDispositions } = useCapabilities();
  const zone = usePlantTimezone();
  const period = useProductionPeriod(periodId);
  const back = `/plans/${planId}/periods/${periodId ?? ''}`;
  const state = dataStateOf(period);
  const detail = period.data?.data;
  return (
    <Page>
      <PageHeader
        title="Record a product disposition"
        description={detail ? <>Period <PlantTime iso={detail.utcStart} tz={zone.timezone} withDate /> → <PlantTime iso={detail.utcEnd} tz={zone.timezone} withDate />. A Quality / Lab approver who is not you approves it.</> : undefined}
        back={{ to: back, label: 'Period' }}
      />
      {!canWriteDispositions ? (
        <DataState state="no-permission" detail="Operators, production engineers, production accountants, manager approvers and Quality / Lab approvers record dispositions." />
      ) : state === 'ready' && detail ? (
        <DispositionForm period={detail} timezone={zone.timezone} backTo={back} onSaved={() => navigate(back)} />
      ) : (
        <DataState state={state} error={period.error} />
      )}
    </Page>
  );
}
