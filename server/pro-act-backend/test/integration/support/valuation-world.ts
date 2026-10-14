import { randomUUID } from 'crypto';
import { A, HOUR } from './actuals-world';
import { plus } from './accounting-world';
import { ExportWorld } from './export-world';
import { signToken } from './test-app';

export interface ViewValuation {
  view: string;
  status: string;
  reason: string | null;
  components: Array<{ rateVersionId: string; currency: string }>;
  amounts: Array<{
    currency: string;
    amount: string | null;
    reason: string | null;
    fxRateIds: string[];
  }>;
}

export interface ValuedLine {
  ledger: string;
  kind: string;
  quantity: string;
  valuation: { policyVersion: number | null; views: ViewValuation[] } | null;
}

export interface ValuationTotalBody {
  ledger: string;
  kind: string;
  view: string;
  currency: string;
  amount: string | null;
  nativeAmount: string;
  status: string;
  reasons: string[];
  unvaluedQuantity: string;
  fxRateIds: string[];
}

export interface AccountingWithValuation {
  data: {
    run: {
      id: string;
      policyVersions: Array<{ kind: string; version: number }>;
    };
    lines: ValuedLine[];
    valuationTotals: ValuationTotalBody[];
  };
}

/** The view of a line by name (throws when absent, so a test fails loudly). */
export function viewOf(line: ValuedLine, name: string): ViewValuation {
  const found = line.valuation?.views.find((v) => v.view === name);
  if (!found) throw new Error(`no ${name} view`);
  return found;
}

export function amountOf(v: ViewValuation, currency: string) {
  const found = v.amounts.find((a) => a.currency === currency);
  if (!found) throw new Error(`no ${currency} amount`);
  return found;
}

/**
 * World of the plan 2.6 integration spec: the 2.9 export world (2.8 reconciliation world: A1 shifts of
 * 1 Mar 2027, target 1000, output 850) plus a 1 h stop at A + 1 h on A1 whose cause carries an impact code
 * of tenant A, a unit-limited finance approver of A1, and helpers for the valuation read model. Test data
 * only; all dates are the fixed 2027 test days.
 */
export class ValuationWorld extends ExportWorld {
  reasonId = '';
  impactId = '';
  profileId = '';
  unitUserToken = '';
  /** holds both finance roles tenant-wide: may author and approve, never its own version (SoD) */
  financeDual = '';

  async start(): Promise<void> {
    await super.start();
    this.reasonId = await this.reasonCode('FEED');
    this.impactId = await this.impactCode('IMP');
    this.unitUserToken = await this.financeUser('unit');
    this.financeDual = await this.financeUser('tenant');
    const stop = await this.lossEvent(this.world.unitA1, plus(A, HOUR), 1);
    await this.rows(
      `UPDATE production_events SET impact_code_id = $1 WHERE id = $2`,
      [this.impactId, stop],
    );
    await this.settle();
    const [slice] = await this.rows<{ profile_id: string }>(
      `SELECT profile_id FROM period_product_slices WHERE period_id = $1 AND superseded_at IS NULL`,
      [this.periodA1],
    );
    this.profileId = slice.profile_id;
  }

  /** A user holding finance_maintainer and finance_approver on unit A1 or tenant-wide in A (test data). */
  async financeUser(kind: 'unit' | 'tenant'): Promise<string> {
    const userId = randomUUID();
    const tenantId = this.world.tenantA;
    await this.rows(
      `INSERT INTO users (id, name, email, password_hash, role, tenant_id) VALUES ($1, 'finance user', $2, 'x', 'Operator', $3)`,
      [userId, `${userId}@test.local`, tenantId],
    );
    const scopeId = kind === 'unit' ? this.world.unitA1 : tenantId;
    for (const role of ['finance_maintainer', 'finance_approver']) {
      await this.rows(
        `INSERT INTO user_scopes (tenant_id, user_id, scope_kind, scope_id, role, row_version) VALUES ($1, $2, $3, $4, $5, 1)`,
        [tenantId, userId, kind, scopeId, role],
      );
    }
    return signToken(this.app, { userId, tenantId, role: 'Operator' });
  }

  async valued(): Promise<AccountingWithValuation> {
    return (await this.accounting(
      this.periodA1,
    )) as unknown as AccountingWithValuation;
  }

  async recomputeA1(): Promise<AccountingWithValuation> {
    await this.post(`production-periods/${this.periodA1}/recompute`, {}).expect(
      202,
    );
    await this.runActuals();
    return this.valued();
  }

  /** The capacity-ledger availability line of the stop. */
  stopLine(body: AccountingWithValuation): ValuedLine {
    const found = body.data.lines.find(
      (l) => l.ledger === 'capacity' && l.kind === 'availability',
    );
    if (!found) throw new Error('no capacity availability line');
    return found;
  }

  /** The capacity-ledger availability total of a view and currency. */
  total(
    body: AccountingWithValuation,
    view: string,
    currency: string,
  ): ValuationTotalBody | undefined {
    return body.data.valuationTotals.find(
      (t) =>
        t.ledger === 'capacity' &&
        t.kind === 'availability' &&
        t.view === view &&
        t.currency === currency,
    );
  }

  /** Creates (finance maintainer) and approves (finance approver) a valuation rate effective from 1 Mar 2027 00:00 UTC. */
  async valuationRate(body: Record<string, unknown>): Promise<string> {
    const created = await this.post(
      'valuation-rates',
      { effectiveFrom: '2027-03-01T00:00:00Z', ...body },
      this.finance,
    ).expect(201);
    const id = (created.body as { id: string }).id;
    await this.post(
      `valuation-rates/${id}/approve`,
      {},
      this.financeApprover,
    ).expect(200);
    return id;
  }
}
