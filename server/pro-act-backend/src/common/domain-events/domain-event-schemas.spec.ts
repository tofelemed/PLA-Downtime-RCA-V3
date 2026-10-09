import { randomUUID } from 'crypto';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { contractFileOf, DOMAIN_EVENT_SCHEMAS } from './domain-event-schemas';
import {
  domainEventViolations,
  hasDomainEventSchema,
} from './domain-event-validator';

const CONTRACTS = resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'contracts',
  'domain-events',
);
const HASH = 'a'.repeat(64);

function periodApproved(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    domainEventId: randomUUID(),
    tenantId: randomUUID(),
    entityType: 'production_period',
    entityId: randomUUID(),
    entityRevision: 1,
    occurredAt: '2027-03-01T10:30:00.000Z',
    correlationId: null,
    periodId: randomUUID(),
    revisionId: randomUUID(),
    revision: 1,
    unitId: randomUUID(),
    utcStart: '2027-03-01T02:30:00.000Z',
    utcEnd: '2027-03-01T10:30:00.000Z',
    priorRevisionId: null,
    snapshotId: randomUUID(),
    snapshotHash: HASH,
    submittedHash: HASH,
    calculationRunId: randomUUID(),
    approvedBy: randomUUID(),
    policyVersions: [{ id: randomUUID(), kind: 'oee_policy', version: 1 }],
    products: [
      {
        sliceId: randomUUID(),
        productId: randomUUID(),
        uom: 't',
        target: '1000',
        actual: '850',
        gap: '150',
        attributed: '150',
        toleranceAdjustment: '0',
        residual: '0',
        overAccounted: null,
        overproduction: null,
      },
    ],
    quality: [
      { sliceId: randomUUID(), qualityState: 'good', coverageRatio: '1' },
    ],
    valuation: { status: 'unvalued', currency: null, reason: 'plan 2.6' },
  };
}

describe('domain event contracts (plan 2.9, §15.4)', () => {
  it('every checked copy equals its published contract and every contract has a copy', () => {
    const files = readdirSync(CONTRACTS).filter((f) => f.endsWith('.json'));
    expect(files.sort()).toEqual(
      Object.keys(DOMAIN_EVENT_SCHEMAS).map(contractFileOf).sort(),
    );
    for (const [type, schema] of Object.entries(DOMAIN_EVENT_SCHEMAS)) {
      const published: unknown = JSON.parse(
        readFileSync(resolve(CONTRACTS, contractFileOf(type)), 'utf8'),
      );
      expect(published).toEqual(schema);
    }
  });

  it('accepts a conforming PeriodApproved and PeriodRestated payload', () => {
    expect(
      domainEventViolations('PeriodApproved', periodApproved()),
    ).toBeNull();
    expect(
      domainEventViolations('PeriodRestated', {
        ...periodApproved(),
        priorRevisionId: randomUUID(),
        entityRevision: 2,
        revision: 2,
      }),
    ).toBeNull();
  });

  it('accepts a valued payload in both reporting currencies (plan 2.6, additive widening)', () => {
    const sliceId = randomUUID();
    const total = (currency: string, amount: string | null) => ({
      sliceId,
      view: 'contribution_margin',
      currency,
      amount,
      status: amount === null ? 'mixed' : 'valued',
      reasons: amount === null ? ['fx_rate_missing'] : [],
      unvaluedQuantity: '0',
    });
    const valuation = {
      status: 'mixed',
      currency: null,
      reason: 'fx_rate_missing',
      policyVersion: { id: randomUUID(), version: 2 },
      defaultView: 'contribution_margin',
      currencies: ['IRR', 'USD'],
      totals: [total('IRR', '2500000'), total('USD', null)],
    };
    expect(
      domainEventViolations('PeriodApproved', {
        ...periodApproved(),
        valuation,
      }),
    ).toBeNull();
    const numeric = {
      ...valuation,
      totals: [{ ...total('IRR', '1'), amount: 1 }],
    };
    expect(
      domainEventViolations('PeriodApproved', {
        ...periodApproved(),
        valuation: numeric,
      }),
    ).toEqual(expect.any(String));
  });

  it.each([
    ['a missing envelope field', { domainEventId: undefined }],
    ['an undeclared field', { rawEvents: [] }],
    [
      'a number instead of a decimal string',
      {
        products: [
          { ...(periodApproved().products as object[])[0], target: 1000 },
        ],
      },
    ],
    [
      'an invented currency',
      { valuation: { status: 'unvalued', currency: 'USD', reason: 'x' } },
    ],
    ['another schema version', { schemaVersion: 2 }],
  ])('rejects %s', (_label, change) => {
    const payload: Record<string, unknown> = { ...periodApproved(), ...change };
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) delete payload[key];
    }
    expect(domainEventViolations('PeriodApproved', payload)).toEqual(
      expect.any(String),
    );
  });

  it('only types with a contract are validated', () => {
    expect(hasDomainEventSchema('PeriodSubmitted')).toBe(true);
    expect(hasDomainEventSchema('EventChanged')).toBe(false);
    expect(domainEventViolations('EventChanged', { anything: 1 })).toBeNull();
  });

  it('names contract files in kebab case', () => {
    expect(contractFileOf('PeriodApproved')).toBe(
      'period-approved.v1.schema.json',
    );
  });
});
