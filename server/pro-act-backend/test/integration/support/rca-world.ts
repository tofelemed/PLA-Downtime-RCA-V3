import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as request from 'supertest';
import { RcaTriggerService } from '../../../src/rca-case/triggers/rca-trigger.service';
import { RcaTriggerSweepJob } from '../../../src/rca-case/triggers/rca-trigger-sweep.job';
import { HOUR } from './actuals-world';
import {
  ReconciliationBody,
  ReconciliationWorld,
} from './reconciliation-world';
import { bearer, signToken } from './test-app';

export interface CaseBody {
  id: string;
  title: string;
  status: string;
  unitId: string | null;
  rowVersion: number;
  teamMemberIds: string[];
  recommendations: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  logicTree: Array<Record<string, unknown>>;
}

export interface LinkResultBody {
  created: boolean;
  caseCreated: boolean;
  rca: { id: string };
  link: {
    id: string;
    linkType: string;
    targetId: string;
    evidence: Record<string, unknown>;
  };
}

export interface RecommendationBody {
  id: string;
  eventId: string;
  trigger: string;
  provisional: boolean;
  outcome: string;
  state: string;
  rcaId: string | null;
  detail: Record<string, unknown>;
}

/** The body the v2 RCA screen sends (shared with the frontend contract test). */
export const CASE_EXAMPLE = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../../contracts/rca/rca-case-v2.example.json'),
    'utf8',
  ),
) as Record<string, unknown>;

export const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

/**
 * Plan 3.9 world: the 2.8 reconciliation world (approved-plan periods on unit A1 in March 2027) with
 * `v2.rca` on for tenant A, a reliability engineer limited to unit A1, an operator, a tenant viewer,
 * two team members, and helpers for cases, links, stops, hint rules and period approval. Recent stops
 * use times relative to now (never a pinned date that could equal today).
 */
export class RcaWorld extends ReconciliationWorld {
  reliability = '';
  operator = '';
  viewer = '';
  members: string[] = [];

  async start(): Promise<void> {
    await super.start();
    await this.rows(
      `INSERT INTO feature_flags (tenant_id, row_version, key, enabled) VALUES ($1, 1, 'v2.rca', true)`,
      [this.world.tenantA],
    );
    this.reliability = await this.unitUser(
      this.world.unitA1,
      'reliability_engineer',
    );
    this.operator = this.user('Operator');
    this.viewer = await this.tenantUser('viewer');
    this.members = [await this.member(), await this.member()];
  }

