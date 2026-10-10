import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ValuationPolicyView } from '@/api/v2/types/valuation';
import { emptyFxForm, fxCreateBody, validateFxForm, type FxFormValues } from './model/fx-form';
import { policyCreateBody, policyFormOf, validatePolicyForm } from './model/policy-form';
import { anyApproved, authorshipOf, policyStatus } from './model/policy-status';

const TZ = 'Asia/Tehran';
const fx = (patch: Partial<FxFormValues>): FxFormValues => ({ ...emptyFxForm(), rate: '500000', effectiveFrom: '2026-10-01T06:00', ...patch });

const policy = (patch: Partial<ValuationPolicyView>): ValuationPolicyView => ({
  id: 'p2', version: 2, approved: false, approvedBy: null, approvedAt: null, effectiveFrom: '1970-01-01T00:00:00.000Z', effectiveTo: null,
  body: { defaultBasis: 'contribution_margin', timeBasisRule: 'exclusive', reportingCurrencies: ['IRR', 'USD'], fxPolicy: 'snapshot', independentImpactCodeIds: [] },
  reportingCurrencies: ['IRR', 'USD'], notes: null, createdBy: null, createdAt: '2026-10-09T00:00:00.000Z', ...patch,
});

describe('FX rate form (mirrors the 422 fieldErrors of POST /fx-rates)', () => {
  it('accepts a decimal string with 10 decimals and sends it unchanged, instants in UTC', () => {
    const values = fx({ rate: '42000.0123456789', effectiveTo: '2026-11-01T06:00', source: ' CBI ' });
    expect(validateFxForm(values, TZ)).toEqual({});
    expect(fxCreateBody(values, TZ)).toEqual({
      fromCurrency: 'USD', toCurrency: 'IRR', rate: '42000.0123456789',
      effectiveFrom: '2026-10-01T02:30:00.000Z', effectiveTo: '2026-11-01T02:30:00.000Z', source: 'CBI',
    });
  });

  it('flags the fields the API names: rate, toCurrency, effectiveFrom / effectiveTo', () => {
    expect(validateFxForm(fx({ rate: null }), TZ)).toEqual({ rate: 'rate is required' });
    expect(validateFxForm(fx({ rate: '0.000' }), TZ)).toEqual({ rate: 'rate must be a decimal > 0' });
    expect(validateFxForm(fx({ rate: '1.12345678901' }), TZ).rate).toMatch(/at most 14 integer digits and 10 decimals/);
    expect(validateFxForm(fx({ rate: '123456789012345' }), TZ).rate).toMatch(/at most 14 integer digits/);
    expect(validateFxForm(fx({ toCurrency: 'USD' }), TZ)).toEqual({ toCurrency: 'fromCurrency and toCurrency must differ' });
    expect(validateFxForm(fx({ fromCurrency: 'usd' }), TZ)).toEqual({ fromCurrency: 'fromCurrency must be an ISO 4217 code' });
    expect(validateFxForm(fx({ effectiveFrom: '' }), TZ)).toEqual({ effectiveFrom: 'effectiveFrom is required' });
    expect(validateFxForm(fx({ effectiveTo: '2026-10-01T06:00' }), TZ)).toEqual({ effectiveTo: 'effectiveTo must be after effectiveFrom' });
    expect(validateFxForm(fx({ source: 'x'.repeat(256) }), TZ).source).toMatch(/255/);
  });
});

describe('valuation policy form and status', () => {
  it('a new version copies the stored body; a fresh one starts from the D08 answer (IRR + USD, FX table)', () => {
    const copied = policyFormOf(policy({ body: { defaultBasis: 'standard_cost', timeBasisRule: 'independent_components', fxPolicy: 'none', independentImpactCodeIds: ['c1'] }, reportingCurrencies: ['USD'] }));
    expect(copied).toMatchObject({ defaultBasis: 'standard_cost', timeBasisRule: 'independent_components', fxPolicy: 'none', reportingCurrencies: ['USD'], independentImpactCodeIds: ['c1'], effectiveFrom: '' });
    expect(policyFormOf(null)).toMatchObject({ defaultBasis: 'contribution_margin', timeBasisRule: 'exclusive', fxPolicy: 'snapshot', reportingCurrencies: ['IRR', 'USD'] });
  });

  it('validates start and currencies; impact codes are sent only for independent components', () => {
    const values = { ...policyFormOf(null), effectiveFrom: '2026-11-01T06:00', independentImpactCodeIds: ['c1'] };
    expect(validatePolicyForm(values, TZ)).toEqual({});
    expect(policyCreateBody(values, TZ)).toEqual({
      defaultBasis: 'contribution_margin', timeBasisRule: 'exclusive', reportingCurrencies: ['IRR', 'USD'], fxPolicy: 'snapshot',
      independentImpactCodeIds: [], effectiveFrom: '2026-11-01T02:30:00.000Z', notes: null,
    });
    expect(validatePolicyForm({ ...values, effectiveFrom: '', reportingCurrencies: [] }, TZ)).toEqual({
      effectiveFrom: 'effectiveFrom is required', reportingCurrencies: 'reportingCurrencies must contain at least 1 elements',
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
