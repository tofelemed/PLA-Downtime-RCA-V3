import { applyCodeDefaults } from './classification-basis';
import { CodeEntry, editDistance, matchCode } from './code-matching';
import { isValidFailureParent, placement, wouldCycle } from './code-tree';

const NOW = new Date('2026-10-08T12:00:00Z');
const entry = (
  id: string,
  code: string,
  name: string,
  extra: Partial<CodeEntry> = {},
): CodeEntry => ({
  id,
  code,
  name,
  effectiveFrom: null,
  effectiveTo: null,
  ...extra,
});

/** Plan 1.3 step 5 (ING03, B12): exact code resolution, trees, code-rule defaults. */
describe('code libraries', () => {
  describe('matchCode', () => {
    const codes = [
      entry('11111111-1111-4111-8111-111111111111', 'BRG', 'Bearing'),
      entry('22222222-2222-4222-8222-222222222222', 'BRG-SEAL', 'Bearing seal'),
      entry('33333333-3333-4333-8333-333333333333', 'OLD', 'Old', {
        effectiveTo: new Date('2026-01-01T00:00:00Z'),
      }),
    ];

    it('resolves an exact code or name, case-insensitively', () => {
      expect(matchCode(codes, 'brg', NOW)).toEqual({
        status: 'resolved',
        id: codes[0].id,
      });
      expect(matchCode(codes, ' Bearing seal ', NOW)).toEqual({
        status: 'resolved',
        id: codes[1].id,
      });
    });

    it('never resolves a substring', () => {
      expect(matchCode(codes, 'Bear', NOW).status).toBe('unresolved');
      expect(matchCode(codes, 'Bearing failure', NOW).status).toBe(
        'unresolved',
      );
    });

    it('suggests close codes without assigning them', () => {
      expect(matchCode(codes, 'BRGG', NOW)).toEqual({
        status: 'unresolved',
        suggestions: ['BRG'],
      });
    });

    it('respects the validity interval', () => {
      expect(matchCode(codes, 'OLD', NOW).status).toBe('unresolved');
      expect(
        matchCode(codes, 'OLD', new Date('2025-06-01T00:00:00Z')).status,
      ).toBe('resolved');
    });

    it('reports two different codes matching as ambiguous', () => {
      const clash = [
        ...codes,
        entry('44444444-4444-4444-8444-444444444444', 'Bearing', 'Other'),
      ];
      expect(matchCode(clash, 'bearing', NOW)).toMatchObject({
        status: 'ambiguous',
      });
    });

    it('accepts a uuid only when it is one of the tenant codes', () => {
      expect(matchCode(codes, codes[0].id, NOW).status).toBe('resolved');
      expect(
        matchCode(codes, '99999999-9999-4999-8999-999999999999', NOW).status,
      ).toBe('unresolved');
    });

    it('computes edit distances', () => {
      expect(editDistance('kitten', 'sitting')).toBe(3);
      expect(editDistance('', 'abc')).toBe(3);
    });
  });

  describe('trees', () => {
    it('places children under the parent path and level', () => {
      expect(placement('c', { id: 'p', path: 'r/p', level: 1 })).toEqual({
        path: 'r/p/c',
        level: 2,
      });
      expect(placement('r', null)).toEqual({ path: 'r', level: 0 });
    });

    it('detects a cycle when the new parent is the node or a descendant', () => {
      expect(wouldCycle('p', { id: 'c', path: 'r/p/c' })).toBe(true);
      expect(wouldCycle('p', { id: 'p', path: 'r/p' })).toBe(true);
      expect(wouldCycle('p', { id: 'x', path: 'r/x' })).toBe(false);
      expect(wouldCycle('p', { id: 'legacy-root' })).toBe(false);
    });

    it('orders failure groups class → problem → cause → remedy', () => {
      expect(isValidFailureParent('class', null)).toBe(true);
      expect(isValidFailureParent('problem', 'class')).toBe(true);
      expect(isValidFailureParent('remedy', 'class')).toBe(false);
      expect(isValidFailureParent('problem', null)).toBe(false);
    });
  });

  describe('applyCodeDefaults', () => {
    const defaults = {
      scheduleClass: {
        value: 'planned',
        source: 'code_rule' as const,
        ruleId: 'r1',
        ruleVersion: 2,
      },
      oeeComponent: {
        value: 'availability',
        source: 'code_default' as const,
        ruleId: null,
        ruleVersion: null,
      },
    };

    it('applies defaults the caller did not set', () => {
      const result = applyCodeDefaults(defaults, {});
      expect(result.values).toEqual({
        scheduleClass: 'planned',
        oeeComponent: 'availability',
      });
      expect(result.basis.scheduleClass).toMatchObject({
        source: 'code_rule',
        ruleVersion: 2,
        overridesDefault: false,
      });
    });

    it('keeps an explicit value and flags it as an override when it differs', () => {
      const result = applyCodeDefaults(defaults, {
        scheduleClass: 'unplanned',
        oeeComponent: 'availability',
      });
      expect(result.values).toEqual({});
      expect(result.basis.scheduleClass).toMatchObject({
        source: 'user',
        defaultValue: 'planned',
        overridesDefault: true,
      });
      expect(result.basis.oeeComponent).toMatchObject({
        source: 'user',
        overridesDefault: false,
      });
    });
  });
});
