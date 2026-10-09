import { randomUUID } from 'crypto';
import { CalendarMaterializerService } from '../../../src/calendar/calendar-materializer.service';
import { SitesService } from '../../../src/calendar/sites.service';
import { OutboxRelayService } from '../../../src/common/outbox/outbox-relay.service';
import { ActualsJobsService } from '../../../src/periods/actuals-jobs.service';
import { SampleStore } from '../../../src/signals/sample-store';
import { DAY1, PlanBody, PlanWorld } from './plan-world';
import { signToken } from './test-app';

export const HOUR = 3_600_000;
export const MINUTE = 60_000;

/** Shift A / B / C of 1 Mar 2027 (Asia/Tehran, 06:00 / 14:00 / 22:00 local). */
export const A = '2027-03-01T02:30:00.000Z';
export const B = '2027-03-01T10:30:00.000Z';
export const C = '2027-03-01T18:30:00.000Z';
export const NEXT_DAY = '2027-03-02T02:30:00.000Z';

export interface SliceActualsBody {
  gross: string | null;
  good: string | null;
  reject: string | null;
  reworkAccepted: string | null;
  uom: string | null;
  basis: string;
  method: string | null;
  coverageRatio: string | null;
  measuredQty: string | null;
  estimatedQty: string | null;
  qualityState: string;
  resultId: string;
  exceptions: Array<{
    code: string;
    severity: string;
    detail?: Record<string, unknown>;
  }>;
  sourceSegments: Array<{ source: string; method: string }>;
  adjustmentIds: string[];
}

export interface PeriodDetailBody {
  data: {
    id: string;
    unitId: string;
    utcStart: string;
    stateReadiness: string;
    currentActualsRunId: string | null;
    warnings: Array<{ code: string }>;
    slices: Array<{
      id: string;
      productId: string;
      source: string;
      actuals: SliceActualsBody | null;
    }>;
    adjustments: Array<{ id: string; state: string }>;
  };
  calculationRunId: string | null;
  policyVersion: string | null;
  isProvisional: boolean;
  coverage: { ratio: number };
}

export interface SignalSpec {
  unitId: string;
  semanticType: 'counter' | 'rate';
  connection?: 'pi' | 'mqtt';
  from: string;
  to: string;
  timebase?: 'h' | null;
  resetPolicy?: 'none' | 'detect_drop';
  rolloverModulus?: string | null;
  expectedMax?: string | null;
  maxGapSeconds?: number;
  isAuthority?: boolean;
  productId?: string | null;
}

/**
 * World of the plan 2.4 integration specs, on top of the plan 2.3 world (tenants A/B, units A1–A3, a
 * D03 3 × 8 h calendar for 1–5 Mar 2027, approved profiles of A1/A2 × P1/P2): an approved profile of
 * A3 × P1 only (default-product slices), a PI and an MQTT connection of tenant A, and helpers for
 * signals, samples, output events, policies, materialization, recomputes, the outbox relay and the
 * actuals jobs. Test data only.
 */
export class ActualsWorld extends PlanWorld {
  readonly connections = { pi: randomUUID(), mqtt: randomUUID() };
  /** a second manager approver (independent approval of adjustments) */
  approver = '';

  async start(): Promise<void> {
    await super.start();
    this.approver = signToken(this.app, {
      userId: randomUUID(),
      tenantId: this.world.tenantA,
      role: 'TenantAdmin',
    });
    await this.profile(this.world.unitA3, this.products.p1);
    for (const [id, type] of [
      [this.connections.pi, 'pi_web_api'],
      [this.connections.mqtt, 'mqtt'],
    ]) {
      await this.rows(
        `INSERT INTO integration_connections (id, tenant_id, source_type, display_name, row_version)
         VALUES ($1, $2, $3, $4, 1)`,
        [id, this.world.tenantA, type, `${type} test`],
      );
    }
  }

