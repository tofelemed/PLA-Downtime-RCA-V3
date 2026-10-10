import { legacyEventTokens } from '../remediation/jobs/legacy-value-jobs';
import { CountSnapshot, lostSourceRows } from './cutover-report';
import { formatCounts, markdownTable } from './markdown';

const snapshot = (counts: Record<string, number | null>): CountSnapshot => ({
  database: 'proact_test',
  generatedAt: '2026-01-01T00:00:00.000Z',
  counts,
});

describe('cutover report helpers (plan 3.10)', () => {
  it('flags a legacy table that lost rows and ignores growth, v2 tables and absent tables', () => {
    const before = snapshot({
      production_events: 10,
      reconcile_forms: 2,
      loss_lines: 5,
      pi_events: null,
    });
    const after = snapshot({
      production_events: 9,
      reconcile_forms: 3,
      loss_lines: 0,
      pi_events: 4,
    });
    expect(lostSourceRows(before, after)).toEqual(['production_events']);
    expect(lostSourceRows(before, before)).toEqual([]);
  });

  it('renders markdown tables with escaped pipes and an empty marker', () => {
    expect(markdownTable([])).toBe('_none_');
    expect(markdownTable([{ a: 'x|y', b: null }])).toBe(
      '| a | b |\n| --- | --- |\n| x\\|y |  |',
    );
    expect(formatCounts({ a: 2, b: 0 })).toBe('a: 2');
    expect(formatCounts({})).toBe('—');
  });
});

describe('legacyEventTokens (§18.2 explicit event ids only)', () => {
  it.each([
    [null, []],
    ['', []],
    [
      'b1d0c1a2-0000-4000-8000-000000000001',
      ['b1d0c1a2-0000-4000-8000-000000000001'],
    ],
    ['a, b;c  d', ['a', 'b', 'c', 'd']],
    ['["x","y"]', ['x', 'y']],
    ['[not json', ['[not json']],
  ])('%p → %p', (raw, tokens) => {
    expect(legacyEventTokens(raw)).toEqual(tokens);
  });
});
