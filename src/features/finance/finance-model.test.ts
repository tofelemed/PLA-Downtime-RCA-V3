import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { emptyFxForm, fxCreateBody, validateFxForm, type FxFormValues } from './model/fx-form';
import { policyCreateBody, policyFormOf, validatePolicyForm } from './model/policy-form';
import { anyApproved, authorshipOf, policyStatus } from './model/policy-status';


const fx = (patch: Partial<FxFormValues>): FxFormValues => ({ ...emptyFxForm(), rate: '500000', effectiveFrom: '2026-10-01T02:30:00.000Z', ...patch });

const policy = (patch: Partial<ValuationPolicyView>): ValuationPolicyView => ({
  id: 'p2', version: 2, approved: false, approvedBy: null, approvedAt: null, effectiveFrom: '1970-01-01T00:00:00.000Z', effectiveTo: null,
  body: { defaultBasis: 'contribution_margin', timeBasisRule: 'exclusive', reportingCurrencies: ['IRR', 'USD'], fxPolicy: 'snapshot', independentImpactCodeIds: [] },
  reportingCurrencies: ['IRR', 'USD'], notes: null, createdBy: null, createdAt: '2026-10-09T00:00:00.000Z', ...patch,
});

describe('FX rate form (mirrors the 422 fieldErrors of POST /fx-rates)', () => {
  it('accepts a decimal string with 10 decimals and sends it unchanged, instants in UTC', () => {
    const values = fx({ rate: '42000.0123456789', effectiveTo: '2026-11-01T02:30:00.000Z', source: ' CBI ' });
    expect(validateFxForm(values)).toEqual({});
    expect(fxCreateBody(values)).toEqual({
      rateType: 'economic', fromCurrency: 'USD', toCurrency: 'IRR', rate: '42000.0123456789',
      effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: '2026-11-01T02:30:00.000Z', source: 'CBI', provisional: false,
    });
  });

  it('SME V7: a provisional rate needs an end date and is sent flagged', () => {
    expect(validateFxForm(fx({ provisional: true }))).toEqual({ effectiveTo: 'A provisional rate needs an end date.' });
    const bounded = fx({ provisional: true, effectiveTo: '2026-11-01T02:30:00.000Z' });
    expect(validateFxForm(bounded)).toEqual({});
    expect(fxCreateBody(bounded)).toMatchObject({ provisional: true, effectiveTo: '2026-11-01T02:30:00.000Z' });
  });

  it('flags the fields the API names: rate, toCurrency, effectiveFrom / effectiveTo', () => {
    expect(validateFxForm(fx({ rate: null }))).toEqual({ rate: 'Enter the rate.' });
    expect(validateFxForm(fx({ rate: '0.000' }))).toEqual({ rate: 'The rate must be greater than 0.' });
    expect(validateFxForm(fx({ rate: '1.12345678901' })).rate).toMatch(/14 digits before and 10 digits after/);
    expect(validateFxForm(fx({ rate: '123456789012345' })).rate).toMatch(/14 digits before/);
    expect(validateFxForm(fx({ toCurrency: 'USD' }))).toEqual({ toCurrency: 'Choose a currency different from the first one.' });
    expect(validateFxForm(fx({ fromCurrency: 'usd' }))).toEqual({ fromCurrency: 'Choose a currency.' });
    expect(validateFxForm(fx({ effectiveFrom: null }))).toEqual({ effectiveFrom: 'Enter the date and time it starts.' });
    expect(validateFxForm(fx({ effectiveTo: '2026-10-01T02:30:00.000Z' }))).toEqual({ effectiveTo: 'The end must be after the start.' });
    expect(validateFxForm(fx({ source: 'x'.repeat(256) })).source).toMatch(/255/);
  });
});

