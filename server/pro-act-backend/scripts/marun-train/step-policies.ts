/**
 * E2E §9 / §12.2, guide lesson 8: Extruder1's stop policy and the gearbox impact rule.
 * - Micro-stop threshold 60 s with trip reason ELEC-TRIP, and the stop-engine settings, recorded by Reza
 *   (manager approver; these writes record an approved version directly) with the owner's commissioning
 *   backdate so they are in force before the first shift.
 * - Grade changes: "Plans already allow for standard grade changes" (no backdate field on this API; written
 *   only when the version in force says otherwise).
 * - Unit impact rule EXT1-Main → full stop: drafted by Farid, approved by Reza.
 */
import {
  BACKDATE_INSTANTS,
  BACKDATE_REASON,
  IMPACT_RULE,
  MICRO_STOP,
  STOP_ENGINE,
  TRANSITION_ALLOWANCE,
} from './train-catalog-setup';
import { TIMES } from './train-catalog';
import { known, TrainContext } from './train-context';

interface OeeVersion {
  unitId: string | null;
  notes: string | null;
}

interface MicroStopView extends OeeVersion {
  microStopSeconds: number;
  tripReasonCodes: string[];
}

interface StopEngineView extends OeeVersion {
  deriveFromState: boolean;
  autoMergeDuplicates: boolean;
  debounceSeconds: number;
  restartConfirmSeconds: number;
  duplicateToleranceSeconds: number;
  incidentWindowSeconds: number;
}

interface TransitionView extends OeeVersion {
  transitionAllowanceInPlan: string;
}

interface RuleRow {
  id: string;
  state: string;
  mode: string;
}

const backdate = (effectiveFrom: string) => ({
  effectiveFrom,
  backdateReason: BACKDATE_REASON,
});

async function ensureMicroStop(
  ctx: TrainContext,
  unitId: string,
): Promise<void> {
  const reza = ctx.as('reza');
  const current = await reza.get<MicroStopView>(
    `/v2/micro-stop-policies/current?unitId=${unitId}`,
  );
  const same =
    current.unitId === unitId &&
    current.microStopSeconds === MICRO_STOP.microStopSeconds &&
    current.tripReasonCodes.join(',') === MICRO_STOP.tripReasonCodes.join(',');
  if (same) {
    ctx.tally.kept('micro-stop policy');
    return;
  }
  ctx.tally.add(
    'micro-stop policy',
    1,
    0,
    `backdated to ${BACKDATE_INSTANTS.microStop}`,
  );
  if (ctx.dryRun) return;
  await reza.post(
    '/v2/micro-stop-policies',
    {
      unitId,
      ...MICRO_STOP,
      tripReasonCodes: [...MICRO_STOP.tripReasonCodes],
      ...backdate(BACKDATE_INSTANTS.microStop),
    },
    'micro-stop policy Extruder1',
  );
}

/** Kept when the values are in force and this seeder's stop-engine version (or a later one of it) is current. */
function stopEngineRecorded(current: StopEngineView, unitId: string): boolean {
  const { notes, ...wanted } = STOP_ENGINE;
  const values = Object.entries(wanted).every(
    ([key, value]) => current[key as keyof StopEngineView] === value,
  );
  const ours =
    current.notes === notes || current.notes === TRANSITION_ALLOWANCE.notes;
  return current.unitId === unitId && values && ours;
}

async function ensureStopEngine(
  ctx: TrainContext,
  unitId: string,
): Promise<void> {
  const reza = ctx.as('reza');
  const current = await reza.get<StopEngineView>(
    `/v2/stop-event-policies/current?unitId=${unitId}`,
  );
  if (stopEngineRecorded(current, unitId)) {
    ctx.tally.kept('stop-engine settings');
    return;
  }
  ctx.tally.add(
    'stop-engine settings',
    1,
    0,
    `backdated to ${BACKDATE_INSTANTS.stopEngine}`,
  );
  if (ctx.dryRun) return;
  await reza.post(
    '/v2/stop-event-policies',
    { unitId, ...STOP_ENGINE, ...backdate(BACKDATE_INSTANTS.stopEngine) },
    'stop-engine settings Extruder1',
  );
}

async function ensureTransitionAllowance(
  ctx: TrainContext,
  unitId: string,
): Promise<void> {
  const reza = ctx.as('reza');
  const current = await reza.get<TransitionView>(
    `/v2/transition-allowance-policies/current?unitId=${unitId}`,
  );
  if (
    current.transitionAllowanceInPlan ===
    TRANSITION_ALLOWANCE.transitionAllowanceInPlan
  ) {
    ctx.tally.kept('grade-change allowance');
    return;
  }
  ctx.tally.add(
    'grade-change allowance',
    1,
    0,
    'effective now (no backdate on this API)',
  );
  if (!ctx.dryRun)
    await reza.post(
      '/v2/transition-allowance-policies',
      { unitId, ...TRANSITION_ALLOWANCE },
      'grade change Extruder1',
    );
}

async function ensureImpactRule(
  ctx: TrainContext,
  unitId: string,
): Promise<void> {
  if (!known(ctx, ctx.ids.assetId, 'asset EXT1-Main')) return;
  const assetId = ctx.ids.assetId;
  const rules = await ctx
    .as('farid')
    .listAll<RuleRow>('/v2/unit-impact-rules', { unitId, assetId });
  if (rules.some((r) => r.state === 'approved')) {
    ctx.tally.kept('unit impact rule');
    return;
  }
  ctx.tally.created('unit impact rule');
  if (ctx.dryRun) return;
  const draft =
    rules.find((r) => r.state === 'draft') ??
    (await ctx
      .as('farid')
      .post<RuleRow>(
        '/v2/unit-impact-rules',
        { unitId, assetId, ...IMPACT_RULE, effectiveFrom: TIMES.dayStart },
        'impact rule EXT1-Main',
      ));
  await ctx
    .as('reza')
    .post(
      `/v2/unit-impact-rules/${draft.id}/approve`,
      {},
      `approve impact rule ${draft.id}`,
    );
}

export async function seedPolicies(ctx: TrainContext): Promise<void> {
  if (!known(ctx, ctx.ids.unitId, 'unit Extruder1')) return;
  const unitId = ctx.ids.unitId;
  await ensureMicroStop(ctx, unitId);
  await ensureStopEngine(ctx, unitId);
  await ensureTransitionAllowance(ctx, unitId);
  await ensureImpactRule(ctx, unitId);
}
