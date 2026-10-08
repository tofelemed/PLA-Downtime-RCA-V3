import {
  changedFields,
  CODING_FIELDS,
  completeFacts,
  EFFECTIVE_FIELDS,
  factsOf,
  normalizeFacts,
  normalizeValue,
  SOURCE_FIELDS,
} from './event-facts';

describe('event facts (plan 1.2)', () => {
  describe('normalizeValue', () => {
    it('turns Dates and date strings of date fields into ISO with milliseconds', () => {
      const iso = '2026-10-08T06:00:00.000Z';
      expect(normalizeValue('startTime', new Date(iso))).toBe(iso);
      expect(normalizeValue('endTime', '2026-10-08T06:00:00Z')).toBe(iso);
      expect(normalizeValue('startTime', '2026-10-08T08:00:00+02:00')).toBe(
        iso,
      );
    });

    it('keeps an unparseable date string as it is', () => {
      expect(normalizeValue('startTime', 'yesterday')).toBe('yesterday');
    });

    it('parses numeric strings of numeric fields only', () => {
      expect(normalizeValue('quantity', '12.50000000')).toBe(12.5);
      expect(normalizeValue('impactFraction', '0.25')).toBe(0.25);
      expect(normalizeValue('shift', '1')).toBe('1');
      expect(normalizeValue('quantity', 'n/a')).toBe('n/a');
    });

    it("maps '' to null and keeps undefined undefined", () => {
      expect(normalizeValue('description', '')).toBeNull();
      expect(normalizeValue('description', null)).toBeNull();
      expect(normalizeValue('description', undefined)).toBeUndefined();
    });

    it('keeps booleans and numbers, serialises other objects', () => {
      expect(normalizeValue('x', true)).toBe(true);
      expect(normalizeValue('cost', 3)).toBe(3);
      expect(normalizeValue('x', { a: 1 })).toBe('{"a":1}');
    });
  });

  describe('normalizeFacts / factsOf', () => {
    it('restricts to the field list and drops undefined entries', () => {
      const facts = normalizeFacts(
        { startTime: new Date('2026-10-08T06:00:00Z'), cost: '5', other: 1 },
        ['startTime', 'endTime', 'cost'],
      );
      expect(facts).toEqual({ startTime: '2026-10-08T06:00:00.000Z', cost: 5 });
    });

    it('reads an entity-shaped object; driver strings and parsed numbers compare equal', () => {
      const fromDriver = factsOf(
        { quantity: '12.50000000', reasonCodeId: null },
        ['quantity', 'reasonCodeId'],
      );
      const fromApp = factsOf({ quantity: 12.5, reasonCodeId: null }, [
        'quantity',
        'reasonCodeId',
      ]);
      expect(fromDriver).toEqual(fromApp);
      expect(fromApp).toEqual({ quantity: 12.5, reasonCodeId: null });
    });
  });

  describe('completeFacts', () => {
    it('fills every field, missing ones as null', () => {
      expect(completeFacts({ a: 1 }, ['a', 'b'])).toEqual({ a: 1, b: null });
    });
  });

  describe('changedFields', () => {
    it('lists fields whose values differ; missing counts as null', () => {
      expect(
        changedFields(
          { startTime: 'a', endTime: null, cost: 1 },
          { startTime: 'a', cost: 2, severity: 'High' },
        ),
      ).toEqual(['cost', 'severity']);
    });

    it('is empty for identical content', () => {
      const facts = { startTime: 'a', quantity: 3 };
      expect(changedFields(facts, { ...facts })).toEqual([]);
    });

    it('detects a value cleared to null', () => {
      expect(changedFields({ endTime: 'x' }, { endTime: null })).toEqual([
        'endTime',
      ]);
    });
  });

  describe('field sets', () => {
    it('effective = source ∪ coding ∪ state, without duplicates', () => {
      for (const field of [...SOURCE_FIELDS, ...CODING_FIELDS]) {
        expect(EFFECTIVE_FIELDS).toContain(field);
      }
      expect(new Set(EFFECTIVE_FIELDS).size).toBe(EFFECTIVE_FIELDS.length);
      expect(EFFECTIVE_FIELDS).toEqual(
        expect.arrayContaining([
          'physicalState',
          'codingState',
          'rcaState',
          'status',
        ]),
      );
    });

    it('never lets the source own coding or workflow fields', () => {
      for (const field of ['reasonCodeId', 'rcaId', 'status', 'codingState']) {
        expect(SOURCE_FIELDS as readonly string[]).not.toContain(field);
      }
    });
  });
});
