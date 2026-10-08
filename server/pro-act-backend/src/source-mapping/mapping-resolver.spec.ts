import { MappingResolver } from './mapping-resolver';
import {
  compileGlob,
  MappingRule,
  MatchKind,
  normalizeMatchValue,
  normalizePath,
} from './mapping-rule';

let sequence = 0;
function rule(
  kind: MatchKind,
  value: string,
  targetId: string,
  extra: Partial<MappingRule> = {},
): MappingRule {
  sequence += 1;
  return {
    id: `rule-${String(sequence).padStart(3, '0')}`,
    kind,
    normalizedValue: normalizeMatchValue(kind, value),
    precedence: 0,
    connectionId: null,
    targetType: 'unit',
    targetId,
    version: 1,
    origin: 'source_mapping',
    ...extra,
  };
}

const PATH = '\\\\PIAF01\\HDPE\\unit100\\Extruder';
const SAMPLE = {
  sourceId: 'EL-1',
  sourcePath: PATH,
  afElementWebIds: ['EL-1', 'EL-PARENT'],
};

/** Plan 1.3 step 3 (ING03, I7): deterministic precedence, separator normalisation, ambiguity. */
describe('source mapping resolution', () => {
  describe('normalisation', () => {
    it('treats \\ and / alike, collapses runs, trims and lower-cases paths', () => {
      expect(normalizePath(' \\\\PIAF01\\HDPE//unit100\\ ')).toBe(
        'piaf01/hdpe/unit100',
      );
      expect(normalizePath('piaf01/hdpe/unit100/')).toBe('piaf01/hdpe/unit100');
    });

    it('compares source ids exactly', () => {
      expect(normalizeMatchValue('exact_id', ' F1EmAbC ')).toBe('F1EmAbC');
    });

    it('globs: * spans separators, ? is one character, [*] is a literal star', () => {
      expect(
        compileGlob(normalizePath('\\\\PIAF01\\HDPE\\*')).test(
          'piaf01/hdpe/unit100/extruder',
        ),
      ).toBe(true);
      expect(compileGlob('unit?00').test('unit100')).toBe(true);
      expect(compileGlob('unit?00').test('unit1000')).toBe(false);
      expect(compileGlob('a[*]b').test('a*b')).toBe(true);
      expect(compileGlob('a[*]b').test('axb')).toBe(false);
      expect(compileGlob('a.b').test('axb')).toBe(false);
    });
  });

  describe('precedence table', () => {
    const exactId = rule('exact_id', 'EL-1', 'unit-id');
    const exactPath = rule(
      'exact_path',
      'PIAF01/HDPE/unit100/Extruder',
      'unit-path',
    );
    const pattern = rule(
      'pattern',
      '\\\\PIAF01\\HDPE\\unit100\\*',
      'unit-pattern',
    );
    const binding = rule('af_binding', 'EL-1', 'unit-binding', {
      origin: 'af_binding',
    });
    const cases: Array<[string, MappingRule[], string]> = [
      [
        'exact id beats path, pattern and binding',
        [binding, pattern, exactPath, exactId],
        'unit-id',
      ],
      [
        'exact path beats pattern and binding',
        [binding, pattern, exactPath],
        'unit-path',
      ],
      ['pattern beats binding', [binding, pattern], 'unit-pattern'],
      ['binding is the last resort', [binding], 'unit-binding'],
    ];

    it.each(cases)('%s', (_name, rules, expected) => {
      const resolution = new MappingResolver(rules).resolve(SAMPLE);
      expect(resolution).toMatchObject({
        status: 'mapped',
        rule: { targetId: expected },
      });
    });

    it('matches a backslash pattern against a forward-slash path (I7)', () => {
      const resolver = new MappingResolver([
        rule('pattern', '\\\\piaf01\\hdpe\\*', 'unit-a'),
      ]);
      expect(
        resolver.resolve({ sourcePath: 'PIAF01/HDPE/unit200/Pump' }),
      ).toMatchObject({
        status: 'mapped',
        tier: 'pattern',
      });
    });

    it('walks up the AF element chain', () => {
      const resolver = new MappingResolver([
        rule('af_binding', 'EL-PARENT', 'unit-parent', {
          origin: 'af_binding',
        }),
      ]);
      expect(resolver.resolve(SAMPLE)).toMatchObject({
        rule: { targetId: 'unit-parent' },
      });
    });

    it('never matches by substring (an exact path is not a prefix rule)', () => {
      const resolver = new MappingResolver([
        rule('exact_path', '\\\\PIAF01\\HDPE', 'unit-a'),
      ]);
      expect(resolver.resolve({ sourcePath: PATH })).toEqual({
        status: 'unmapped',
      });
    });
  });

  describe('ambiguity', () => {
    it('two patterns of equal precedence with different targets are ambiguous', () => {
      const resolver = new MappingResolver([
        rule('pattern', 'piaf01/hdpe/*', 'unit-a'),
        rule('pattern', '*/unit100/*', 'unit-b'),
      ]);
      const resolution = resolver.resolve(SAMPLE);
      expect(resolution).toMatchObject({
        status: 'ambiguous',
        tier: 'pattern',
      });
      expect(
        resolution.status === 'ambiguous' && resolution.candidates,
      ).toHaveLength(2);
    });

    it('a higher precedence pattern wins over a lower one', () => {
      const resolver = new MappingResolver([
        rule('pattern', 'piaf01/hdpe/*', 'unit-a'),
        rule('pattern', '*/unit100/*', 'unit-b', { precedence: 10 }),
      ]);
      expect(resolver.resolve(SAMPLE)).toMatchObject({
        rule: { targetId: 'unit-b' },
      });
    });

    it('hits pointing at the same target are not ambiguous', () => {
      const resolver = new MappingResolver([
        rule('af_binding', 'EL-1', 'unit-a'),
        rule('af_binding', 'EL-1', 'unit-a', { origin: 'af_binding' }),
      ]);
      expect(resolver.resolve(SAMPLE)).toMatchObject({
        status: 'mapped',
        rule: { origin: 'source_mapping' },
      });
    });

    it('a rule for the connection beats an any-connection rule', () => {
      const resolver = new MappingResolver([
        rule('exact_id', 'EL-1', 'unit-any'),
        rule('exact_id', 'EL-1', 'unit-conn', { connectionId: 'conn-1' }),
      ]);
      expect(resolver.resolve(SAMPLE)).toMatchObject({
        rule: { targetId: 'unit-conn' },
      });
    });
  });
});
