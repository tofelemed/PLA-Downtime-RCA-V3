import { OVERRIDABLE_FIELDS } from '../../production-event/revisions/event-facts';
import { INTERVAL_FIELDS, sourceOwnedFields } from './source-owned-fields';

describe('sourceOwnedFields (UX E-5)', () => {
  it('is empty for manual events', () => {
    expect(
      sourceOwnedFields({ sourceKind: 'manual', currentSourceRevision: 0 }),
    ).toEqual([]);
  });

  it('is the interval for a non-manual event without a source revision (writes refuse it)', () => {
    expect(
      sourceOwnedFields({ sourceKind: 'derived', currentSourceRevision: 0 }),
    ).toEqual([...INTERVAL_FIELDS]);
  });

  it('adds every overridable column once a source revision exists, never raw attribute facts', () => {
    const owned = sourceOwnedFields({
      sourceKind: 'source',
      currentSourceRevision: 2,
    });
    expect(owned).toEqual(expect.arrayContaining([...INTERVAL_FIELDS]));
    expect(owned).toEqual(
      expect.arrayContaining(['assetId', 'description', 'scheduleClass']),
    );
    expect(owned).not.toContain('reason');
    expect(owned).not.toContain('reasonCodeId');
    expect(new Set(owned).size).toBe(owned.length);
    for (const field of owned) {
      expect([...INTERVAL_FIELDS, ...OVERRIDABLE_FIELDS]).toContain(field);
    }
  });
});
