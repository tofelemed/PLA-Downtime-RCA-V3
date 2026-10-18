import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLotDispositions } from '@/api/v2/queries/lot-dispositions';
import { useProductionPeriod } from '@/api/v2/queries/production-periods';
import type { LotDispositionView, PeriodDetailView } from '@/api/v2/types/periods';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader } from '@/features/ux-kit/page-layout';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { canCorrect, correctionOf, SUPERSEDES_PARAM } from '../model/disposition-form';
import { DispositionForm } from './disposition-form';

/** The approved disposition named by `?supersedes=`, among the period's; undefined while loading, null if not correctable. */
function useCorrected(detail: PeriodDetailView | undefined, supersedesId: string | null): LotDispositionView | null | undefined {
  const list = useLotDispositions(detail && supersedesId ? { unitId: detail.unitId, from: detail.utcStart, to: detail.utcEnd } : null);
  if (!supersedesId) return null;
  if (!list.data) return undefined;
  const row = list.data.items.find((d) => d.id === supersedesId);
  return row && canCorrect(row, list.data.items) ? row : null;
}

interface BodyProps {
  period: ReturnType<typeof useProductionPeriod>;
  supersedesId: string | null;
  timezone: string;
  back: string;
}

/** The form once the period (and the corrected disposition) are loaded, otherwise their state. */
function DispositionPageBody({ period, supersedesId, timezone, back }: BodyProps) {
  const navigate = useNavigate();
  const { canWriteDispositions } = useCapabilities();
  const state = dataStateOf(period);
  const detail = period.data?.data;
  const corrected = useCorrected(detail, supersedesId);
  if (!canWriteDispositions) {
    return <DataState state="no-permission" detail="Operators, production engineers, production accountants, manager approvers and Quality / Lab approvers record dispositions." />;
  }
  if (supersedesId && corrected === null) {
    return <DataState state="empty" detail="This disposition cannot be corrected: it is not approved, it was already corrected, or a correction of it is waiting for approval." />;
  }
  if (state !== 'ready' || !detail || corrected === undefined) return <DataState state={state === 'ready' ? 'loading' : state} error={period.error} />;
  return <DispositionForm period={detail} timezone={timezone} backTo={back} onSaved={() => navigate(back)} initial={corrected ? correctionOf(corrected) : undefined} />;
}

/** The return path to Actuals & quality and the corrected disposition named by `?supersedes=`. */
function useDispositionRoute() {
  const { planId = '', periodId = null } = useParams();
  const params = new URLSearchParams(useLocation().search);
  const supersedesId = params.get(SUPERSEDES_PARAM);
  params.delete(SUPERSEDES_PARAM);
  const rest = params.toString();
  return { periodId, supersedesId, back: `/plans/${planId}/periods/${periodId ?? ''}/actuals${rest ? `?${rest}` : ''}` };
}

/**
 * `/plans/:planId/periods/:periodId/dispositions/new`: record a lot disposition or a recovery movement; with
 * `?supersedes=<id>` a correction of that approved disposition (a Quality / Lab approver decides it).
 */
export function RecordDispositionPage() {
  const { periodId, supersedesId, back } = useDispositionRoute();
  const zone = usePlantTimezone();
  const period = useProductionPeriod(periodId);
  const detail = period.data?.data;
  const until = supersedesId ? '; the approved disposition stays in force until then' : '';
  return (
    <Page>
      <PageHeader
        title={supersedesId ? 'Correct a product disposition' : 'Record a product disposition'}
        description={detail ? <>Period <PlantTime iso={detail.utcStart} tz={zone.timezone} withDate /> → <PlantTime iso={detail.utcEnd} tz={zone.timezone} withDate />. A Quality / Lab approver who is not you approves it{until}.</> : undefined}
        back={{ to: back, label: 'Actuals & quality' }}
      />
      <DispositionPageBody period={period} supersedesId={supersedesId} timezone={zone.timezone} back={back} />
    </Page>
  );
}
