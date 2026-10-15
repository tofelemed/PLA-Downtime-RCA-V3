import { randomUUID } from 'crypto';
import { A, ActualsWorld, SliceActualsBody } from './support/actuals-world';
import { ApiError, DAY1, DAY3 } from './support/plan-world';

interface BudgetBody {
  id: string;
  state: string;
  boundary: string;
  combinedStandardUncertainty: string;
  expandedUncertainty: string;
  coverageFactor: string;
  effectiveTo: string | null;
  inForce: boolean;
}

interface AdoptedBody {
  version: number;
  tolerance: { mode: string; value: number; uncertaintyBudgetId?: string };
  justification: {
    expandedUncertainty: string;
    valueMatchesExpandedUncertainty: boolean;
  } | null;
}

type Substituted = SliceActualsBody & {
  substitution: {
    used: { rank: number; sourceClass: string };
    replaced: { rank: number; sourceClass: string };
    reason: string;
  } | null;
};

const counter = (from: number): Array<[number, string]> =>
  Array.from({ length: 9 }, (_, i) => [i * 60, String(from + 25 * i)]);

/**
 * SME E7 and E4 on real Postgres. E7: a unit's source authority with a measurement hierarchy — the
 * calibrated totalizer has no readings in the shift, so the redundant meter at the same boundary gives
 * the 200 t with a substitution flag in the period detail; the hierarchy API checks its ranks. E4:
 * uncertainty budgets through `/v2/uncertainty-budgets` (server maths 4.24 t / 8.49 t, maker-checker by
 * the metrology / instrumentation owner, effective-dated succession) and an explicit adoption as the
 * unit's absolute tolerance by production accounting — other units keep the zero default.
 */
