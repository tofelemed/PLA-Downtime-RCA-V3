import { consolidateSiteLoss, SiteLossRow } from './site-consolidation';

/**
 * SME E2 / Q13: reactor R feeds extruder X (the site boundary). R's 7 h stop is R's own loss (impact,
 * 7 h × 30 t/h = 210 t) and starves X for 2 h (40 t, charged to R); X also lost 15 t to its own trip.
 * The site loses 55 t — R's 210 t is not added again — of which 40 t originate in R.
 */
const rows: SiteLossRow[] = [
  {
    unitId: 'R',
    originUnitId: 'R',
    uom: 't',
    quantity: '210',
    lines: 1,
    upstream: true,
  },
  {
    unitId: 'X',
    originUnitId: 'R',
    uom: 't',
    quantity: '40',
    lines: 1,
    upstream: false,
  },
  {
    unitId: 'X',
    originUnitId: 'X',
    uom: 't',
    quantity: '15',
    lines: 2,
    upstream: false,
  },
];

describe('site-boundary consolidation (SME E2 / Q13)', () => {
  it('adds only the boundary units, attributed to the origin of each loss', () => {
    const view = consolidateSiteLoss(rows);
    expect(view.boundaryUnitIds).toEqual(['X']);
    expect(view.upstreamUnitIds).toEqual(['R']);
    expect(view.siteTotals).toEqual([{ uom: 't', quantity: '55' }]);
    expect(view.byOrigin).toEqual([
      { originUnitId: 'R', uom: 't', quantity: '40', lines: 1 },
      { originUnitId: 'X', uom: 't', quantity: '15', lines: 2 },
    ]);
  });

  it("keeps every unit's own loss as its impact", () => {
    expect(consolidateSiteLoss(rows).unitImpact).toEqual([
      { unitId: 'R', uom: 't', quantity: '210', upstream: true },
      { unitId: 'X', uom: 't', quantity: '55', upstream: false },
    ]);
  });

  it('a stop the buffer absorbed costs the site nothing', () => {
    const view = consolidateSiteLoss([rows[0]]);
    expect(view.siteTotals).toEqual([]);
    expect(view.unitImpact).toHaveLength(1);
  });
});
