import {
  checkFailureCodes,
  classOfAssetType,
  DictionaryEntryRef,
} from './failure-dictionary';
import {
  parseDictionaryImport,
  sameContent,
} from './failure-dictionary-import';

const entry = (
  kind: DictionaryEntryRef['kind'],
  code: string,
  extra: Partial<DictionaryEntryRef> = {},
): DictionaryEntryRef => ({
  kind,
  code,
  name: code,
  equipmentClass: '',
  assetTypes: [],
  ...extra,
});

/** SME D11 worked example: pump P-101, seal, external leakage, wear, inadequate flush, inspection. */
const DICTIONARY: DictionaryEntryRef[] = [
  entry('equipment_class', 'PU', { name: 'Pumps', assetTypes: ['Pump'] }),
  entry('equipment_class', 'EM', { name: 'Electric motors' }),
  entry('maintainable_item', 'SEAL', { equipmentClass: 'PU' }),
  entry('maintainable_item', 'BRG', { equipmentClass: 'EM' }),
  entry('maintainable_item', 'UNK'),
  entry('failure_mode', 'ELP', { equipmentClass: 'PU' }),
  entry('failure_mode', 'OHE', { equipmentClass: 'EM' }),
  entry('failure_mechanism', '1.1'),
  entry('failure_cause', '4.1'),
];

describe('failure dictionary (SME D11)', () => {
  it('finds the class of an asset type by its list, code or name', () => {
    expect(classOfAssetType(DICTIONARY, 'pump')).toBe('PU');
    expect(classOfAssetType(DICTIONARY, 'Electric motors')).toBe('EM');
    expect(classOfAssetType(DICTIONARY, 'Gearbox')).toBeNull();
    expect(classOfAssetType(DICTIONARY, null)).toBeNull();
  });

  it('accepts codes of the asset class and codes valid for every class', () => {
    expect(
      checkFailureCodes(
        {
          maintainableItem: 'SEAL',
          failureMode: 'ELP',
          failureMechanism: '1.1',
          failureCause: '4.1',
        },
        DICTIONARY,
        'PU',
      ),
    ).toEqual([]);
    expect(
      checkFailureCodes({ maintainableItem: 'UNK' }, DICTIONARY, 'PU'),
    ).toEqual([]);
  });

  it('refuses a code of another class and an unknown code', () => {
    const problems = checkFailureCodes(
      { maintainableItem: 'BRG', failureCause: 'lubrication' },
      DICTIONARY,
      'PU',
    );
    expect(problems.map((p) => p.field)).toEqual([
      'maintainableItem',
      'failureCause',
    ]);
    expect(problems[0].message).toContain('equipment class PU');
  });

  it('a class-bound code of any class is accepted when the asset class is unknown', () => {
    expect(checkFailureCodes({ failureMode: 'OHE' }, DICTIONARY, null)).toEqual(
      [],
    );
  });

  it('a kind without entries stays free text; null and empty are never checked', () => {
    expect(
      checkFailureCodes({ detectionMethod: 'Inspection' }, DICTIONARY, 'PU'),
    ).toEqual([]);
    expect(
      checkFailureCodes(
        { failureMode: null, failureCause: '  ' },
        DICTIONARY,
        'PU',
      ),
    ).toEqual([]);
    expect(checkFailureCodes({ failureMode: 'anything' }, [], null)).toEqual(
      [],
    );
  });
});

describe('failure dictionary import', () => {
  const csv = [
    'kind,equipmentClass,code,name,assetTypes,isPending,category',
    'equipment_class,,CO,Compressors,Compressor;Blower,,',
    'maintainable_item,CO,VALVE,Valves,,,',
    'failure_mode,CO,UNK,"Unknown, pending investigation",,yes,',
    'failure_mechanism,,1.1,Leakage,,,Mechanical failure',
  ].join('\n');

  it('reads CSV rows (assetTypes separated by ;, isPending yes/no)', () => {
    const parsed = parseDictionaryImport({ csv }, new Set());
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows.map((r) => [r.kind, r.code, r.line])).toEqual([
      ['equipment_class', 'CO', 2],
      ['maintainable_item', 'VALVE', 3],
      ['failure_mode', 'UNK', 4],
      ['failure_mechanism', '1.1', 5],
    ]);
    expect(parsed.rows[0].assetTypes).toEqual(['Compressor', 'Blower']);
    expect(parsed.rows[2]).toMatchObject({
      isPending: true,
      name: 'Unknown, pending investigation',
    });
    expect(parsed.rows[3].category).toBe('Mechanical failure');
  });

  it('reports bad rows by line and keeps the good ones', () => {
    const parsed = parseDictionaryImport(
      {
        entries: [
          { kind: 'failure_mode', equipmentClass: 'XX', code: 'A', name: 'a' },
          { kind: 'failure_cause', equipmentClass: 'PU', code: 'B', name: 'b' },
          { kind: 'nonsense', code: 'C', name: 'c' },
          { kind: 'failure_mode', equipmentClass: 'PU', code: 'D', name: 'd' },
          {
            kind: 'failure_mode',
            equipmentClass: 'PU',
            code: 'D',
            name: 'd again',
          },
        ],
      },
      new Set(['PU']),
    );
    expect(parsed.rows.map((r) => r.code)).toEqual(['D']);
    expect(parsed.errors.map((e) => e.line)).toEqual([1, 2, 3, 5]);
  });

  it('refuses an empty document', () => {
    expect(
      parseDictionaryImport({ entries: [] }, new Set()).errors,
    ).toHaveLength(1);
  });

  it('compares content regardless of asset type order', () => {
    const base = {
      kind: 'equipment_class' as const,
      equipmentClass: '',
      code: 'PU',
      name: 'Pumps',
      description: null,
      category: null,
      assetTypes: ['Pump', 'Dosing pump'],
      isPending: false,
    };
    expect(
      sameContent(base, { ...base, assetTypes: ['Dosing pump', 'Pump'] }),
    ).toBe(true);
    expect(sameContent(base, { ...base, name: 'Centrifugal pumps' })).toBe(
      false,
    );
  });
});
