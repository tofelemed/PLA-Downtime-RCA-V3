/**
 * Read-only checks of the accounting set-up against the guide: stop policy in force before the first
 * shift, impact rule, MQTT intake, MQTT source authority in force at 2026-10-17T03:00Z, finance inputs and
 * the approved plan with three periods of 224 t.
 */
import { PLAN, PRODUCTS, TIMES } from './train-catalog';
import {
  CONNECTION_NAME,
  FX_RATE,
  MICRO_STOP,
  SIGNALS,
  STOP_ENGINE,
  VALUATION_POLICY,
} from './train-catalog-setup';
import { Check, check, covers, Refs } from './verify-support';

/** An instant inside Shift A, after the backdated policies and before any production data. */
const AUTHORITY_PROBE = '2026-10-17T03:00:00.000Z';

interface Identified {
  id: string;
}

interface Versioned extends Identified {
  state: string;
}

interface MicroStopView extends Identified {
  unitId: string | null;
  microStopSeconds: number;
  tripReasonCodes: string[];
  effectiveFrom: string;
}

type StopEngineView = Record<string, unknown> & {
  id: string;
  effectiveFrom: string;
};

const idsOf = (rows: readonly Identified[]): string[] => rows.map((r) => r.id);

async function checkMicroStop(refs: Refs, unitId: string): Promise<Check> {
  const micro = await refs.reader.get<MicroStopView>(
    `/v2/micro-stop-policies/current?unitId=${unitId}`,
  );
  const ok =
    micro.unitId === unitId &&
    micro.microStopSeconds === MICRO_STOP.microStopSeconds &&
    micro.tripReasonCodes.includes('ELEC-TRIP');
  const detail = `${micro.microStopSeconds} s, trips ${micro.tripReasonCodes.join(',')}, from ${micro.effectiveFrom}`;
  return check('micro-stop policy', ok, detail, [micro.id]);
}

async function checkStopEngine(refs: Refs, unitId: string): Promise<Check[]> {
  const engine = await refs.reader.get<StopEngineView>(
    `/v2/stop-event-policies/current?unitId=${unitId}`,
  );
  const { notes, ...wanted } = STOP_ENGINE;
  const ok = Object.entries(wanted).every(([k, v]) => engine[k] === v);
  const early = Date.parse(engine.effectiveFrom) <= Date.parse(TIMES.dayStart);
  const from = `from ${engine.effectiveFrom}`;
  return [
    check('stop-engine settings', ok, `${from} (${notes})`, [engine.id]),
    check('stop policy before first shift', early, from),
  ];
}

async function checkGradeAndImpact(
  refs: Refs,
  unitId: string,
): Promise<Check[]> {
  const grade = await refs.reader.get<{ transitionAllowanceInPlan: string }>(
    `/v2/transition-allowance-policies/current?unitId=${unitId}`,
  );
  const rules = await refs.reader.listAll<Versioned & { mode: string }>(
    '/v2/unit-impact-rules',
    { unitId },
  );
  const rule = rules.find(
    (r) => r.state === 'approved' && r.mode === 'full_stop',
  );
  const allowance = grade.transitionAllowanceInPlan;
  return [
    check('grade-change allowance', allowance === 'planned', allowance),
    check(
      'unit impact rule',
      Boolean(rule),
      rule ? 'EXT1-Main full stop, approved' : 'none approved',
      rule ? [rule.id] : [],
    ),
  ];
}

export async function checkPolicies(refs: Refs): Promise<Check[]> {
  const unitId = refs.unitId ?? '';
  return [
    await checkMicroStop(refs, unitId),
    ...(await checkStopEngine(refs, unitId)),
    ...(await checkGradeAndImpact(refs, unitId)),
  ];
}

async function checkSignals(refs: Refs, connectionId: string): Promise<Check> {
  const signals = await refs.reader.listAll<
    Identified & { sourceKey: string; isAuthority: boolean }
  >('/v2/signals', { connectionId });
  const ours = signals.filter((s) =>
    SIGNALS.some((spec) => spec.sourceKey === s.sourceKey),
  );
  const counter = ours.find((s) => s.sourceKey === 'EXT1-Throughput');
  const authority = counter?.isAuthority ?? false;
  const ok = ours.length === SIGNALS.length && authority;
  const detail = `${ours.length}/${SIGNALS.length}, counter authoritative: ${authority}`;
  return check('signals', ok, detail, idsOf(ours));
}

async function checkMappingAndJob(
  refs: Refs,
  connectionId: string,
): Promise<Check[]> {
  const mappings = await refs.reader.listAll<
    Identified & { effectiveFrom: string }
  >('/v2/unit-state-mappings', { unitId: refs.unitId ?? '' });
  const dayStart = Date.parse(TIMES.dayStart);
  const mapping = mappings.find((m) => Date.parse(m.effectiveFrom) <= dayStart);
  const jobs = await refs.reader.listAll<Versioned>('/v2/ingestion-jobs', {
    connectionId,
  });
  const running = jobs.some((j) => j.state === 'running');
  const states = jobs.map((j) => j.state).join(',') || 'no job';
  return [
    check(
      'unit state mapping',
      Boolean(mapping),
      mapping ? `from ${mapping.effectiveFrom}` : 'none in force at day start',
      mapping ? [mapping.id] : [],
    ),
    check('subscription running', running, states, idsOf(jobs)),
  ];
}

