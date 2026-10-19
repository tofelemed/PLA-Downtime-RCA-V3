import { describe, expect, it } from 'vitest';
import { plantRoleSummary } from './plant-role-summary';

describe('plantRoleSummary (QA audit 2026-10-19: plant roles, not the legacy role)', () => {
  it('shows the plant grant instead of "Analyst"', () => {
    expect(plantRoleSummary(['Analyst', 'finance_approver'], 'Analyst')).toEqual({ short: 'Finance approver', full: 'Finance approver' });
  });

  it('counts further plant roles', () => {
    expect(plantRoleSummary(['Analyst', 'finance_approver', 'production_engineer'], 'Analyst')).toEqual({
      short: 'Finance approver +1',
      full: 'Finance approver, Production engineer',
    });
  });

  it('a global administrator reads as such', () => {
    expect(plantRoleSummary(['SuperAdmin'], 'SuperAdmin').short).toBe('Super administrator');
  });

  it('falls back to the legacy role only when nothing else is held', () => {
    expect(plantRoleSummary([], 'Analyst').short).toBe('Analyst');
    expect(plantRoleSummary([], null).short).toBe('—');
  });
});
