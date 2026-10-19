import { describe, expect, it } from 'vitest';
import type { CodeView } from '@/api/v2/types/flags';
import { drillCrumbs, drillParamOf, drillSelectionOf, subtreeIds } from './reason-drill';

const code = (id: string, parentId: string | null, path: string, active = true) =>
  ({
    id,
    code: id.toUpperCase(),
    name: `Reason ${id}`,
    parentId,
    path,
    active,
  }) as CodeView;

const library = [code('m', null, 'm'), code('p', 'm', 'm/p'), code('old', 'm', 'm/old', false)];

describe('reason drill over the whole library (FE-05)', () => {
  it('lists the events of retired child codes under a drilled group', () => {
    expect(subtreeIds('m', library)).toEqual(['m', 'old', 'p']);
  });

  it('names a retired code on the breadcrumb, marked', () => {
    expect(drillCrumbs(['m', 'old', 'gone'], library).map((c) => c.label)).toEqual([
      'M · Reason m',
      'OLD · Reason old (retired)',
      'Unknown reason',
    ]);
  });
});

describe('listed Pareto bar in the URL (QA audit L15)', () => {
  const group = (key: string | null, label: string | null) => ({ key, label, value: '3600', share: '0.5', cumulativeShare: '0.5', periods: 1 });
  const report = { unit: 's' as const, groups: [group('p', 'P · Reason p'), group(null, null), group('m', 'M · Reason m')] };
  const level = { path: ['m'], codes: library };

  it('restores a leaf bar and the not-coded bar from the URL value', () => {
    expect(drillSelectionOf('p', report, level)).toMatchObject({ reasonId: 'p', label: 'P · Reason p', unit: 's' });
    expect(drillSelectionOf('uncoded', report, level)).toMatchObject({ reasonId: null, label: 'Not coded' });
    expect(drillParamOf({ reasonId: null })).toBe('uncoded');
    expect(drillParamOf({ reasonId: 'p' })).toBe('p');
  });

  it('ignores a value that is no longer a listed bar of this level, or a bar that drills deeper', () => {
    expect(drillSelectionOf('gone', report, level)).toBeNull();
    expect(drillSelectionOf(null, report, level)).toBeNull();
    expect(drillSelectionOf('p', undefined, level)).toBeNull();
    expect(drillSelectionOf('m', report, { path: [], codes: library })).toBeNull();
  });
});
