import { ActualsWorld, HOUR } from './actuals-world';

export interface TotalsBody {
  sliceId: string;
  ledger: 'capacity' | 'plan';
  capacity: string | null;
  exclusion: string | null;
  availability: string | null;
  performance: string | null;
  quality: string | null;
  good: string | null;
  gain: string | null;
  attributed: string | null;
  residual: string | null;
  target: string | null;
  actual: string | null;
  gap: string | null;
  overproduction: string | null;
  overAccounted: string | null;
  flags: string[];
}

export interface LineBody {
  id: string;
  ledger: string;
  kind: string;
  quantity: string;
  basis: string;
  rateVersionId: string | null;
  autoKey: string;
  causeEventId: string | null;
  evidence: Array<{
    eventId: string;
    eventRevisionId: string | null;
    share: string;
  }>;
}

export interface RunBody {
  id: string;
  status: string;
  actualsRunId: string | null;
  inputHash: string;
  policyVersions: Array<{ kind: string; version: number }>;
  error: Array<{ code: string }> | null;
}

export interface AccountingBody {
  data: {
    revision: { id: string; revision: number; lifecycle: string } | null;
    run: RunBody | null;
    defaultLedgerView: string | null;
    totals: TotalsBody[];
    lines: LineBody[];
  };
  calculationRunId: string | null;
  policyVersion: string | null;
  isProvisional: boolean;
}

export const plus = (iso: string, ms: number) =>
  new Date(Date.parse(iso) + ms).toISOString();

/**
 * World of the plan 2.5 integration specs: the 2.4 actuals world (tenants A/B, units A1–A3, D03 calendar,
 * profiles with planning 90 t/h and sustained 100 t/h) plus helpers for loss events, the outbox relay
 * and worker jobs, and the accounting read. Test data only.
 */
export class AccountingWorld extends ActualsWorld {
  async lossEvent(
    unitId: string,
    start: string,
    hours: number,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await this.post('production-events', {
      unitId,
      startTime: start,
      endTime: plus(start, hours * HOUR),
      physicalType: 'downtime',
      description: 'test stop',
      ...extra,
    }).expect(201);
    return (response.body as { id: string }).id;
  }

  /** Relays the outbox (consumers queue jobs) and runs the worker side. */
  async settle(): Promise<void> {
    await this.relay();
    await this.runActuals();
  }

  async accounting(
    periodId: string,
    token = this.admin,
    query = '',
  ): Promise<AccountingBody> {
    const response = await this.get(
      `production-periods/${periodId}/accounting${query}`,
      token,
    ).expect(200);
    return response.body as AccountingBody;
  }

  async runs(periodId: string, token = this.admin): Promise<RunBody[]> {
    const response = await this.get(
      `production-periods/${periodId}/runs`,
      token,
    ).expect(200);
    return (response.body as { items: RunBody[] }).items;
  }

  totals(body: AccountingBody, ledger: 'capacity' | 'plan'): TotalsBody {
    const found = body.data.totals.find((t) => t.ledger === ledger);
    if (!found) throw new Error(`no ${ledger} totals`);
    return found;
  }
}
