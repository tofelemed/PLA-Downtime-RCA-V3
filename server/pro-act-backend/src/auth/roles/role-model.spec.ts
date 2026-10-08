import {
  canGrantRole,
  mapLegacyRole,
  rolesForLegacyRole,
  satisfiesRole,
} from './role-model';

describe('role model (§13.2, D06)', () => {
  it('maps legacy roles to scope roles', () => {
    expect(mapLegacyRole('TenantAdmin')).toBe('manager_approver');
    expect(mapLegacyRole('Engineer')).toBe('production_engineer');
    expect(mapLegacyRole('Operator')).toBe('operator');
    expect(mapLegacyRole('custom')).toBe('custom');
    expect(rolesForLegacyRole('Manager')).toEqual([
      'Manager',
      'manager_approver',
    ]);
    expect(rolesForLegacyRole(null)).toEqual([]);
  });

  it('SuperAdmin satisfies everything, OrgAdmin everything but SuperAdmin', () => {
    expect(satisfiesRole(['SuperAdmin'], 'SuperAdmin')).toBe(true);
    expect(satisfiesRole(['OrgAdmin'], 'manager_approver')).toBe(true);
    expect(satisfiesRole(['OrgAdmin'], 'SuperAdmin')).toBe(false);
  });

  it('other callers need the role itself', () => {
    expect(satisfiesRole(['Operator', 'operator'], 'operator')).toBe(true);
    expect(satisfiesRole(['Operator', 'operator'], 'manager_approver')).toBe(
      false,
    );
  });

  it('a caller cannot grant a role above its own or an unknown role', () => {
    expect(canGrantRole(['TenantAdmin', 'manager_approver'], 'Operator')).toBe(
      true,
    );
    expect(
      canGrantRole(['TenantAdmin', 'manager_approver'], 'TenantAdmin'),
    ).toBe(true);
    expect(
      canGrantRole(['TenantAdmin', 'manager_approver'], 'SuperAdmin'),
    ).toBe(false);
    expect(canGrantRole(['SuperAdmin'], 'made_up')).toBe(false);
  });
});