describe('valuation policy form and status', () => {
  it('a new version copies the stored body; a fresh one starts from the SME pilot settings (IRR + USD, economic view)', () => {
    const copied = policyFormOf(policy({ body: { defaultBasis: 'standard_cost', timeBasisRule: 'independent_components', fxPolicy: 'none', independentImpactCodeIds: ['c1'] }, reportingCurrencies: ['USD'] }));
    expect(copied).toMatchObject({ defaultBasis: 'standard_cost', timeBasisRule: 'independent_components', fxPolicy: 'none', reportingCurrencies: ['USD'], independentImpactCodeIds: ['c1'], effectiveFrom: null });
    expect(policyFormOf(null)).toMatchObject({ defaultBasis: 'economic_impact', timeBasisRule: 'exclusive', fxPolicy: 'snapshot', reportingCurrencies: ['IRR', 'USD'] });
    expect(policyFormOf(null).economic).toMatchObject({ demandRule: 'demand_constrained_only', fxRateType: 'economic', fxDateRule: 'event_date' });
  });

  it('validates start and currencies; impact codes are sent only for independent components', () => {
    const values = { ...policyFormOf(null), effectiveFrom: '2026-11-01T02:30:00.000Z', independentImpactCodeIds: ['c1'] };
    expect(validatePolicyForm(values)).toEqual({});
    expect(policyCreateBody(values)).toEqual({
      defaultBasis: 'economic_impact', timeBasisRule: 'exclusive', reportingCurrencies: ['IRR', 'USD'], fxPolicy: 'snapshot',
      independentImpactCodeIds: [], effectiveFrom: '2026-11-01T02:30:00.000Z', notes: null,
      fxRateType: 'economic', fxDateRule: 'event_date', fxAverageMaxDeviation: '0.05',
      demandRule: 'demand_constrained_only', qualityDispositions: {}, defaultQualityDisposition: null, manualLineHours: true,
    });
    const off = { ...values, economic: { ...values.economic, demandRule: 'none' as const } };
    expect(validatePolicyForm(off)).toEqual({ defaultBasis: 'The economic view needs a lost-sales rule.' });
    expect(policyCreateBody({ ...off, defaultBasis: 'contribution_margin' })).not.toHaveProperty('demandRule');
    expect(validatePolicyForm({ ...values, effectiveFrom: null, reportingCurrencies: [] })).toEqual({
      effectiveFrom: 'Enter the date and time it starts.', reportingCurrencies: 'Choose at least one reporting currency.',
    });
  });

  it('statuses: approved, unapproved, XXX placeholder; authorship relative to the viewer', () => {
    expect(policyStatus(policy({ approved: true, approvedAt: '2026-10-10T00:00:00Z' }))).toBe('approved');
    expect(policyStatus(policy({}))).toBe('unapproved');
    expect(policyStatus(policy({ version: 1, reportingCurrencies: [], body: { currency: 'XXX' } }))).toBe('placeholder');
    expect(anyApproved([policy({}), policy({ version: 1, reportingCurrencies: [] })])).toBe(false);
    expect(authorshipOf(policy({ createdBy: 'u1' }), 'u1')).toBe('you');
    expect(authorshipOf(policy({ createdBy: 'u1' }), 'u2')).toBe('someone-else');
    expect(authorshipOf(policy({}), 'u1')).toBe('system');
  });
});

describe('finance hygiene (CLAUDE.md: no business numbers in the browser)', () => {
  const FEATURE = join(process.cwd(), 'src', 'features', 'finance');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  const FORBIDDEN: ReadonlyArray<[string, RegExp]> = [
    ['float conversion', /parseFloat|Number\(\s*(values\.)?rate|\.toFixed\(/],
    ['client aggregation', /\.reduce\(/],
    ['Math.random', /Math\.random/],
    ['browser storage', /localStorage|sessionStorage|indexedDB|StorageService/],
    ['console.log', /console\.log/],
  ];

  it('the screen converts, sums and stores nothing', () => {
    const offences = files(FEATURE).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([label]) => `${relative(process.cwd(), file)}: ${label}`);
    });
    expect(offences).toEqual([]);
  });
});
