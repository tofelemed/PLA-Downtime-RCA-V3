import { describe, expect, it } from 'vitest';
import { capabilitiesOf } from './capabilities';
import { effectiveRoles } from './effective-roles';

describe('capabilitiesOf', () => {
  it('a viewer-only plant is read-only and reaches the read screens only', () => {
    const caps = capabilitiesOf(['viewer']);
    expect(caps.isReadOnly).toBe(true);
    expect(caps.canViewOperations).toBe(true);
    expect(caps.canViewAnalysis).toBe(true);
    expect(caps.canManageMasterData).toBe(false);
    expect(caps.canUseIntegrationConsole).toBe(false);
    expect(caps.canAdministerTenant).toBe(false);
    expect(caps.canApprove).toBe(false);
  });

  it('no role at all (a plant the user is not a member of) is read-only and sees nothing', () => {
    const caps = capabilitiesOf([]);
    expect(caps.isReadOnly).toBe(true);
    expect(caps.canViewOperations).toBe(false);
    expect(caps.canViewAnalysis).toBe(false);
  });

  it('any writable role next to viewer lifts the read-only state (mirrors WriteAccessGuard.canWrite)', () => {
    expect(capabilitiesOf(['viewer', 'operator']).isReadOnly).toBe(false);
    expect(capabilitiesOf(['Analyst', 'production_engineer']).isReadOnly).toBe(false);
  });

  it('master_data_admin opens Master Data, integration_admin the integration console, nothing else', () => {
    const masterData = capabilitiesOf(['Analyst', 'production_engineer', 'master_data_admin']);
    expect(masterData.canManageMasterData).toBe(true);
    expect(masterData.canUseIntegrationConsole).toBe(false);
    expect(masterData.canAdministerTenant).toBe(false);
    const integration = capabilitiesOf(['Engineer', 'production_engineer', 'integration_admin']);
    expect(integration.canUseIntegrationConsole).toBe(true);
    expect(integration.canManageMasterData).toBe(false);
  });

  it('approvers: TenantAdmin, Manager and manager_approver; engineers and operators are not', () => {
    expect(capabilitiesOf(['TenantAdmin', 'manager_approver']).canApprove).toBe(true);
    expect(capabilitiesOf(['Manager', 'manager_approver']).canApprove).toBe(true);
    expect(capabilitiesOf(['manager_approver']).canApprove).toBe(true);
    expect(capabilitiesOf(['Engineer', 'production_engineer']).canApprove).toBe(false);
    expect(capabilitiesOf(['Operator', 'operator']).canApprove).toBe(false);
  });

  it('operators reach the operations screens only', () => {
    const caps = capabilitiesOf(['Operator', 'operator']);
    expect(caps.canViewOperations).toBe(true);
    expect(caps.canViewAnalysis).toBe(false);
  });

  it('global admins hold everything; OrgAdmin has no admin panel', () => {
    const superAdmin = capabilitiesOf(['SuperAdmin']);
    expect(Object.entries(superAdmin).filter(([key]) => key !== 'roles' && key !== 'isReadOnly').every(([, value]) => value === true)).toBe(true);
    const orgAdmin = capabilitiesOf(['OrgAdmin']);
    expect(orgAdmin.canUseAdminPanel).toBe(false);
    expect(orgAdmin.isSuperAdmin).toBe(false);
    expect(orgAdmin.canViewAuditLogs).toBe(true);
    expect(orgAdmin.canManageMasterData).toBe(true);
  });

  it('composes with effectiveRoles: a viewer persona switched to Demo Plant', () => {
    const grace = {
      role: 'Operator',
      tenantId: 'plant-demo-2',
      homeTenantId: 'plant-demo-2',
      organizationId: 'org-demo',
      scopes: [
        { tenantId: 'plant-demo-2', role: 'operator' },
        { tenantId: 'plant-demo', role: 'viewer' },
      ],
    };
    expect(capabilitiesOf(effectiveRoles(grace, { tenantId: 'plant-demo' })).isReadOnly).toBe(true);
    expect(capabilitiesOf(effectiveRoles(grace, { tenantId: 'plant-demo-2' })).isReadOnly).toBe(false);
  });
});
