import { describe, expect, it } from 'vitest';
import { sidebarNameOf } from '@/features/auth/navigation-items';
import { reachableModules, userRolesInPlant } from './reachable-modules';

const names = (roles: string[]) => reachableModules(roles, {}).flatMap((group) => group.items.map((item) => item.name));

describe('permissions: modules the user reaches (QA audit 2026-10-19)', () => {
  it('Sara (production accountant) does not reach Connectivity, Audit log or Admin panel', () => {
    const roles = userRolesInPlant({ role: 'Analyst', tenantId: 'plant', plantRoles: ['production_accountant'] }, 'plant');
    expect(roles).toEqual(['Analyst', 'production_accountant']);
    const reached = names(roles);
    expect(reached).not.toContain('Connectivity');
    expect(reached).not.toContain('Audit log');
    expect(reached).not.toContain('Admin panel');
    expect(reached).toContain('Dashboard');
  });

  it('an operator reaches no Reports and no Loss valuation (no money)', () => {
    const reached = names(['Operator', 'operator']);
    expect(reached).not.toContain('Reports');
    expect(reached).not.toContain('Loss valuation');
    expect(reached).toContain('Event Hub');
  });

  it('the legacy role counts only in its home plant, global roles everywhere', () => {
    expect(userRolesInPlant({ role: 'TenantAdmin', tenantId: 'home', plantRoles: ['viewer'] }, 'other')).toEqual(['viewer']);
    expect(userRolesInPlant({ role: 'SuperAdmin', tenantId: 'home', plantRoles: [] }, 'other')).toEqual(['SuperAdmin']);
    expect(userRolesInPlant({ role: 'Engineer', tenantId: 'home' }, 'other')).toEqual(['Engineer']);
  });

  it('lists the pages by their sidebar names (QA_SHELL N3)', () => {
    const shown = reachableModules(['production_accountant'], {}).flatMap((group) => group.items.map(sidebarNameOf));
    expect(shown).toContain('Downtime overview');
    expect(shown).toContain('PLA overview');
    expect(shown).not.toContain('Downtime analysis');
    expect(shown).not.toContain('Production loss analysis');
  });
});
