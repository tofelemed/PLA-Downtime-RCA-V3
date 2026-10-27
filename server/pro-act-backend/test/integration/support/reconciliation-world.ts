import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { A, B, C, NEXT_DAY } from './actuals-world';
import { AccountingWorld } from './accounting-world';
import { DAY1 } from './plan-world';
import { bearer, signToken } from './test-app';

export interface SliceBody {
  sliceId: string;
  target: string | null;
  actual: string | null;
  gap: string | null;
  attributed: string;
  /** declared runs: the recovery shares taken off the attributed loss (absent when zero) */
  declaredGain?: string;
  toleranceAdjustment: string;
  unadjustedResidual: string | null;
  residual: string | null;
  overAccounted: string | null;
  tolerance: string;
  flags: string[];
}

export interface ReconciliationBody {
  periodId: string;
  rowVersion: number;
  revision: {
    id: string;
    revision: number;
    lifecycle: string;
    supersedesId: string | null;
    isStale: boolean;
    staleReason: string | null;
    submittedBy: string | null;
    submittedHash: string | null;
    approvalSnapshotId: string | null;
    rejectReason: string | null;
    currentRunId: string | null;
    /** item 1.3: approved by a party of its own submission (SuperAdmin only) */
    selfDecided?: boolean;
  };
  publishedRevision: number | null;
  baseRunId: string | null;
  contentHash: string;
  slices: SliceBody[];
  candidates: Array<{
    autoKey: string;
    sliceId: string;
    kind: string;
    quantity: string;
    state: string;
    effectiveQuantity: string;
    causeEventId: string | null;
  }>;
  lines: Array<{
    action: string;
    kind: string | null;
    quantity: string | null;
    flags: string[];
    authorId: string | null;
  }>;
  openProposalId: string | null;
  /** SME D12 / D13: stop coding of the period (see stop-coding-gate.int-spec) */
  codingGate?: unknown;
  /** SME R8 (see bridge-limits.int-spec) */
  bridgeReview?: unknown;
}

/**
 * World of the plan 2.8 integration specs: the 2.5 accounting world with a 1-day baseline plan of 3000 t on
 * unit A1 (1000 t per 8 h shift), the periods of shifts A / B / C each with an output of 850 t (gap 150
 * and no automatic candidate until a loss event is added), a manager approver
 * different from the admin, and helpers for the reconciliation view and the workflow commands. Test data
 * only; all dates are the fixed 2027 test days, independent of today.
 */
export class ReconciliationWorld extends AccountingWorld {
  /** periods of unit A1, shifts A / B / C of day 1 */
  periodA1 = '';
  periodB1 = '';
  periodC1 = '';

  async start(): Promise<void> {
    await super.start();
    const { unitA1 } = this.world;
    await this.approvedPlan(unitA1, { headerTarget: '3000' });
    await this.materialize([unitA1], DAY1, NEXT_DAY);
    this.periodA1 = await this.periodId(unitA1, A);
    this.periodB1 = await this.periodId(unitA1, B);
    this.periodC1 = await this.periodId(unitA1, C);
    for (const [from, to] of [
      [A, B],
      [B, C],
      [C, NEXT_DAY],
    ]) {
      await this.outputEvent(unitA1, from, to, '850');
    }
    await this.settle();
  }

  put(
    path: string,
    body: object,
    etag: string,
    token = this.admin,
  ): request.Test {
    return this.http()
      .put(`/api/v2/${path}`)
      .set(bearer(token))
      .set('If-Match', etag)
      .send(body);
  }

  async view(
    periodId = this.periodA1,
    token = this.admin,
    query = '',
  ): Promise<ReconciliationBody> {
    const response = await this.get(
      `production-periods/${periodId}/reconciliation${query}`,
      token,
    ).expect(200);
    return response.body as ReconciliationBody;
  }

  /** Rejects every candidate and adds one manual line of `quantity` with cause-without-event evidence. */
  rejectAllPlus(
    view: ReconciliationBody,
    quantity: string,
    reasonCodeId: string,
  ): Array<Record<string, unknown>> {
    return [
      ...view.candidates.map((c) => ({
        action: 'reject',
        autoKey: c.autoKey,
        reason: 'not the cause',
      })),
      {
        action: 'manual',
        sliceId: view.slices[0].sliceId,
        kind: 'availability',
        quantity,
        missingEvent: true,
        // SME R11: a stop without an event cites its record
        evidenceType: 'log',
        evidenceRef: 'shift log',
        reasonCodeId,
        reason: 'feed outage',
      },
    ];
  }