  async member(): Promise<string> {
    const id = randomUUID();
    await this.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'member', $2, 'x', 'Engineer', $3)`,
      [id, `${id}@test.local`, this.world.tenantA],
    );
    return id;
  }

  async tenantUser(role: string): Promise<string> {
    const userId = await this.member();
    await this.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [this.world.tenantA, userId, role],
    );
    return signToken(this.app, { userId, tenantId: this.world.tenantA, role });
  }

  /** The shared example body, bound to this world's unit and users. */
  example(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      ...CASE_EXAMPLE,
      unitId: this.world.unitA1,
      teamLeadId: this.members[0],
      teamMemberIds: this.members,
      recommendations: [
        {
          ...(CASE_EXAMPLE.recommendations as object[])[0],
          ownerId: this.members[1],
        },
      ],
      ...overrides,
    };
  }

  async createCase(
    body: Record<string, unknown>,
    token = this.admin,
  ): Promise<CaseBody> {
    const response = await this.post('rcas', body, token).expect(201);
    return response.body as CaseBody;
  }

  /** A v2 unplanned stop; `endMinutesAgo` null keeps it running. */
  async stopEvent(
    unitId: string,
    startMinutesAgo: number,
    endMinutesAgo: number | null,
    extra: object = {},
  ): Promise<string> {
    const response = await this.post('production-events', {
      unitId,
      eventType: 'ProductionLoss',
      physicalType: 'downtime',
      scheduleClass: 'unplanned',
      startTime: minutesAgo(startMinutesAgo),
      ...(endMinutesAgo === null ? {} : { endTime: minutesAgo(endMinutesAgo) }),
      ...extra,
    }).expect(201);
    return (response.body as { id: string }).id;
  }

  linkEvent(eventId: string, body: object, token = this.admin): request.Test {
    return this.post(`production-events/${eventId}/rca-link`, body, token);
  }

  triggers(): RcaTriggerService {
    return this.app.get(RcaTriggerService);
  }

  sweep(): Promise<number> {
    return this.app.get(RcaTriggerSweepJob).sweep();
  }

  async recommendations(
    eventId: string,
    state = 'open',
  ): Promise<RecommendationBody[]> {
    const response = await this.get(
      `rca-recommendations?eventIds=${eventId}&state=${state}`,
    ).expect(200);
    return (response.body as { items: RecommendationBody[] }).items;
  }

  /** An active `rca_trigger_hint` rule (version 1) with the given definition. */
  async hintRule(name: string, definition: object): Promise<void> {
    const id = randomUUID();
    await this.rows(
      `INSERT INTO rules (id, tenant_id, row_version, kind, name, priority, state, active_version)
       VALUES ($1, $2, 1, 'rca_trigger_hint', $3, 100, 'active', 1)`,
      [id, this.world.tenantA, name],
    );
    await this.rows(
      `INSERT INTO rule_versions (tenant_id, row_version, rule_id, version, definition, origin, approved_by, effective_from)
       VALUES ($1, 1, $2, 1, $3::jsonb, 'activation', $4, now())`,
      [this.world.tenantA, id, JSON.stringify(definition), randomUUID()],
    );
  }

  /** A unit-scoped `rca_policy` version 1 (replaces the D13 default for the unit). */
  async unitRcaPolicy(unitId: string, body: object): Promise<void> {
    await this.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'rca_policy', $2::uuid, $2::text, 1, $3::jsonb, '1970-01-01T00:00:00Z', now())`,
      [this.world.tenantA, unitId, JSON.stringify(body)],
    );
  }

  /**
   * Accepts recovery gains and the loss candidates that fit the gap (largest first), rejects the rest,
   * explains any residual manually, submits and approves period A1.
   */
  async approvePeriodA1(reasonCodeId: string): Promise<void> {
    await this.settle();
    const view = await this.view();
    const gap = Number(view.slices[0].gap ?? 0);
    let used = view.candidates
      .filter((c) => Number(c.quantity) < 0)
      .reduce((sum, c) => sum + Number(c.quantity), 0);
    const lines: Array<Record<string, unknown>> = [...view.candidates]
      .sort((a, b) => Number(b.quantity) - Number(a.quantity))
      .map((c) => {
        const quantity = Number(c.quantity);
        if (quantity < 0) return { action: 'accept', autoKey: c.autoKey };
        if (used + quantity > gap + 1e-6)
          return {
            action: 'reject',
            autoKey: c.autoKey,
            reason: 'covered by other causes',
          };
        used += quantity;
        return { action: 'accept', autoKey: c.autoKey };
      });
    const residual = await this.residualAfter(view, lines);
    if (residual !== '0') {
      lines.push({
        action: 'manual',
        sliceId: view.slices[0].sliceId,
        kind: 'availability',
        quantity: residual,
        missingEvent: true,
        reasonCodeId,
        reason: 'unexplained rest',
      });
    }
    await this.saveLines(await this.view(), lines).expect(200);
    const submitted = await this.view();
    await this.submit(submitted).expect(200);
    await this.approve(await this.view()).expect(200);
  }

  private async residualAfter(
    view: ReconciliationBody,
    lines: Array<Record<string, unknown>>,
  ): Promise<string> {
    await this.saveLines(view, lines).expect(200);
    return (await this.view()).slices[0].residual ?? '0';
  }

  v1(): {
    post: (path: string, body: object) => request.Test;
    del: (path: string) => request.Test;
  } {
    return {
      post: (path, body) =>
        this.http().post(`/api/${path}`).set(bearer(this.admin)).send(body),
      del: (path) => this.http().delete(`/api/${path}`).set(bearer(this.admin)),
    };
  }
}

export { HOUR };
