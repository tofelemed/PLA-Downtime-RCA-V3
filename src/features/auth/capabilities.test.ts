import { describe, expect, it } from 'vitest';
import { capabilitiesOf, type CapabilityKey } from './capabilities';
import * as Roles from './server-role-sets';
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

  it('audit readers mirror GET /audit-logs: admins and manager approvers; engineers, operators and viewers are not', () => {
    expect(capabilitiesOf(['TenantAdmin', 'manager_approver']).canViewAuditLogs).toBe(true);
    expect(capabilitiesOf(['Manager', 'manager_approver']).canViewAuditLogs).toBe(true);
    expect(capabilitiesOf(['Engineer', 'production_engineer', 'reliability_engineer']).canViewAuditLogs).toBe(false);
    expect(capabilitiesOf(['Operator', 'operator']).canViewAuditLogs).toBe(false);
    expect(capabilitiesOf(['viewer']).canViewAuditLogs).toBe(false);
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

  describe('v2 write capabilities mirror the server role sets', () => {
    type WriteKey = Exclude<CapabilityKey, 'isSuperAdmin' | 'isReadOnly' | 'canViewOperations' | 'canViewAnalysis' | 'canManageMasterData' | 'canUseIntegrationConsole' | 'canAdministerTenant' | 'canUseAdminPanel' | 'canViewAuditLogs' | 'canApprove'>;
    const PINS: ReadonlyArray<[WriteKey, readonly string[]]> = [
      ['canWritePlans', Roles.PLAN_WRITERS],
      ['canApprovePlans', Roles.PLAN_APPROVERS],
      ['canWriteProfiles', Roles.PROFILE_WRITERS],
      ['canApproveProfiles', Roles.PROFILE_APPROVERS],
      ['canWriteCalendars', Roles.CALENDAR_WRITERS],
      ['canWritePeriods', Roles.PERIOD_WRITERS],
      ['canApprovePeriods', Roles.REVISION_APPROVERS.filter((r) => (Roles.ADJUSTMENT_APPROVERS as readonly string[]).includes(r))],
      ['canWriteBridges', Roles.BRIDGE_WRITERS],
      ['canWriteCodes', Roles.CODE_WRITERS],
      ['canAuthorRules', Roles.RULE_AUTHORS],
      ['canApproveRules', Roles.RULE_APPROVERS],
      ['canWriteRca', Roles.RCA_WRITERS],
      ['canWriteIntegration', Roles.INTEGRATION_WRITERS],
      ['canManagePolicies', Roles.POLICY_ROLES],
    ];
    const SCOPE_ROLES = ['manager_approver', 'production_accountant', 'production_engineer', 'reliability_engineer', 'integration_admin', 'master_data_admin', 'operator', 'viewer'];

    it.each(PINS)('%s: exactly the scope roles of its server set, plus the global admins', (key, set) => {
      for (const role of SCOPE_ROLES) expect([role, capabilitiesOf([role])[key]]).toEqual([role, set.includes(role)]);
      expect(capabilitiesOf(['SuperAdmin'])[key]).toBe(true);
      expect(capabilitiesOf(['OrgAdmin'])[key]).toBe(true);
    });

    it('legacy roles count through their D06 mapping (TenantAdmin/Manager approve, Engineer/Analyst write plans)', () => {
      const manager = capabilitiesOf(effectiveRoles({ role: 'Manager' }, { tenantId: null }));
      expect(manager.canApprovePlans && manager.canApprovePeriods && manager.canManagePolicies).toBe(true);
      const engineer = capabilitiesOf(effectiveRoles({ role: 'Engineer' }, { tenantId: null }));
      expect([engineer.canWritePlans, engineer.canWritePeriods, engineer.canApprovePlans, engineer.canWriteCodes]).toEqual([true, true, false, false]);
    });

    it('canWriteEvents: any non-viewer member; a viewer (or no role) has no write capability at all', () => {
      expect(capabilitiesOf(['Operator', 'operator']).canWriteEvents).toBe(true);
      expect(capabilitiesOf(['production_engineer']).canWriteEvents).toBe(true);
      for (const roles of [['viewer'], []]) {
        const caps = capabilitiesOf(roles);
        expect(PINS.every(([key]) => !caps[key])).toBe(true);
        expect(caps.canWriteEvents).toBe(false);
      }
    });
  });
});