  saveLines(
    view: ReconciliationBody,
    lines: Array<Record<string, unknown>>,
    token = this.admin,
    periodId = this.periodA1,
  ): request.Test {
    return this.put(
      `production-periods/${periodId}/draft-lines`,
      { revision: view.revision.revision, baseRunId: view.baseRunId, lines },
      `"${view.rowVersion}"`,
      token,
    );
  }

  submit(
    view: ReconciliationBody,
    token = this.admin,
    periodId = this.periodA1,
  ): request.Test {
    return this.post(
      `production-periods/${periodId}/submit`,
      {
        revision: view.revision.revision,
        runId: view.baseRunId,
        contentHash: view.contentHash,
      },
      token,
    );
  }

  approve(
    view: ReconciliationBody,
    token = this.approver,
    periodId = this.periodA1,
  ): request.Test {
    return this.post(
      `production-periods/${periodId}/approve`,
      {
        revision: view.revision.revision,
        submittedHash: view.revision.submittedHash,
      },
      token,
    );
  }

  /** A reason code of tenant A (optionally with a reason → impact rule). */
  async reasonCode(code: string): Promise<string> {
    const id = randomUUID();
    await this.rows(
      `INSERT INTO reason_codes (id, code, name, tenant_id, is_active) VALUES ($1, $2, $2, $3, true)`,
      [id, `${code}-${id.slice(0, 6)}`, this.world.tenantA],
    );
    return id;
  }

  async impactCode(code: string): Promise<string> {
    const id = randomUUID();
    await this.rows(
      `INSERT INTO impact_codes (id, code, name, tenant_id, is_active) VALUES ($1, $2, $2, $3, true)`,
      [id, `${code}-${id.slice(0, 6)}`, this.world.tenantA],
    );
    return id;
  }

  /** A unit-scoped `reconciliation_tolerance` version (replaces the tenant default for the unit). */
  async tolerancePolicy(unitId: string, body: object): Promise<void> {
    const rows = await this.rows<{ version: number }>(
      `SELECT coalesce(max(version), 0) + 1 AS version FROM accounting_policies
        WHERE tenant_id = $1 AND policy_kind = 'reconciliation_tolerance' AND scope_key = $2`,
      [this.world.tenantA, unitId],
    );
    await this.rows(
      `INSERT INTO accounting_policies (tenant_id, row_version, policy_kind, unit_id, scope_key, version, body,
              effective_from, approved_at)
       VALUES ($1, 1, 'reconciliation_tolerance', $2::uuid, $2::text, $3, $4::jsonb, '1970-01-01T00:00:00Z', now())`,
      [this.world.tenantA, unitId, rows[0].version, JSON.stringify(body)],
    );
  }

  /** A token of a new user of tenant A with the given legacy role. */
  user(role: string): string {
    return signToken(this.app, {
      userId: randomUUID(),
      tenantId: this.world.tenantA,
      role,
    });
  }

  /** A token of a new user of tenant A granted one scope role on the whole tenant. */
  async scopedUser(role: string): Promise<string> {
    const userId = randomUUID();
    await this.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, $2, $3, 'x', 'Operator', $4)`,
      [userId, role, `${userId}@test.local`, this.world.tenantA],
    );
    await this.rows(
      `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
       VALUES ($1, $2, 'tenant', $1, $3, 1)`,
      [this.world.tenantA, userId, role],
    );
    return signToken(this.app, {
      userId,
      tenantId: this.world.tenantA,
      role: 'Operator',
    });
  }

  /** A token of a user holding both workflow roles on every unit (separation of duties still applies). */
  async dualRoleUser(): Promise<string> {
    const userId = randomUUID();
    await this.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'dual', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, this.world.tenantA],
    );
    for (const role of ['production_engineer', 'manager_approver']) {
      await this.rows(
        `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version)
         VALUES ($1, $2, 'tenant', $1, $3, 1)`,
        [this.world.tenantA, userId, role],
      );
    }
    return signToken(this.app, {
      userId,
      tenantId: this.world.tenantA,
      role: 'Operator',
    });
  }
}