export async function checkIntegration(refs: Refs): Promise<Check[]> {
  const connections = await refs.reader.listAll<
    Identified & { displayName: string; isActive: boolean }
  >('/v2/connections', { sourceType: 'mqtt' });
  const connection = connections.find((c) => c.displayName === CONNECTION_NAME);
  if (!connection) return [check('mqtt connection', false, 'missing')];
  const active = connection.isActive;
  return [
    check('mqtt connection', active, active ? 'active' : 'inactive', [
      connection.id,
    ]),
    await checkSignals(refs, connection.id),
    ...(await checkMappingAndJob(refs, connection.id)),
  ];
}

export async function checkAuthority(refs: Refs): Promise<Check[]> {
  const versions = await refs.reader.listAll<
    Identified & {
      effectiveFrom: string;
      effectiveTo: string | null;
      policy: { primarySource?: string };
    }
  >('/v2/source-authority/versions', {
    unitId: refs.unitId ?? '',
    state: 'approved',
  });
  const inForce = versions.find((v) =>
    covers(v.effectiveFrom, v.effectiveTo, AUTHORITY_PROBE),
  );
  const ok = inForce?.policy.primarySource === 'mqtt';
  const detail = inForce
    ? `${inForce.policy.primarySource ?? '?'} from ${inForce.effectiveFrom}`
    : `no unit version at ${AUTHORITY_PROBE}`;
  const area = `source authority at ${AUTHORITY_PROBE}`;
  return [check(area, ok, detail, inForce ? [inForce.id] : [])];
}

async function approvedIds(
  refs: Refs,
  path: string,
  query: Record<string, string> = {},
): Promise<string[]> {
  const rows = await refs.reader.listAll<Versioned>(path, query);
  return idsOf(rows.filter((r) => r.state === 'approved'));
}

async function checkPolicyAndRates(refs: Refs): Promise<Check[]> {
  const policies = await refs.reader.listAll<
    Identified & {
      approved: boolean;
      reportingCurrencies: string[];
      body: { defaultBasis?: string };
    }
  >('/v2/valuation-policies');
  const policy = policies.find(
    (p) => p.approved && p.body.defaultBasis === VALUATION_POLICY.defaultBasis,
  );
  const currencies = policy?.reportingCurrencies.join(',') ?? '';
  const bothCurrencies =
    currencies.includes('USD') && currencies.includes('IRR');
  const rateIds: string[] = [];
  let expected = 0;
  for (const spec of PRODUCTS) {
    const profileId = refs.profiles.get(spec.code) ?? '';
    expected += spec.downgradeDifference ? 2 : 1;
    rateIds.push(
      ...(await approvedIds(refs, '/v2/valuation-rates', { profileId })),
    );
  }
  return [
    check(
      'valuation policy',
      bothCurrencies,
      policy ? `approved, ${currencies}` : 'none approved',
      policy ? [policy.id] : [],
    ),
    check(
      'valuation rates',
      rateIds.length >= expected,
      `${rateIds.length}/${expected} approved`,
      rateIds,
    ),
  ];
}

async function checkFxAndDemand(refs: Refs): Promise<Check[]> {
  const { fromCurrency, toCurrency } = FX_RATE;
  const fx = await refs.reader.listAll<Versioned & { rate: string }>(
    '/v2/fx-rates',
    { fromCurrency, toCurrency },
  );
  const rate = fx.find(
    (r) => r.state === 'approved' && Number(r.rate) === Number(FX_RATE.rate),
  );
  const productId = refs.products.get('HD5502') ?? '';
  const demand = await approvedIds(refs, '/v2/demand-statuses', { productId });
  return [
    check(
      'fx USD→IRR 600000',
      Boolean(rate),
      rate ? 'approved' : 'missing',
      rate ? [rate.id] : [],
    ),
    check(
      'demand HD5502',
      demand.length > 0,
      demand.length ? 'sold out, approved' : 'none approved',
      demand,
    ),
  ];
}

export async function checkFinance(refs: Refs): Promise<Check[]> {
  return [
    ...(await checkPolicyAndRates(refs)),
    ...(await checkFxAndDemand(refs)),
  ];
}

export async function checkPlan(refs: Refs): Promise<Check[]> {
  const plans = await refs.reader.listAll<
    Identified & {
      name: string;
      version: { version: number; approvalState: string };
    }
  >('/v2/production-plans', { unitId: refs.unitId ?? '' });
  const plan = plans.find((p) => p.name === PLAN.name);
  if (!plan) return [check('production plan', false, 'missing')];
  const { version, approvalState } = plan.version;
  const periods = await refs.reader.listAll<{
    id: string | null;
    target: string;
  }>(`/v2/production-plans/${plan.id}/versions/${version}/periods`);
  const targets = periods.map((p) => Number(p.target));
  const total = targets.reduce((sum, t) => sum + t, 0);
  const shiftsOk =
    periods.length === PLAN.shifts &&
    targets.every((t) => t === PLAN.shiftTarget);
  const periodsOk = shiftsOk && total === Number(PLAN.headerTarget);
  const detail = `${periods.length} × [${targets.join(', ')}] t = ${total} t`;
  return [
    check(
      'production plan',
      approvalState === 'approved',
      `v${version} ${approvalState}`,
      [plan.id],
    ),
    check(
      'plan periods',
      periodsOk,
      detail,
      periods.map((p) => p.id ?? ''),
    ),
  ];
}
