import { describe, expect, it } from 'vitest';
import type { DowntimeGroupView } from '@/api/v2/types/reports';
import type { DowntimeFilters } from './downtime-filters';
import { assetStartRca, reasonStartRca } from './start-rca-context';

const filters = (unitIds: string[]) => ({ unitIds, windowLabel: 'last 7 days' }) as DowntimeFilters;
const group = (key: string | null, label: string | null) => ({ key, label }) as DowntimeGroupView;

describe('Start RCA prefill from downtime analysis (item 4)', () => {
  it('prefills a reason case with the window and the single selected unit', () => {
    expect(reasonStartRca(group('r1', 'Die plate'), 'Die plate', filters(['u-1']))).toEqual({
      unitId: 'u-1',
      title: 'Recurring downtime: Die plate',
      description: 'Downtime coded “Die plate” stands out in the reason Pareto for last 7 days. Link the stops behind it from Links.',
    });
  });

  it('leaves the unit open for several units and offers nothing for not-coded or asset-less groups', () => {
    expect(assetStartRca(group('a1', 'P-101'), filters(['u-1', 'u-2']))).toMatchObject({ unitId: null, title: 'Bad actor: P-101' });
    expect(reasonStartRca(group(null, null), 'Not coded', filters([]))).toBeNull();
    expect(assetStartRca(group(null, null), filters([]))).toBeNull();
  });
});
