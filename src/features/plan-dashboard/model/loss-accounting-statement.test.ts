import { describe, expect, it } from 'vitest';
import type { LossStatementView } from '@/api/v2/types/loss-statement';
import { identityText, recoveryLabel, statementMarker, statementRows } from './loss-accounting-statement';
import { backEventOf, groupByDay, statementCsv, statementHref } from '@/features/pla-analytics/model/statement-page';

const OWNER: LossStatementView = {
  planned: '240',
  actual: '208',
  shortfall: '32',
  availability: '23',
  performance: '11',
  quality: '6',
  transitionExcess: '0',
  unaccountedClassified: '0',
  grossAttributed: '40',
  recovery: '8',
  recoveryVerified: true,
  netAccounted: '32',
  toleranceAdjustment: '0',
  unaccounted: '0',
  uom: 't',
  revisionState: 'approved',
};

describe('loss accounting statement model (Task 13)', () => {
  it("lists the owner's ten rows in order, the recovery shown negative and the totals marked", () => {
    const rows = statementRows(OWNER);
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ['Planned production', '240'],
      ['Actual good production', '208'],
      ['Production shortfall', '32'],
      ['Equipment downtime loss', '23'],
      ['Reduced throughput loss', '11'],
      ['Quality loss', '6'],
      ['Gross attributed loss', '40'],
      ['Verified recovery', '8'],
      ['Net accounted loss', '32'],
      ['Unaccounted loss', '0'],
    ]);
    expect(rows.find((r) => r.key === 'recovery')?.negative).toBe(true);
    expect(rows.filter((r) => r.total).map((r) => r.key)).toEqual(['grossAttributed', 'netAccounted']);
    expect(rows.every((r) => r.info.length > 0)).toBe(true);
  });

  it('shows transition, classified and tolerance rows only when they are not zero', () => {
    const rows = statementRows({ ...OWNER, transitionExcess: '2', toleranceAdjustment: '0.5', unaccounted: '-0.5' });
    expect(rows.map((r) => r.key)).toContain('transitionExcess');
    expect(rows.map((r) => r.key)).toContain('toleranceAdjustment');
    expect(rows.map((r) => r.key)).not.toContain('unaccountedClassified');
  });

  it('a zero statement keeps every mandatory row; unknown figures stay null, never 0', () => {
    const zero = { ...OWNER, planned: null, actual: null, shortfall: null, unaccounted: null, availability: '0', performance: '0', quality: '0', grossAttributed: '0', recovery: '0', netAccounted: '0' };
    const rows = statementRows(zero);
    expect(rows).toHaveLength(10);
    expect(rows.find((r) => r.key === 'shortfall')?.value).toBeNull();
  });

  it('marks the statement Approved or Provisional, and an unverified recovery by its label only', () => {
    expect(statementMarker(OWNER)).toBe('Approved');
    expect(statementMarker({ ...OWNER, revisionState: 'provisional' })).toBe('Provisional');
    expect(recoveryLabel({ ...OWNER, recoveryVerified: false })).toBe('Recovery (unverified)');
    expect(statementRows({ ...OWNER, recoveryVerified: false }).find((r) => r.key === 'recovery')?.value).toBe('8');
  });

  it('writes the identity line with the formatted server figures', () => {
    expect(identityText((v) => `${v} t`, OWNER)).toBe('Shortfall 32 t = net accounted 32 t + unaccounted 0 t; net accounted = gross attributed 40 t − recovery 8 t');
  });
});

describe('statement page model', () => {
  const row = { periodId: 'p1', planId: null, unitId: 'u1', unitName: 'Train, A', localDate: '2026-10-29', shiftName: 'A', grain: 'shift' as const, basis: 'computed' as const, revisionState: 'approved' as const, statement: OWNER };

  it('groups shifts under their day in server order', () => {
    const days = groupByDay([row, { ...row, periodId: 'p2', shiftName: 'B' }, { ...row, periodId: 'p3', localDate: '2026-10-30' }]);
    expect(days.map((d) => [d.localDate, d.rows.length])).toEqual([['2026-10-29', 2], ['2026-10-30', 1]]);
  });

  it('exports the rows as the server sent them, quoting text with commas', () => {
    const [header, line] = statementCsv([row]).split('\n');
    expect(header.startsWith('Date,Unit,Shift,Grain,Basis,Revision,Planned production')).toBe(true);
    expect(line).toBe('2026-10-29,"Train, A",A,shift,computed,approved,240,208,32,23,11,6,0,0,40,8,32,0,0,yes,t');
  });

  it('guards against formula injection; negative decimals stay numbers', () => {
    const [, line] = statementCsv([{ ...row, unitName: '=HYPERLINK("http://x","y")', shiftName: '@B', statement: { ...OWNER, unaccounted: '-8' } }]).split('\n');
    expect(line.startsWith('2026-10-29,"\'=HYPERLINK(""http://x"",""y"")","\'@B",')).toBe(true);
    expect(line).toContain(',-8,yes,t');
  });

  it('links an event to the statement of its period and back', () => {
    const href = statementHref({ unitId: 'u1', utcStart: '2026-10-29T02:30:00.000Z', utcEnd: '2026-10-30T02:30:00.000Z', periodId: 'p1', eventId: 'e1' });
    const params = new URL(href, 'http://x').searchParams;
    expect(href.startsWith('/pla-analytics/statement?')).toBe(true);
    expect(Object.fromEntries(params)).toEqual({ from: '2026-10-29T02:30:00.000Z', to: '2026-10-30T02:30:00.000Z', window: 'dates', units: 'u1', focus: 'p1', source: 'event:e1' });
    expect(backEventOf(params)).toBe('e1');
    expect(backEventOf(new URLSearchParams('source=report'))).toBeNull();
  });
});
