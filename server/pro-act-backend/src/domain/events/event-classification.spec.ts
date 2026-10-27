import {
  classifyLegacyEventType,
  PHYSICAL_TYPES,
} from './event-classification';

describe('production_loss event kind (declared mode)', () => {
  it('is a physical type', () => {
    expect(PHYSICAL_TYPES).toContain('production_loss');
  });

  it('is never derived from a legacy event type: only a declaration creates it', () => {
    for (const type of ['ProductionLoss', 'ProductionOutput', 'IOW', null]) {
      expect(classifyLegacyEventType(type).physicalType).not.toBe(
        'production_loss',
      );
    }
  });
});
