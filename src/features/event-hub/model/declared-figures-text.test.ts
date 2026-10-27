import { describe, expect, it } from 'vitest';
import type { DeclaredFigures } from '@/api/v2/types/events';
import { factText, type FactResolvers } from './fact-display';
import { declaredFiguresText } from './production-loss';

const FIGURES: DeclaredFigures = {
  planned: 240, actual: 208, shortfall: 32, uom: 't', measurementQuality: 'GOOD', sourceStatus: 'DETECTED',
  plan: { source: 'PLANNING_SYSTEM_TBD', planId: 'PLAN-20261025', revision: 1, approved: true }, piSource: null,
};
const decimal = (value: string, digits: number) => Number(value).toFixed(digits);
const RESOLVERS = { decimal } as unknown as FactResolvers;

describe('declared figures as text', () => {
  it('reads as one line in the plant number format', () => {
    expect(declaredFiguresText(FIGURES, decimal)).toBe('Planned 240.000 t · Actual 208.000 t · Shortfall 32.000 t · GOOD · DETECTED · plan PLANNING_SYSTEM_TBD / PLAN-20261025 rev 1 (approved)');
  });

  it('leaves out what OT did not declare', () => {
    const bare = { ...FIGURES, planned: null, actual: null, measurementQuality: null, sourceStatus: null, plan: null };
    expect(declaredFiguresText(bare, decimal)).toBe('Shortfall 32.000 t');
  });

  it('the Values tab fact is that text, not JSON', () => {
    expect(factText('declaredFigures', FIGURES, RESOLVERS)).toContain('Planned 240.000 t');
    expect(factText('declaredFigures', FIGURES, RESOLVERS)).not.toContain('{');
  });
});
