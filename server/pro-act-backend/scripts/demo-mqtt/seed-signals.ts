/**
 * The measurement signals of the simulator's `measurements` scenario, bound to the measurements
 * connection and the chosen unit: the numeric `--signal` (a tonnes counter) and the digital
 * `--digital-signal` (run state). `MeasurementHandler` binds a sample by `source_key` and connection;
 * without these every sample would be parked as `unknown_signal`.
 */
import { SIM_SIGNALS, SIM_TOPICS, SignalPlan } from './demo-mqtt-plan';
import {
  createUnlessDryRun,
  Outcome,
  report,
  SeedContext,
  seedKey,
} from './seed-support';

interface SignalRow {
  id: string;
  sourceKey: string;
  effectiveTo: string | null;
}

export interface SignalTargets {
  /** the measurements connection; null in a dry run that would create it */
  connectionId: string | null;
  /** the chosen unit; null in a dry run that would create it */
  unitId: string | null;
}

function signalBody(plan: SignalPlan, targets: SignalTargets) {
  return {
    connectionId: targets.connectionId,
    name: plan.name,
    sourceKey: plan.sourceKey,
    sourcePath: SIM_TOPICS.measurement(plan.attribute),
    unitId: targets.unitId,
    semanticType: plan.semanticType,
    ...(plan.canonicalUom ? { canonicalUom: plan.canonicalUom } : {}),
    interpolation: 'step',
    // the simulated counter drops every few samples: a drop is a reset, never a negative quantity
    ...(plan.semanticType === 'counter' ? { resetPolicy: 'detect_drop' } : {}),
    isAuthority: false,
  };
}

function describe(plan: SignalPlan): string {
  const uom = plan.canonicalUom ? `, ${plan.canonicalUom}` : '';
  return `signal ${plan.sourceKey} (${plan.semanticType}${uom})`;
}

export async function ensureSignals(
  ctx: SeedContext,
  targets: SignalTargets,
): Promise<Outcome[]> {
  const rows = targets.connectionId
    ? await ctx.client.listAll<SignalRow>('/api/v2/signals', {
        connectionId: targets.connectionId,
      })
    : [];
  const outcomes: Outcome[] = [];
  for (const plan of SIM_SIGNALS) {
    const what = describe(plan);
    const current = rows.find(
      (row) => row.sourceKey === plan.sourceKey && row.effectiveTo === null,
    );
    if (current) {
      outcomes.push(report(ctx, { what, status: 'kept', id: current.id }));
      continue;
    }
    outcomes.push(
      await createUnlessDryRun(ctx, what, () =>
        createSignal(ctx, plan, targets),
      ),
    );
  }
  return outcomes;
}

async function createSignal(
  ctx: SeedContext,
  plan: SignalPlan,
  targets: SignalTargets,
): Promise<{ id: string }> {
  if (!targets.connectionId || !targets.unitId) {
    throw new Error(
      `signal ${plan.sourceKey}: no connection or unit to bind to`,
    );
  }
  const { body } = await ctx.client.write<SignalRow>(
    'POST',
    '/api/v2/signals',
    signalBody(plan, targets),
    {
      idempotencyKey: seedKey([
        ctx.tenantId,
        'signal',
        targets.connectionId,
        plan.sourceKey,
        targets.unitId,
      ]),
    },
  );
  return { id: body.id };
}
