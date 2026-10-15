import { SourceStatusMapping } from './entities/source-status-mapping.entity';
import { inForceIdsOf } from './source-status-mappings.service';

const mapping = (
  id: string,
  over: Partial<SourceStatusMapping>,
): SourceStatusMapping =>
  ({
    id,
    sourceSystem: 'lims',
    version: 1,
    state: 'approved',
    effectiveFrom: new Date('2026-01-01T00:00:00Z'),
    effectiveTo: null,
    ...over,
  }) as SourceStatusMapping;

/** SME R13: which approved version a source's imports use now (shown on the mapping screen). */
describe('inForceIdsOf', () => {
  const at = new Date('2026-10-15T00:00:00Z');

  it('picks per source the approved version whose interval contains the instant', () => {
    const ids = inForceIdsOf(
      [
        mapping('v1', { effectiveTo: new Date('2026-06-01T00:00:00Z') }),
        mapping('v2', {
          version: 2,
          effectiveFrom: new Date('2026-06-01T00:00:00Z'),
        }),
        mapping('import-1', { sourceSystem: 'import' }),
      ],
      at,
    );
    expect([...ids].sort()).toEqual(['import-1', 'v2']);
  });

  it('ignores drafts, future versions and ended ones', () => {
    const ids = inForceIdsOf(
      [
        mapping('draft', { state: 'draft', version: 3 }),
        mapping('future', {
          version: 4,
          effectiveFrom: new Date('2027-01-01T00:00:00Z'),
        }),
        mapping('ended', { effectiveTo: at }),
      ],
      at,
    );
    expect(ids.size).toBe(0);
  });
});
