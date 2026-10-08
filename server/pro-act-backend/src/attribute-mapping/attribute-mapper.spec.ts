import { convertValue, parseTimeSpan } from './attribute-conversion';
import { mapAttributes } from './attribute-mapper';
import {
  defaultRulesFor,
  legacyRules,
  mergeRules,
  ruleErrors,
} from './attribute-rules';
import { FieldRule } from './field-rule';

const START = new Date('2026-10-08T06:00:00Z');
const at = (minutes: number) => new Date(START.getTime() + minutes * 60_000);

/** Plan 1.3 step 4 (ING04, B7, I4, I10): typed conversion, digital states, TimeSpan, per-field merge. */
describe('typed attribute mapping', () => {
  describe('conversion', () => {
    const digital: FieldRule = {
      sourceAttr: 'ReasonCode',
      targetField: 'reason',
      type: 'digital',
    };

    it('keeps digital state Name and Value (never [object Object])', () => {
      expect(
        convertValue(digital, { Name: 'Bearing', Value: 3, IsSystem: false }),
      ).toEqual({
        ok: true,
        value: { name: 'Bearing', value: 3, isSystem: false },
      });
      const text: FieldRule = {
        ...digital,
        targetField: 'severity',
        type: 'string',
      };
      expect(convertValue(text, { Name: 'High', Value: 2 })).toEqual({
        ok: true,
        value: 'High',
      });
    });

    it('unwraps PI stream value objects', () => {
      const number: FieldRule = {
        sourceAttr: 'Quantity',
        targetField: 'quantity',
        type: 'number',
      };
      expect(convertValue(number, { Timestamp: 'x', Value: '12.5' })).toEqual({
        ok: true,
        value: 12.5,
      });
    });

    it('reports a type mismatch instead of NaN', () => {
      const number: FieldRule = {
        sourceAttr: 'Quantity',
        targetField: 'quantity',
        type: 'number',
      };
      const result = convertValue(number, '00:15:00');
      expect(result).toMatchObject({
        ok: false,
        diagnostic: { code: 'TYPE_MISMATCH', field: 'quantity' },
      });
    });

    it('parses TimeSpan only under an explicit timespan unit', () => {
      expect(parseTimeSpan('00:15:00')).toBe(900);
      expect(parseTimeSpan('1.02:00:30.5')).toBe(93630.5);
      expect(parseTimeSpan('00:75:00')).toBeNull();
      const rule: FieldRule = {
        sourceAttr: 'Duration',
        targetField: 'suppliedDurationSeconds',
        type: 'duration',
        unit: 'timespan',
      };
      expect(convertValue(rule, '00:15:00')).toEqual({ ok: true, value: 900 });
      expect(
        convertValue({ ...rule, unit: 'minutes' }, '00:15:00'),
      ).toMatchObject({
        ok: false,
        diagnostic: { code: 'DURATION_UNPARSEABLE' },
      });
      expect(convertValue({ ...rule, unit: 'minutes' }, 15)).toEqual({
        ok: true,
        value: 900,
      });
      expect(convertValue({ ...rule, unit: undefined }, 15)).toMatchObject({
        ok: false,
        diagnostic: { code: 'DURATION_UNIT_MISSING' },
      });
    });
  });

  describe('mapAttributes', () => {
    const rules: FieldRule[] = [
      { sourceAttr: 'ReasonCode', targetField: 'reason', type: 'digital' },
      {
        sourceAttr: 'Duration',
        targetField: 'suppliedDurationSeconds',
        type: 'duration',
        unit: 'timespan',
      },
      {
        sourceAttr: 'GoodQty',
        aliases: ['Quantity'],
        targetField: 'quantity',
        type: 'number',
      },
    ];
    const attributes = {
      ReasonCode: { Name: 'Bearing', Value: 3, IsSystem: false },
      Duration: '00:15:00',
      Quantity: 7,
    };

    it('splits column fields from source facts and uses aliases in order', () => {
      const result = mapAttributes(rules, attributes, {
        start: START,
        end: at(15),
      });
      expect(result.columns).toEqual({ quantity: 7 });
      expect(result.facts).toEqual({
        reason: { name: 'Bearing', value: 3, isSystem: false },
        suppliedDurationSeconds: 900,
      });
      expect(result.diagnostics).toEqual([]);
    });

    it('lets the timestamps win over a different supplied duration (diagnostic)', () => {
      const result = mapAttributes(rules, attributes, {
        start: START,
        end: at(20),
      });
      expect(result.facts.suppliedDurationSeconds).toBe(900);
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: 'DURATION_MISMATCH',
          field: 'suppliedDurationSeconds',
        }),
      ]);
    });

    it('reports unknown fields and missing required attributes', () => {
      const result = mapAttributes(
        [
          { sourceAttr: 'X', targetField: 'healthIndex', type: 'number' },
          {
            sourceAttr: 'Shift',
            targetField: 'shift',
            type: 'string',
            required: true,
          },
        ],
        {},
        { start: START, end: null },
      );
      expect(result.diagnostics.map((entry) => entry.code)).toEqual([
        'UNKNOWN_FIELD',
        'REQUIRED_MISSING',
      ]);
    });
  });

  describe('rule layers', () => {
    it('merges overrides field by field instead of replacing the template map (I10)', () => {
      const merged = mergeRules(defaultRulesFor('Production Loss'), [
        {
          sourceAttr: 'Dur',
          targetField: 'suppliedDurationSeconds',
          type: 'duration',
          unit: 'timespan',
        },
      ]);
      expect(
        merged.find((r) => r.targetField === 'suppliedDurationSeconds'),
      ).toMatchObject({
        sourceAttr: 'Dur',
        unit: 'timespan',
      });
      expect(merged.find((r) => r.targetField === 'quantity')).toMatchObject({
        sourceAttr: 'Quantity',
      });
      expect(merged).toHaveLength(defaultRulesFor('Production Loss').length);
    });

    it('translates legacy v1 targets (reasonCodeId, goodQty, duration in minutes)', () => {
      expect(
        legacyRules({ RC: 'reasonCodeId', Good: 'goodQty', D: 'duration' }),
      ).toEqual([
        { sourceAttr: 'RC', targetField: 'reason', type: 'digital' },
        { sourceAttr: 'Good', targetField: 'quantity', type: 'number' },
        {
          sourceAttr: 'D',
          targetField: 'suppliedDurationSeconds',
          type: 'duration',
          unit: 'minutes',
        },
      ]);
    });

    it('validates tenant rules against the catalog', () => {
      expect(
        ruleErrors('Production Loss', [
          { sourceAttr: 'A', targetField: 'nope', type: 'string' },
          { sourceAttr: 'B', targetField: 'quantity', type: 'digital' },
          {
            sourceAttr: 'C',
            targetField: 'suppliedDurationSeconds',
            type: 'duration',
          },
          { sourceAttr: 'D', targetField: 'shift', type: 'string' },
          { sourceAttr: 'E', targetField: 'shift', type: 'string' },
        ]),
      ).toHaveLength(4);
    });
  });
});
