import { plantRolesOf } from './plant-roles';

describe('plantRolesOf (QA audit 2026-10-19: users list shows plant roles)', () => {
  const kamran = { id: 'k', role: 'Analyst', tenantId: 'plant' };

  it('lists the grants in the acting plant, each once, not the legacy role', () => {
    const grants = [
      { userId: 'k', role: 'finance_approver' },
      { userId: 'k', role: 'finance_approver' },
      { userId: 'other', role: 'operator' },
    ];
    expect(plantRolesOf(kamran, grants, 'plant')).toEqual(['finance_approver']);
  });

  it('without grants: the D06 fallback in the home plant only', () => {
    expect(plantRolesOf(kamran, [], 'plant')).toEqual(['production_engineer']);
    expect(plantRolesOf(kamran, [], 'another-plant')).toEqual([]);
    expect(
      plantRolesOf(
        { id: 's', role: 'SuperAdmin', tenantId: 'plant' },
        [],
        'plant',
      ),
    ).toEqual(['SuperAdmin']);
  });
});
