import { bearer } from './support/test-app';
import {
  ErrorBody,
  EventBody,
  hoursAgo,
  json,
  RuleBody,
  RulesWorld,
  SimulationBody,
  T22,
} from './support/rules-world';

/**
 * Plan 3.8 T22: declarative rules are JSON validated against the allowlisted grammar, stored as
 * immutable versions, activated by a second person, applied by the server on event create, and give the
 * same result after a restart; simulation, rollback, tenant-wide grant, roles, isolation, and the code
 * impact reads (references, mapping preview).
 */
describe('declarative admin rules (plan 3.8, T22)', () => {
  const env = new RulesWorld();
  let rule: RuleBody;

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  const tokens = () => env.tokens;
  const window = () => ({
    from: hoursAgo(48),
    to: hoursAgo(-1),
    unitIds: [env.world.unitA2],
  });

  it('refuses non-allowlisted fields and operators, function strings and wrong kinds with 422 fieldErrors', async () => {
    const definition = {
      when: { all: [{ field: 'constructor', op: 'eval', value: 'x' }] },
      then: T22.then,
    };
    const bad = await env
      .post('rules', { kind: 'coding_default', name: 'bad', definition })
      .expect(422);
    expect(json<ErrorBody>(bad).code).toBe('RULE_INVALID');
    expect(
      json<ErrorBody>(bad).fieldErrors?.map((error) => error.field),
    ).toEqual(
      expect.arrayContaining([
        'definition.when.all.0.field',
        'definition.when.all.0.op',
      ]),
    );
    const fn = await env
      .post('rules', {
        kind: 'coding_default',
        name: 'fn',
        definition: { ...T22, condition: 'return true' },
      })
      .expect(422);
    expect(json<ErrorBody>(fn).code).toBe('RULE_INVALID');
    const check = await env
      .post(
        'rules/validate',
        { kind: 'status_derivation', definition: T22 },
        tokens().viewer,
      )
      .expect(200);
    expect(check.body).toMatchObject({
      valid: false,
      fieldErrors: [{ field: 'definition.then.0.set' }],
    });
    const foreign = {
      when: { all: [{ field: 'unitId', op: 'eq', value: env.world.unitB1 }] },
      then: T22.then,
    };
    const reference = await env
      .post('rules', {
        kind: 'coding_default',
        name: 'foreign',
        definition: foreign,
      })
      .expect(422);
    expect(json<ErrorBody>(reference)).toMatchObject({
      code: 'INVALID_REFERENCE',
      fieldErrors: [{ field: 'definition.when.all.0.value' }],
    });
  });

  it('needs an author role, a tenant-wide grant and a writer role', async () => {
    const body = {
      kind: 'coding_default',
      name: 'roles',
      definition: env.t22Definition(),
    };
    await env.post('rules', body, tokens().analyst).expect(403);
    expect(
      json<ErrorBody>(
        await env.post('rules', body, tokens().unitApprover).expect(403),
      ).code,
    ).toBe('TENANT_SCOPE_REQUIRED');
    expect(
      json<ErrorBody>(
        await env.post('rules', body, tokens().viewer).expect(403),
      ).code,
    ).toBe('FORBIDDEN_ROLE');
    const code = await env
      .post(
        'reason-codes',
        { code: 'UNIT-ONLY', name: 'x' },
        tokens().unitApprover,
      )
      .expect(403);
    expect(json<ErrorBody>(code).code).toBe('TENANT_SCOPE_REQUIRED');
  });

  it('T22: saves the rule as JSON, the author cannot activate it, a second approver can', async () => {
    const created = await env
      .post('rules', {
        kind: 'coding_default',
        name: 'Long downtime is unplanned',
        definition: env.t22Definition(),
      })
      .expect(201);
    rule = json<RuleBody>(created);
    expect(rule).toMatchObject({
      state: 'draft',
      activeVersion: null,
      draft: { authorId: env.ids.author },
    });
    const [stored] = await env.harness.dataSource.query<
      Array<{ definition: unknown; text: string }>
    >(
      `SELECT draft_definition AS definition, draft_definition::text AS text FROM rules WHERE id = $1`,
      [rule.id],
    );
    expect(stored.definition).toEqual(env.t22Definition());
    expect(stored.text).not.toMatch(/function|=>|return/);
    const own = await env
      .post(`rules/${rule.id}/activate`, {}, tokens().author, rule.rowVersion)
      .expect(403);
    expect(json<ErrorBody>(own).code).toBe('SEPARATION_OF_DUTIES');
    await env
      .post(`rules/${rule.id}/activate`, {}, tokens().approver)
      .expect(428);
    await env
      .post(
        `rules/${rule.id}/activate`,
        {},
        tokens().approver,
        rule.rowVersion + 5,
      )
      .expect(412);
    rule = json<RuleBody>(
      await env
        .post(
          `rules/${rule.id}/activate`,
          { reason: 'T22' },
          tokens().approver,
          rule.rowVersion,
        )
        .expect(200),
    );
    expect(rule).toMatchObject({
      state: 'active',
      activeVersion: 1,
      draft: null,
      activeDefinition: env.t22Definition(),
    });
  });

  it('T22: applies the active version on event create with its rule version as the basis', async () => {
    const long = json<EventBody>(await env.createEvent(30, 2));
    expect(long.classification.scheduleClass).toBe('unplanned');
    expect(long.classificationBasis?.scheduleClass).toMatchObject({
      source: 'declarative_rule',
      ruleId: rule.id,
      ruleVersion: 1,
    });
    expect(
      json<EventBody>(await env.createEvent(26, 0.5)).classification
        .scheduleClass,
    ).toBe('unknown');
    const explicit = await env
      .post('production-events', {
        unitId: env.world.unitA2,
        eventType: 'ProductionLoss',
        scheduleClass: 'planned',
        startTime: hoursAgo(24),
        endTime: hoursAgo(20),
      })
      .expect(201);
    expect(json<EventBody>(explicit).classification.scheduleClass).toBe(
      'planned',
    );
  });

  it('T22: after a restart the replayed fixture gives identical classifications and simulation', async () => {
    const before = json<SimulationBody>(
      await env.post(`rules/${rule.id}/simulate`, window()).expect(200),
    );
    await env.restart();
    const after = json<SimulationBody>(
      await env.post(`rules/${rule.id}/simulate`, window()).expect(200),
    );
    expect(after).toMatchObject({
      evaluated: before.evaluated,
      matched: before.matched,
      changed: before.changed,
      version: 1,
    });
    expect(after.fields).toEqual(before.fields);
    // the long event (already unplanned) and the explicit 4 h one (planned → would change)
    expect(before).toMatchObject({ matched: 2, changed: 1 });
    const replay = json<EventBody>(await env.createEvent(18, 2));
    expect(replay.classification.scheduleClass).toBe('unplanned');
    expect(replay.classificationBasis?.scheduleClass).toMatchObject({
      ruleVersion: 1,
    });
  });

  it('simulates a draft with before/after counts and sample diffs; activate increments; rollback restores', async () => {
    const draft = {
      ...env.t22Definition(),
      then: [{ set: 'scheduleClass', value: 'external' }],
    };
    const changed = await env
      .http()
      .put(`/api/v2/rules/${rule.id}`)
      .set(bearer(tokens().author))
      .set('If-Match', `"${rule.rowVersion}"`)
      .send({ definition: draft })
      .expect(200);
    rule = json<RuleBody>(changed);
    expect(rule).toMatchObject({
      activeVersion: 1,
      draft: { definition: draft },
    });
    const simulated = json<SimulationBody>(
      await env.post(`rules/${rule.id}/simulate`, window()).expect(200),
    );
    expect(simulated.version).toBeNull();
    expect(simulated.fields.scheduleClass.after.external).toBe(
      simulated.matched,
    );
    expect(simulated.samples[0].changes[0]).toMatchObject({
      field: 'scheduleClass',
      after: 'external',
    });
    rule = json<RuleBody>(
      await env
        .post(
          `rules/${rule.id}/activate`,
          {},
          tokens().approver,
          rule.rowVersion,
        )
        .expect(200),
    );
    expect(rule.activeVersion).toBe(2);
    expect(
      json<EventBody>(await env.createEvent(14, 2)).classification
        .scheduleClass,
    ).toBe('external');
    rule = json<RuleBody>(
      await env
        .post(
          `rules/${rule.id}/rollback`,
          { toVersion: 1 },
          tokens().approver,
          rule.rowVersion,
        )
        .expect(200),
    );
    expect(rule).toMatchObject({
      activeVersion: 3,
      activeDefinition: env.t22Definition(),
    });
    expect(
      json<EventBody>(await env.createEvent(10, 2)).classification
        .scheduleClass,
    ).toBe('unplanned');
    const history = json<
      Array<{
        version: number;
        origin: string;
        restoredVersion: number | null;
        current: boolean;
      }>
    >(await env.get(`rules/${rule.id}/versions`).expect(200));
    expect(
      history.map((row) => [
        row.version,
        row.origin,
        row.restoredVersion,
        row.current,
      ]),
    ).toEqual([
      [3, 'rollback', 1, true],
      [2, 'activation', null, false],
      [1, 'activation', null, false],
    ]);
    const current = await env
      .post(
        `rules/${rule.id}/rollback`,
        { toVersion: 3 },
        tokens().approver,
        rule.rowVersion,
      )
      .expect(409);
    expect(json<ErrorBody>(current).code).toBe('INVALID_TRANSITION');
  });

  it('retired rules stop applying; other tenants never see the rule', async () => {
    await env.get(`rules/${rule.id}`, tokens().adminB).expect(404);
    const listB = await env.get('rules', tokens().adminB).expect(200);
    expect((listB.body as { items: unknown[] }).items).toHaveLength(0);
    rule = json<RuleBody>(
      await env
        .post(`rules/${rule.id}/retire`, {}, tokens().approver, rule.rowVersion)
        .expect(200),
    );
    expect(rule.state).toBe('retired');
    expect(
      json<EventBody>(await env.createEvent(6, 2)).classification.scheduleClass,
    ).toBe('unknown');
    const listA = await env.get('rules?state=retired').expect(200);
    expect(
      (listA.body as { items: RuleBody[] }).items.map((item) => item.id),
    ).toEqual([rule.id]);
  });

  it('serves the grammar allowlist and code impact reads (references, mapping preview)', async () => {
    const schema = await env.get('rules/schema', tokens().viewer).expect(200);
    expect(
      (schema.body as { fields: Array<{ name: string }> }).fields.map(
        (field) => field.name,
      ),
    ).toContain('durationSeconds');
    const references = await env
      .get(`reason-codes/${env.world.reasonR1}/references`)
      .expect(200);
    expect(references.body).toMatchObject({
      activeChildren: 0,
      mappingRules: 0,
    });
    expect((references.body as { events: number }).events).toBeGreaterThan(0);
    const fresh = json<{ id: string }>(
      await env
        .post('reason-codes', {
          code: 'RULES-PREVIEW',
          name: 'Preview',
          defaultScheduleClass: 'planned',
        })
        .expect(201),
    );
    await env
      .post('production-events', {
        unitId: env.world.unitA1,
        eventType: 'ProductionLoss',
        reasonCodeId: fresh.id,
        scheduleClass: 'unplanned',
        startTime: hoursAgo(5),
        endTime: hoursAgo(4),
      })
      .expect(201);
    const preview = await env
      .get(`reason-codes/${fresh.id}/mapping-preview?days=7`)
      .expect(200);
    expect(preview.body).toMatchObject({
      codeId: fresh.id,
      events: 1,
      proposed: { scheduleClass: { value: 'planned', source: 'code_default' } },
      current: { scheduleClass: { unplanned: 1 } },
      wouldDiffer: { scheduleClass: 1 },
    });
    await env
      .get(`reason-codes/${env.world.reasonR1}/references`, tokens().adminB)
      .expect(404);
  });

  it('a unit-limited caller simulates only its own units', async () => {
    const ruleView = await env
      .post('rules', {
        kind: 'validation',
        name: 'Flag long stops',
        definition: {
          when: { all: [{ field: 'durationSeconds', op: 'gte', value: 60 }] },
          then: [{ flag: 'long_stop' }],
        },
      })
      .expect(201);
    const id = json<RuleBody>(ruleView).id;
    const foreignUnit = await env
      .post(`rules/${id}/simulate`, {
        from: hoursAgo(48),
        to: hoursAgo(-1),
        unitIds: [env.world.unitB1],
      })
      .expect(422);
    expect(json<ErrorBody>(foreignUnit).code).toBe('INVALID_REFERENCE');
    const all = json<SimulationBody>(
      await env
        .post(`rules/${id}/simulate`, { from: hoursAgo(48), to: hoursAgo(-1) })
        .expect(200),
    );
    const own = json<SimulationBody>(
      await env
        .post(
          `rules/${id}/simulate`,
          { from: hoursAgo(48), to: hoursAgo(-1) },
          env.tokens.unitApprover,
        )
        .expect(200),
    );
    expect(all.evaluated).toBeGreaterThan(own.evaluated);
    expect(
      own.samples.every((sample) => sample.unitId === env.world.unitA1),
    ).toBe(true);
  });
});