  /** Approves a 1-day quantity plan of `unit` × P1 from DAY1 in the baseline scenario. */
  async approvedPlan(
    unitId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<PlanBody> {
    const plan = await this.createPlan({ unitId, ...overrides });
    await this.generate(plan.id, 1);
    await this.post(`production-plans/${plan.id}/approve`, {
      expectedVersion: 1,
    }).expect(200);
    return plan;
  }

  /** A unit-specific 24 h calendar (daily leaf, D03) replacing the unit's instances from 1 Mar 2027. */
  async dailyCalendar(unitId: string): Promise<void> {
    const created = await this.post('calendar-versions', {
      timezone: 'Asia/Tehran',
      operationalDayStart: '06:00',
      shiftTemplates: [{ name: 'D', startLocal: '06:00', endLocal: '06:00' }],
      unitId,
      effectiveFrom: '2026-01-01',
    }).expect(201);
    await this.post(
      `calendar-versions/${(created.body as { id: string }).id}/publish`,
      {},
    ).expect(200);
    const site = await this.app
      .get(SitesService)
      .defaultSite(this.world.tenantA);
    await this.app.get(CalendarMaterializerService).materialize({
      site,
      unitIds: [unitId],
      from: '2027-03-01',
      to: '2027-03-05',
      replaceFrom: '2027-03-01',
      actorId: null,
    });
  }

  async materialize(
    unitIds: string[],
    from = DAY1,
    to = NEXT_DAY,
    token = this.admin,
  ) {
    const response = await this.post(
      'production-periods/materialize',
      { unitIds, from, to },
      token,
    ).expect(200);
    return response.body as {
      created: number;
      skipped: number;
      periodIds: string[];
    };
  }

  async periodId(unitId: string, utcStart: string): Promise<string> {
    const rows = await this.rows<{ id: string }>(
      `SELECT id FROM production_periods WHERE unit_id = $1 AND utc_start = $2`,
      [unitId, utcStart],
    );
    if (!rows[0]) throw new Error(`no period of ${unitId} at ${utcStart}`);
    return rows[0].id;
  }

  /** Requests a recompute (202), runs the worker side and returns the period detail. */
  async recompute(
    periodId: string,
    token = this.admin,
  ): Promise<PeriodDetailBody> {
    await this.post(
      `production-periods/${periodId}/recompute`,
      {},
      token,
    ).expect(202);
    await this.runActuals();
    return this.detail(periodId, token);
  }

  async detail(
    periodId: string,
    token = this.admin,
  ): Promise<PeriodDetailBody> {
    const response = await this.get(
      `production-periods/${periodId}`,
      token,
    ).expect(200);
    return response.body as PeriodDetailBody;
  }

  runActuals(): Promise<number> {
    return this.app.get(ActualsJobsService).runPending();
  }

  /** Publishes every pending outbox message (consumers run in-process). */
  async relay(): Promise<void> {
    const relay = this.app.get(OutboxRelayService);
    while ((await relay.relayBatch()).published > 0);
  }

  async signal(spec: SignalSpec): Promise<string> {
    const id = randomUUID();
    await this.rows(
      `INSERT INTO signals (id, tenant_id, row_version, connection_id, name, source_key, source_binding, unit_id,
              product_id, semantic_type, canonical_uom, rate_timebase, interpolation, max_gap_seconds, reset_policy,
              rollover_modulus, expected_max, quality_policy, is_authority, effective_from, effective_to, version)
       VALUES ($1, $2, 1, $3, $4::text, $4::text, '{}', $5, $6, $7, 't', $8, 'step', $9, $10, $11, $12, '{}', $13, $14, $15, 1)`,
      [
        id,
        this.world.tenantA,
        spec.connection === 'mqtt'
          ? this.connections.mqtt
          : this.connections.pi,
        `sig-${id.slice(0, 8)}`,
        spec.unitId,
        spec.productId ?? null,
        spec.semanticType,
        spec.timebase ?? (spec.semanticType === 'rate' ? 'h' : null),
        spec.maxGapSeconds ?? 3600,
        spec.resetPolicy ?? 'none',
        spec.rolloverModulus ?? null,
        spec.expectedMax ?? null,
        spec.isAuthority ?? false,
        spec.from,
        spec.to,
      ],
    );
    return id;
  }

  /** Stores samples `[offset minutes from `base`, value, quality?]` of a signal. */
  async samples(
    signalId: string,
    base: string,
    points: Array<[number, string, string?]>,
  ): Promise<void> {
    const store = this.app.get(SampleStore);
    for (const [minutes, value, quality] of points) {
      await store.insertSample({
        tenantId: this.world.tenantA,
        signalId,
        observedAt: new Date(Date.parse(base) + minutes * MINUTE),
        value,
        stateName: null,
        stateValue: null,
        quality: (quality ?? 'good') as 'good',
        qualityFlags: null,
        rawId: randomUUID(),
        rawReceivedAt: new Date(),
        sourceRevision: '1',
      });
    }
  }

  /** A production output event through the v2 API (writes its EventChanged outbox message). */
  async outputEvent(
    unitId: string,
    start: string,
    end: string | null,
    quantity: string,
  ): Promise<string> {
    const response = await this.post('production-events', {
      unitId,
      startTime: start,
      ...(end ? { endTime: end } : {}),
      physicalType: 'production_output',
      eventType: 'ProductionOutput',
      quantity,
      quantityUom: 't',
    }).expect(201);
    return (response.body as { id: string }).id;
  }

  /** A unit-scoped policy version (replaces the tenant default for that unit). */
  async unitPolicy(
    unitId: string,
    kind: 'coverage_gate' | 'source_authority',
    body: object,
  ): Promise<void> {
    const rows = await this.rows<{ version: number }>(
      `SELECT coalesce(max(version), 0) + 1 AS version FROM accounting_policies
        WHERE tenant_id = $1 AND policy_kind = $2 AND scope_key = $3`,
      [this.world.tenantA, kind, unitId],
    );
    await this.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, $2, $3::uuid, $3::text, $4, $5::jsonb, '1970-01-01T00:00:00Z', now())`,
      [this.world.tenantA, kind, unitId, rows[0].version, JSON.stringify(body)],
    );
  }

  /** A token of a user whose only grant is `role` on unit `unitId` (WF05). */
  async unitUser(unitId: string, role = 'manager_approver'): Promise<string> {
    const userId = randomUUID();
    await this.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'unit user', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, this.world.tenantA],
    );
    await this.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'unit', $3, $4, 1)`,
      [this.world.tenantA, userId, unitId, role],
    );
    return signToken(this.app, {
      userId,
      tenantId: this.world.tenantA,
      role: 'Operator',
    });
  }
}
