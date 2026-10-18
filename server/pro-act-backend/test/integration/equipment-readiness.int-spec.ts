import { SampleStore } from '../../src/signals/sample-store';
import { randomUUID } from 'crypto';
import { ActualsWorld, A, MINUTE, SignalSpec } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { EquipmentReadinessView } from '../../src/v2/equipment-setup/readiness-v2.view';
import { OEE_POLICY_DEFAULT } from '../../src/periods/engine-policy-bodies';
import { SOURCE_AUTHORITY_DEFAULT } from '../../src/periods/policy-bodies';
import { VALUATION_POLICY_V3_BODY } from '../../src/domain/valuation/valuation-policy';
import { ReadinessStore } from '../../src/v2/equipment-setup/readiness-store';
import { ProductionProfile } from '../../src/profiles/entities/production-profile.entity';
import { ReadinessProfilesService } from '../../src/v2/equipment-setup/readiness-profiles.service';
import { anonymousContext } from '../../src/common/context/request-context';

/** Only proact_test: actual scoped SQL, approvals and stored telemetry; no broker or live-plant writes. */
describe('equipment setup automatic readiness', () => {
  const env = new ActualsWorld();
  const to = plus(A, 5 * MINUTE);
  let stateId: string, outputId: string;
  const query = (extra: Record<string, string> = {}) =>
    new URLSearchParams({
      unitId: env.world.unitA1,
      productId: env.products.p1,
      from: A,
      to,
      connectionId: env.connections.mqtt,
      ...extra,
    }).toString();
  const read = async (extra: Record<string, string> = {}, token = env.admin) =>
    (
      await env
        .get(`equipment-setup/readiness?${query(extra)}`, token)
        .expect(200)
    ).body as EquipmentReadinessView;
  const item = (snapshot: EquipmentReadinessView, id: string) =>
    snapshot.checks.find((row) => row.id === id)!;
  const policy = async (kind: string, body: object, approved = true) =>
    env.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, scope_key, version, body, effective_from, approved_at) VALUES ($1, 1, $2, 'tenant', (SELECT coalesce(max(version), 0) + 1 FROM accounting_policies WHERE tenant_id = $1 AND policy_kind = $2), $3, $4, $5)`,
      [env.world.tenantA, kind, body, A, approved ? new Date(A) : null],
    );
  beforeAll(async () => {
    await env.start();
    // The fixture setup may resolve defaults elsewhere; readiness itself must never seed missing policies.
    await env.rows('DELETE FROM accounting_policies WHERE tenant_id = $1', [
      env.world.tenantA,
    ]);
  });
  afterAll(() => env.stop());
  it('detects missing records while resolving existing published/approved production configuration', async () => {
    const snapshot = await read();
    expect(item(snapshot, 'profile').status).toBe('ready');
    expect(item(snapshot, 'planning_rate').status).toBe('ready');
    expect(item(snapshot, 'sustained_rate').status).toBe('ready');
    expect(item(snapshot, 'calendar').status).toBe('ready');
    expect(item(snapshot, 'stop_policy').status).toBe('missing');
    expect(item(snapshot, 'authority').status).toBe('missing');
    expect(item(snapshot, 'state_coverage').status).toBe('missing');
    expect(item(snapshot, 'events').status).toBe('not_checked');
    expect(
      await env.rows(
        'SELECT id FROM accounting_policies WHERE tenant_id = $1',
        [env.world.tenantA],
      ),
    ).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('endpointConfig');
  });
  it('rejects foreign ids and other units even when a caller can read its own unit', async () => {
    await env
      .get(`equipment-setup/readiness?${query()}`, env.adminB)
      .expect(404);
    await env
      .get(`equipment-setup/readiness?${query({ productId: env.products.pB })}`)
      .expect(404);
    await env
      .get(`equipment-setup/readiness?${query({ connectionId: randomUUID() })}`)
      .expect(404);
    const token = await env.unitUser(env.world.unitA1, 'viewer');
    await env.get(`equipment-setup/readiness?${query()}`, token).expect(200);
    await env
      .get(
        `equipment-setup/readiness?${query({ unitId: env.world.unitA2 })}`,
        token,
      )
      .expect(404);
    await env
      .get(`equipment-setup/readiness?${query({ planId: randomUUID() })}`)
      .expect(404);
    await env
      .get(`equipment-setup/readiness?${query({ periodId: randomUUID() })}`)
      .expect(404);
  });
  it('validates its contract and refuses arbitrary or unbounded windows', async () => {
    await env
      .get(`equipment-setup/readiness?${query({ unitId: 'bad-id' })}`)
      .expect(422);
    await env.get(`equipment-setup/readiness?${query({ to: A })}`).expect(422);
    await env
      .get(
        `equipment-setup/readiness?${query({ to: plus(A, 32 * 86_400_000) })}`,
      )
      .expect(422);
    await env
      .get(
        `equipment-setup/readiness?${query({ tenantId: env.world.tenantA })}`,
      )
      .expect(400);
  });
  it('does not accept a draft MQTT priority as approval', async () => {
    await policy(
      'source_authority',
      { ...SOURCE_AUTHORITY_DEFAULT, primarySource: 'mqtt', fallback: null },
      false,
    );
    await policy('oee_policy', OEE_POLICY_DEFAULT);
    const snapshot = await read();
    expect(item(snapshot, 'authority').status).toBe('needs_attention');
    expect(item(snapshot, 'stop_policy').status).toBe('ready');
    await env.rows(
      "UPDATE accounting_policies SET approved_at = $2 WHERE tenant_id = $1 AND policy_kind = 'source_authority'",
      [env.world.tenantA, A],
    );
  });
  it('quantifies stored output and state with the real engines, without saving any observations or calculations', async () => {
    stateId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'state',
      connection: 'mqtt',
      from: A,
      to: plus(A, 86_400_000),
    } as unknown as SignalSpec);
    outputId = await env.signal({
      unitId: env.world.unitA1,
      semanticType: 'rate',
      connection: 'mqtt',
      from: A,
      to: plus(A, 86_400_000),
      productId: env.products.p1,
      maxGapSeconds: 120,
      isAuthority: true,
    });
    await env
      .post('unit-state-mappings', {
        unitId: env.world.unitA1,
        signalId: stateId,
        rules: [{ match: '1', state: 'running' }],
        expectedIntervalSeconds: 60,
        staleAfterIntervals: 3,
        isHeartbeat: true,
        effectiveFrom: A,
      })
      .expect(201);
    await env.samples(stateId, A, [
      [0, '1'],
      [1, '1'],
      [2, '1'],
      [3, '1'],
      [4, '1'],
    ]);
    await env.samples(outputId, A, [
      [0, '90'],
      [1, '90'],
      [2, '90'],
      [3, '90'],
      [4, '90'],
      [5, '90'],
    ]);
    const before = await env.rows<{ count: number }>(
      'SELECT count(*)::int AS count FROM measurement_samples WHERE tenant_id = $1',
      [env.world.tenantA],
    );
    const snapshot = await read();
    expect(item(snapshot, 'authority').status).toBe('ready');
    expect(item(snapshot, 'signals').status).toBe('ready');
    expect(item(snapshot, 'state_mapping').coverage).toBe(1);
    expect(item(snapshot, 'state_coverage')).toMatchObject({
      status: 'ready',
      coverage: 1,
    });
    expect(item(snapshot, 'output_coverage')).toMatchObject({
      status: 'ready',
      coverage: 1,
    });
    expect(
      await env.rows(
        'SELECT count(*)::int AS count FROM measurement_samples WHERE tenant_id = $1',
        [env.world.tenantA],
      ),
    ).toEqual(before);
    expect(
      await env.rows('SELECT id FROM calculation_runs WHERE tenant_id = $1', [
        env.world.tenantA,
      ]),
    ).toEqual([]);
  });
  it('surfaces bad-quality data and heartbeat staleness instead of inventing complete telemetry', async () => {
    await env.app.get(SampleStore).insertSample({
      tenantId: env.world.tenantA,
      signalId: outputId,
      observedAt: new Date(plus(A, 2 * MINUTE)),
      value: '90',
      stateName: null,
      stateValue: null,
      quality: 'bad',
      qualityFlags: null,
      rawId: randomUUID(),
      rawReceivedAt: new Date(),
      sourceRevision: '2',
    });
    const bad = await read();
    expect(item(bad, 'output_coverage').status).toBe('needs_attention');
    expect(item(bad, 'output_coverage').coverage).toBeLessThan(1);
    const stale = await read({ to: plus(A, 10 * MINUTE) });
    expect(item(stale, 'state_coverage').status).toBe('needs_attention');
    expect(item(stale, 'state_coverage').coverage).toBeLessThan(1);
  });
  it('requires margin approval and matching FX coverage; same-currency conversions need no FX row', async () => {
    await policy('valuation_basis', {
      ...VALUATION_POLICY_V3_BODY,
      reportingCurrencies: ['USD'],
    });
    const profileId = env.profiles.get(
      `${env.world.unitA1}:${env.products.p1}`,
    )!;
    await env.rows(
      "INSERT INTO valuation_rates (tenant_id, row_version, profile_id, basis, value, currency, per_uom, effective_from, version, state) VALUES ($1, 1, $2, 'contribution_margin', 100, 'USD', 't', $3, 1, 'draft')",
      [env.world.tenantA, profileId, A],
    );
    const pending = await read();
    expect(item(pending, 'margin').status).toBe('needs_attention');
    await env.rows(
      "UPDATE valuation_rates SET state = 'approved', approved_at = now() WHERE profile_id = $1",
      [profileId],
    );
    const approved = await read();
    expect(item(approved, 'margin').status).toBe('ready');
    expect(item(approved, 'fx').status).toBe('ready');
    await policy('valuation_basis', VALUATION_POLICY_V3_BODY);
    expect(item(await read(), 'fx').status).toBe('needs_attention');
    await env.rows(
      "INSERT INTO fx_rates (tenant_id, row_version, rate_type, from_currency, to_currency, rate, effective_from, version, state, approved_at) VALUES ($1, 1, 'economic', 'USD', 'IRR', 600000, $2, 1, 'approved', now())",
      [env.world.tenantA, A],
    );
    expect(item(await read(), 'fx').status).toBe('ready');
  });
  it('checks the remembered plan and period for the selected unit and product without approving them', async () => {
    const plan = await env.approvedPlan(env.world.unitA1);
    expect(item(await read({ planId: plan.id }), 'plan').status).toBe('ready');
    expect(
      item(await read({ planId: plan.id, productId: env.products.p2 }), 'plan')
        .status,
    ).toBe('needs_attention');
    await env.materialize([env.world.unitA1], A, to);
    const periodId = await env.periodId(env.world.unitA1, A);
    const result = await read({ planId: plan.id, periodId });
    expect(item(result, 'period').status).toBe('needs_attention');
    expect(item(result, 'day').status).toBe('needs_attention');
    const other = await env.createPlan({ unitId: env.world.unitA2 });
    await env
      .get(`equipment-setup/readiness?${query({ planId: other.id })}`)
      .expect(404);
  });
  it('reports rate gaps and bounds every version lookup without loading the plant catalog', async () => {
    const profileId = env.profiles.get(
      `${env.world.unitA1}:${env.products.p1}`,
    )!;
    await env.rows(
      "UPDATE unit_product_rates SET effective_to = $2 WHERE profile_id = $1 AND rate_kind = 'planning'",
      [profileId, plus(A, 2 * MINUTE)],
    );
    expect(item(await read(), 'planning_rate')).toMatchObject({
      status: 'needs_attention',
      coverage: 0.4,
    });
    const context = {
      ...anonymousContext('test'),
      tenantId: env.world.tenantA,
      isSuperAdmin: true,
    };
    const builder = env.app
      .get(ReadinessStore)
      .query(ProductionProfile, context, 'unitId')
      .andWhere('r.unitId = :unitId', { unitId: env.world.unitA1 });
    expect(builder.getSql()).toContain('tenant_id');
    const explain = await env.rows<{ 'QUERY PLAN': string }>(
      `EXPLAIN ${builder.take(501).getQueryAndParameters()[0]}`,
      builder.take(501).getQueryAndParameters()[1],
    );
    expect(explain.map((row) => row['QUERY PLAN']).join(' ')).toContain(
      'Limit',
    );
    expect(env.app.get(ReadinessProfilesService)).toBeDefined();
  });
});
