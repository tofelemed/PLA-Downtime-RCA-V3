/**
 * Reliability set-up of the full showcase plant (SME D1 / D2 / D6 / D11), through the v2 API: the demo
 * ISO 14224-style failure dictionary (one import, idempotent), per-unit micro-stop thresholds by asset class
 * (120 s pilot for operator-cleared bagger / conveyor stops; drive trips always events) and the state
 * mapping of Extruder Line 1's simulator run-state signal. Values are illustrative and every record says
 * "Demo"; nothing here is a product default.
 */
import { DEMO_DICTIONARY } from './catalog-failure-dictionary';
import { ShowcaseContext } from './showcase-context';

interface ImportResult {
  total: number;
  created: number;
  superseded: number;
  unchanged: number;
}

interface MicroStopPolicy {
  unitId: string | null;
  microStopSeconds: number;
  microStopSecondsByAssetClass: Record<string, number>;
  tripReasonCodes: string[];
}

interface SignalRow {
  id: string;
  unitId: string;
  name: string;
  semanticType: string;
}

/** Demo pilot thresholds per unit (SME D6, illustrative): asset type → seconds. */
const MICRO_STOPS: Readonly<Record<string, Record<string, number>>> = {
  BAG: { Bagger: 120, Conveyor: 120, Scale: 120, Robot: 120, Wrapper: 120 },
  PEL: { Conveyor: 120, Dryer: 60 },
  // a drive or screw stop of an extruder is a process trip: every one is an availability event
  EXT1: { Motor: 0, Gearbox: 0, Extruder: 0 },
  EXT2: { Motor: 0, Gearbox: 0, Extruder: 0 },
};
/** Demo trip reasons (interlock / protection trips): never micro-stops, whatever their length. */
const TRIP_REASONS = ['ELEC-MTR', 'PROC-MELT', 'EXT-PWR'];
const UNIT_THRESHOLD_SECONDS = 60;
const DEMO_POLICY_NOTE =
  'Demo pilot (SME D6, illustrative): micro-stop threshold per asset class; trips are always events';

async function seedDictionary(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('reliability', 0);
  const body = {
    entries: DEMO_DICTIONARY,
    effectiveFrom: '2026-08-01T00:00:00.000Z',
  };
  const check = await author.post<ImportResult>(
    '/v2/failure-dictionary/import',
    { ...body, dryRun: true },
    'dictionary check',
  );
  ctx.tally.add(
    'failure dictionary (demo)',
    check.created + check.superseded,
    check.unchanged,
    `${check.total} ISO 14224-style rows`,
  );
  if (ctx.dryRun || check.created + check.superseded === 0) return;
  await author.post('/v2/failure-dictionary/import', body, 'dictionary import');
}

const sameMap = (a: Record<string, number>, b: Record<string, number>) =>
  JSON.stringify(Object.entries(a).sort()) ===
  JSON.stringify(Object.entries(b).sort());

async function seedMicroStops(ctx: ShowcaseContext): Promise<void> {
  const manager = ctx.as('managers', 0);
  for (const [unitKey, byClass] of Object.entries(MICRO_STOPS)) {
    const unitId = ctx.ids.units.get(unitKey);
    if (!unitId) continue;
    const current = await manager.get<MicroStopPolicy>(
      `/v2/micro-stop-policies/current?unitId=${unitId}`,
    );
    if (
      current.unitId === unitId &&
      sameMap(current.microStopSecondsByAssetClass, byClass)
    ) {
      ctx.tally.kept('micro-stop policies (demo)');
      continue;
    }
    ctx.tally.created('micro-stop policies (demo)');
    if (ctx.dryRun) continue;
    await manager.post(
      '/v2/micro-stop-policies',
      {
        unitId,
        microStopSeconds: UNIT_THRESHOLD_SECONDS,
        microStopSecondsByAssetClass: byClass,
        tripReasonCodes: TRIP_REASONS,
        notes: DEMO_POLICY_NOTE,
      },
      `micro-stop ${unitKey}`,
    );
  }
}

/** Extruder Line 1's simulator run-state signal (RUN / STOP; other codes listed for the PackML-style states). */
async function seedStateMapping(ctx: ShowcaseContext): Promise<void> {
  const unitId = ctx.ids.units.get('EXT1');
  if (!unitId) return;
  const manager = ctx.as('managers', 0);
  const signals = await manager.listAll<SignalRow>('/v2/signals', {
    unitId,
    semanticType: 'state',
  });
  const signal = signals.find((s) => s.semanticType === 'state');
  if (!signal) {
    ctx.tally.add(
      'state mappings (demo)',
      0,
      0,
      'no state signal on Extruder Line 1 (run db:seed-demo-mqtt)',
    );
    return;
  }
  const versions = await manager.listAll<{ signalId: string }>(
    '/v2/unit-state-mappings',
    { unitId },
  );
  if (versions.some((v) => v.signalId === signal.id)) {
    ctx.tally.kept('state mappings (demo)');
    return;
  }
  ctx.tally.created('state mappings (demo)');
  if (ctx.dryRun) return;
  await manager.post(
    '/v2/unit-state-mappings',
    {
      unitId,
      signalId: signal.id,
      rules: [
        { match: 'RUN', state: 'running' },
        { match: 'STOP', state: 'internal_stop' },
        { match: 'HELD', state: 'internal_stop' },
        { match: 'STARVED', state: 'starved' },
        { match: 'BLOCKED', state: 'blocked' },
        { match: 'CHANGEOVER', state: 'planned_stop' },
        { match: 'MAINT', state: 'planned_stop' },
        { match: 'IDLE', state: 'standby' },
        { match: 'OFF', state: 'not_scheduled' },
      ],
      expectedIntervalSeconds: 10,
      jitterSeconds: 2,
      staleAfterIntervals: 3,
      isHeartbeat: true,
      notes:
        'Demo mapping (SME D1 / D2, illustrative): 10 s heartbeat, stale after 3 intervals + 2 s jitter',
    },
    'state mapping EXT1',
  );
}

export async function seedReliabilitySetup(
  ctx: ShowcaseContext,
): Promise<void> {
  ctx.logger.log(
    'Demo reliability set-up: ISO 14224-style dictionary, micro-stop pilot, state mapping (illustrative)',
  );
  await seedDictionary(ctx);
  await seedMicroStops(ctx);
  await seedStateMapping(ctx);
}
