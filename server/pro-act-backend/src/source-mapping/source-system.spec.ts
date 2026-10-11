import { SourceHierarchyMapping } from '../hierarchy-mapping/entities/source-hierarchy-mapping.entity';
import { mirroredRows } from './legacy-mapping-mirror';
import {
  connectionSourceSystem,
  DEFAULT_SOURCE_SYSTEM,
  legacySourceSystem,
} from './source-system';

const TENANT = '11111111-1111-4111-8111-111111111111';
const UNIT = '22222222-2222-4222-8222-222222222222';

function legacyMapping(
  overrides: Partial<SourceHierarchyMapping>,
): SourceHierarchyMapping {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tenantId: TENANT,
    sourceType: 'PI',
    sourceIdentifier: 'EL-1',
    targetType: 'unit',
    targetId: UNIT,
    isPattern: false,
    priority: 50,
    isActive: true,
    ...overrides,
  } as SourceHierarchyMapping;
}

describe('source system vocabulary', () => {
  it('keeps a v1 source type as it is, PI when missing', () => {
    expect(legacySourceSystem('MQTT')).toBe('MQTT');
    expect(legacySourceSystem('PI')).toBe('PI');
    expect(legacySourceSystem('*')).toBe('*');
    expect(legacySourceSystem(' OPCUA ')).toBe('OPCUA');
    expect(legacySourceSystem(undefined)).toBe(DEFAULT_SOURCE_SYSTEM);
    expect(legacySourceSystem('  ')).toBe(DEFAULT_SOURCE_SYSTEM);
  });

  it('names the source system of a v2 connection type', () => {
    expect(connectionSourceSystem('mqtt')).toBe('MQTT');
    expect(connectionSourceSystem('pi_web_api')).toBe('PI');
    expect(connectionSourceSystem('rest_import')).toBe(DEFAULT_SOURCE_SYSTEM);
  });

  it('mirrors a v1 mapping under the source system its lookup resolves with', () => {
    for (const sourceType of ['PI', 'MQTT', '*'] as const) {
      const [row] = mirroredRows(legacyMapping({ sourceType }));
      expect(row.sourceSystem).toBe(legacySourceSystem(sourceType));
    }
  });
});
