import { assetPresenceRows } from './unit-asset-presence';

describe('assetPresenceRows', () => {
  it('maps rows to unitId and hasAssets', () => {
    expect(
      assetPresenceRows([
        { unitId: 'u1', has_assets: true },
        { unitId: 'u2', has_assets: false },
      ]),
    ).toEqual([
      { unitId: 'u1', hasAssets: true },
      { unitId: 'u2', hasAssets: false },
    ]);
  });

  it('returns an empty list for no units', () => {
    expect(assetPresenceRows([])).toEqual([]);
  });
});