describe('measurement-source hierarchy and uncertainty budgets (SME E7, E4)', () => {
  const env = new ActualsWorld();
  let accountant = '';
  let checker = '';
  let adopter = '';
  let integration = '';

  beforeAll(async () => {
    await env.start();
    const { unitA3 } = env.world;
    accountant = await env.unitUser(unitA3, 'production_accountant');
    checker = await env.unitUser(unitA3, 'metrology_approver');
    adopter = await env.unitUser(unitA3, 'production_accountant');
    integration = await env.unitUser(unitA3, 'integration_admin');
    await env.materialize([unitA3], DAY1, DAY3);
  });
  afterAll(() => env.stop());

  const budget = (extra: Record<string, unknown> = {}) => ({
    unitId: env.world.unitA3,
    boundary: 'reactor_outlet',
    uom: 't',
    components: [
      { kind: 'meter', label: 'FT-101 totalizer', standardUncertainty: '3' },
      {
        kind: 'scale',
        label: 'packing scale',
        standardUncertainty: '3',
        sensitivity: '-1',
      },
    ],
    coverageFactor: '2',
    calibrationRef: 'CAL-FT101-2027-01; WS-22 certificate',
    reviewDueAt: '2030-01-01T00:00:00.000Z',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    ...extra,
  });
  const propose = async (
    extra: Record<string, unknown> = {},
    token = accountant,
  ) =>
    (
      await env
        .post('uncertainty-budgets', budget(extra), token)
        .set('Idempotency-Key', randomUUID())
        .expect(201)
    ).body as BudgetBody;
  const decide = (
    id: string,
    action: string,
    token: string,
    body: object = {},
  ) =>
    env
      .post(`uncertainty-budgets/${id}/${action}`, body, token)
      .set('Idempotency-Key', randomUUID());

  it('E7: the redundant meter stands in for the unavailable totalizer, flagged in the period detail', async () => {
    const { unitA3 } = env.world;
    const primary = await env.signal({
      unitId: unitA3,
      semanticType: 'counter',
      from: A,
      to: DAY3,
      isAuthority: true,
    });
    const redundant = await env.signal({
      unitId: unitA3,
      semanticType: 'counter',
      from: A,
      to: DAY3,
    });
    await env.samples(redundant, A, counter(1000));
    const key = (id: string) => `sig-${id.slice(0, 8)}`;
    await env.unitPolicy(unitA3, 'source_authority', {
      measurement: 'output',
      productId: null,
      primarySource: 'pi_counter',
      fallback: null,
      cadenceSeconds: 60,
      conflictTolerance: 0,
      overrideRole: 'integration_admin',
      measurementHierarchy: {
        boundary: 'reactor_outlet',
        conditions: ['primary_missing', 'primary_stale', 'primary_bad_quality'],
        entries: [
          {
            rank: 1,
            sourceClass: 'calibrated_primary',
            source: 'pi_counter',
            signalSourceKey: key(primary),
            boundary: 'reactor_outlet',
            boundaryAdjustment: null,
          },
          {
            rank: 2,
            sourceClass: 'redundant_measurement',
            source: 'pi_counter',
            signalSourceKey: key(redundant),
            boundary: 'reactor_outlet',
            boundaryAdjustment: null,
          },
          {
            rank: 3,
            sourceClass: 'approved_estimate',
            source: 'manual',
            signalSourceKey: null,
            boundary: 'reactor_outlet',
            boundaryAdjustment: null,
          },
        ],
      },
    });
    const detail = await env.recompute(await env.periodId(unitA3, A));
    const actuals = detail.data.slices[0].actuals as Substituted;
    expect(actuals).toMatchObject({
      gross: '200',
      coverageRatio: '1',
      qualityState: 'complete',
    });
    expect(actuals.substitution).toMatchObject({
      used: { rank: 2, sourceClass: 'redundant_measurement' },
      replaced: { rank: 1, sourceClass: 'calibrated_primary' },
      reason: 'primary_missing',
    });
    const runs = await env.rows<{ engine_version: string }>(
      `SELECT engine_version FROM actuals_runs WHERE period_id = $1 ORDER BY computed_at DESC LIMIT 1`,
      [detail.data.id],
    );
    expect(runs[0].engine_version).toBe('2.4.4');
  });

  it('E7: the hierarchy API drafts a version and refuses inconsistent ranks', async () => {
    const hierarchy = (entries: object[]) => ({
      unitId: env.world.unitA3,
      measurementHierarchy: {
        boundary: 'reactor_outlet',
        conditions: ['primary_missing'],
        entries,
      },
    });
    const top = {
      rank: 1,
      sourceClass: 'calibrated_primary',
      source: 'pi_counter',
      signalSourceKey: 'FT-101.TOT',
      boundary: 'reactor_outlet',
    };
    await env
      .post('source-authority/versions', hierarchy([top]), env.analyst)
      .set('Idempotency-Key', randomUUID())
      .expect(403);
    const refused = await env
      .post(
        'source-authority/versions',
        hierarchy([
          top,
          { ...top, rank: 2, sourceClass: 'redundant_measurement' },
        ]),
        integration,
      )
      .set('Idempotency-Key', randomUUID())
      .expect(422);
    expect((refused.body as ApiError).code).toBe('INVALID_POLICY');
    const written = await env
      .post(
        'source-authority/versions',
        hierarchy([
          top,
          {
            ...top,
            rank: 2,
            sourceClass: 'redundant_measurement',
            signalSourceKey: 'FT-102.TOT',
          },
        ]),
        integration,
      )
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    expect(written.body).toMatchObject({
      unitId: env.world.unitA3,
      state: 'proposed',
      inForce: false,
      policy: {
        primarySource: 'pi_counter',
        measurementHierarchy: { boundary: 'reactor_outlet' },
      },
    });
  });

  it('E4: the server computes 4.24 t combined and 8.49 t expanded; preview stores nothing', async () => {
    const preview = await env
      .post(
        'uncertainty-budgets/preview',
        { components: budget().components, coverageFactor: '2' },
        accountant,
      )
      .expect(200);
    expect(preview.body).toMatchObject({
      combinedStandardUncertainty: '4.24264069',
      expandedUncertainty: '8.48528137',
    });
    const bad = await env
      .post(
        'uncertainty-budgets/preview',
        {
          components: budget().components,
          correlations: [{ a: 0, b: 1, coefficient: '1.5' }],
        },
        accountant,
      )
      .expect(422);
    expect((bad.body as ApiError).code).toBe('INVALID_BUDGET');
    const range = await env
      .post(
        'uncertainty-budgets',
        budget({ reviewDueAt: '2025-01-01T00:00:00.000Z' }),
        accountant,
      )
      .set('Idempotency-Key', randomUUID())
      .expect(422);
    expect((range.body as ApiError).code).toBe('INVALID_RANGE');
  });

  it('E4: maker-checker by the metrology owner, then an explicit adoption as the absolute tolerance', async () => {
    const proposed = await propose();
    expect(proposed).toMatchObject({
      state: 'proposed',
      expandedUncertainty: '8.48528137',
      inForce: false,
    });
    const role = await decide(proposed.id, 'approve', env.admin).expect(403);
    expect((role.body as ApiError).code).toBe('FORBIDDEN_ROLE');
    const accounting = await decide(proposed.id, 'approve', adopter).expect(
      403,
    );
    expect((accounting.body as ApiError).code).toBe('FORBIDDEN_ROLE');
    const ownDraft = await propose({}, checker);
    const own = await decide(ownDraft.id, 'approve', checker).expect(403);
    expect((own.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const approved = (await decide(proposed.id, 'approve', checker).expect(200))
      .body as BudgetBody;
    expect(approved).toMatchObject({ state: 'approved', inForce: true });

    const authorAdopts = await decide(
      proposed.id,
      'adopt-as-tolerance',
      accountant,
    ).expect(403);
    expect((authorAdopts.body as ApiError).code).toBe('SEPARATION_OF_DUTIES');
    const metrologyAdopts = await decide(
      proposed.id,
      'adopt-as-tolerance',
      checker,
    ).expect(403);
    expect((metrologyAdopts.body as ApiError).code).toBe('FORBIDDEN_ROLE');
    const adopted = (
      await decide(proposed.id, 'adopt-as-tolerance', adopter).expect(200)
    ).body as AdoptedBody;
    expect(adopted.tolerance).toMatchObject({
      mode: 'absolute',
      value: 8.48528137,
      uncertaintyBudgetId: proposed.id,
    });
    expect(adopted.justification).toMatchObject({
      expandedUncertainty: '8.48528137',
      valueMatchesExpandedUncertainty: true,
    });

    const others = await env.rows<{ n: number }>(
      `SELECT count(*)::int AS n FROM accounting_policies
        WHERE tenant_id = $1 AND policy_kind = 'reconciliation_tolerance' AND body->>'mode' <> 'zero' AND unit_id IS DISTINCT FROM $2`,
      [env.world.tenantA, env.world.unitA3],
    );
    expect(others[0].n).toBe(0);
  });

  it('E4: a later budget of the boundary ends the one in force; foreign tenants do not see budgets', async () => {
    const first = (
      await env
        .get(
          `uncertainty-budgets?unitId=${env.world.unitA3}&state=approved`,
          accountant,
        )
        .expect(200)
    ).body as { items: BudgetBody[] };
    const earlier = first.items[0];
    const next = await propose({
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      components: [
        {
          kind: 'meter',
          label: 'FT-101 recalibrated',
          standardUncertainty: '2',
        },
      ],
    });
    await decide(next.id, 'approve', checker).expect(200);
    const ended = (
      await env.get(`uncertainty-budgets/${earlier.id}`, accountant).expect(200)
    ).body as BudgetBody;
    expect(ended).toMatchObject({
      effectiveTo: '2026-06-01T00:00:00.000Z',
      inForce: false,
    });
    const backdated = await propose({
      effectiveFrom: '2026-03-01T00:00:00.000Z',
    });
    const refused = await decide(backdated.id, 'approve', checker).expect(422);
    expect((refused.body as ApiError).code).toBe('INVALID_EFFECTIVE_FROM');
    await env.get(`uncertainty-budgets/${next.id}`, env.adminB).expect(404);
  });
});
