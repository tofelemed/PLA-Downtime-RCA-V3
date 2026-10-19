import { A, B, C, HOUR, NEXT_DAY } from './support/actuals-world';
import { AccountingWorld, plus } from './support/accounting-world';
import { DAY1 } from './support/plan-world';

interface Aggregate {
  metric: string;
  numerator: string | null;
  denominator: string | null;
  value: string | null;
  reason: string | null;
}

interface Coverage {
  periodsWithStateData: number;
  scheduledSeconds: string | null;
  knownSeconds: string | null;
  unknownSeconds: string | null;
  ratio: string | null;
  periodsWithoutPlan: number;
}

interface BundleBody {
  data: { summary: Aggregate[]; dataCoverage: Coverage };
}

interface ReliabilityBody {
  data: {
    units: Array<{ exposureSeconds: string | null }>;
    dataCoverage: Coverage;
  };
}

/**
 * Owner decision 2026-10-19 "Unknown time is never available time" on real Postgres: unit A3, 1 Mar 2027,
 * a 1 h stop in shift A. Shift A's state is fully known; shifts B and C have no state data (their whole
 * scheduled time unknown, as written by the state engine). The window's availability, onstream factor and
 * MTBF exposure leave B and C out; the response states the data coverage. Test data only.
 */
describe('Downtime KPIs leave unknown state time out (owner decision 2026-10-19)', () => {
  const env = new AccountingWorld();
  const window = (from: string, to: string) =>
    `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&unitIds=${env.world.unitA3}`;
  const bundle = async (from: string, to: string) =>
    (
      await env
        .get(`reports/downtime-bundle?${window(from, to)}&views=day`)
        .expect(200)
    ).body as BundleBody;
  const metric = (body: BundleBody, name: string) =>
    body.data.summary.find((s) => s.metric === name);
  const stored = { numerator: '0', denominator: '0' };

  /** The shown run's stored terms of a period KPI (read back to compare, never recomputed here). */
  async function storedTerms(start: string, name: string) {
    const [row] = await env.rows<{ numerator: string; denominator: string }>(
      `SELECT k.numerator::text, k.denominator::text FROM kpi_results k
         JOIN production_periods p ON p.id = k.period_id
        WHERE p.unit_id = $1 AND p.utc_start = $2 AND k.metric = $3 AND k.scope->>'level' = 'period'
        ORDER BY k.created_at DESC LIMIT 1`,
      [env.world.unitA3, start, name],
    );
    return row;
  }

  /** A `state_coverage` row as the state engine writes it: known / scheduled, unknown in the cohort. */
  async function coverageRow(start: string, unknownSeconds: number) {
    const [run] = await env.rows<{
      run_id: string;
      period_id: string;
      scheduled: string;
    }>(
      `SELECT k.run_id, k.period_id, k.denominator::text AS scheduled FROM kpi_results k
         JOIN production_periods p ON p.id = k.period_id
        WHERE p.unit_id = $1 AND p.utc_start = $2 AND k.metric = 'scheduled_availability'
          AND k.scope->>'level' = 'period'
        ORDER BY k.created_at DESC LIMIT 1`,
      [env.world.unitA3, start],
    );
    const scheduled = Number(run.scheduled);
    const known = scheduled - unknownSeconds;
    await env.rows(
      `INSERT INTO kpi_results (tenant_id, row_version, run_id, period_id, scope, metric, numerator, denominator,
                                value, unit, quality, reason, cohort, as_of)
       VALUES ($1, 1, $2, $3, '{"level":"period"}', 'state_coverage', $4, $5, $6, 'ratio',
               $7, $8, $9, now())`,
      [
        env.world.tenantA,
        run.run_id,
        run.period_id,
        known,
        scheduled,
        known / scheduled,
        unknownSeconds > 0 ? 'provisional' : 'ok',
        unknownSeconds > 0 ? 'unknown_time' : null,
        JSON.stringify({ unknownSeconds, knownStoppedSeconds: 3600 }),
      ],
    );
  }

  beforeAll(async () => {
    await env.start();
    const unit = env.world.unitA3;
    await env.materialize([unit], DAY1, NEXT_DAY);
    await env.lossEvent(unit, plus(A, HOUR), 1, { scheduleClass: 'unplanned' });
    await env.settle();
    Object.assign(stored, await storedTerms(A, 'scheduled_availability'));
    await coverageRow(A, 0);
    for (const start of [B, C]) {
      const terms = await storedTerms(start, 'scheduled_availability');
      await coverageRow(start, Number(terms.denominator));
    }
  });
  afterAll(() => env.stop());

  it('the day availability equals the known shift: unknown time is neither scheduled nor available', async () => {
    const day = await bundle(DAY1, NEXT_DAY);
    const availability = metric(day, 'scheduled_availability');
    expect(Number(availability?.numerator)).toBe(Number(stored.numerator));
    expect(Number(availability?.denominator)).toBe(Number(stored.denominator));
    const shiftA = await bundle(A, B);
    expect(metric(day, 'scheduled_availability')?.value).toBe(
      metric(shiftA, 'scheduled_availability')?.value,
    );
    expect(metric(day, 'controllable_availability')?.value).toBe(
      metric(shiftA, 'controllable_availability')?.value,
    );
    // stop time is never touched
    expect(metric(day, 'downtime_total')?.value).toBe('3600');
  });

  it('states the data coverage of the window', async () => {
    const day = await bundle(DAY1, NEXT_DAY);
    const scheduled = Number(day.data.dataCoverage.scheduledSeconds);
    expect(day.data.dataCoverage.periodsWithStateData).toBe(3);
    expect(Number(day.data.dataCoverage.knownSeconds)).toBe(
      Number(stored.denominator),
    );
    expect(Number(day.data.dataCoverage.unknownSeconds)).toBe(
      scheduled - Number(stored.denominator),
    );
    expect(Number(day.data.dataCoverage.ratio)).toBeCloseTo(
      Number(stored.denominator) / scheduled,
      8,
    );
    expect(typeof day.data.dataCoverage.periodsWithoutPlan).toBe('number');
  });

  it('a window of unknown time only has no availability (no known time), never 0 %', async () => {
    const shiftC = await bundle(C, NEXT_DAY);
    expect(metric(shiftC, 'scheduled_availability')).toMatchObject({
      value: null,
      reason: 'no_known_time',
    });
    expect(shiftC.data.dataCoverage.ratio).toBe('0');
  });

  it('MTBF exposure leaves the unknown time out', async () => {
    const body = (
      await env.get(`reports/reliability?${window(DAY1, NEXT_DAY)}`).expect(200)
    ).body as ReliabilityBody;
    const exposureA = await storedTerms(A, 'mtbf');
    expect(Number(body.data.units[0].exposureSeconds)).toBe(
      Number(exposureA.numerator),
    );
    expect(body.data.dataCoverage.periodsWithStateData).toBe(3);
  });
});
