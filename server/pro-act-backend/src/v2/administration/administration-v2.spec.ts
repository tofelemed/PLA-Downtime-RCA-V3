import { UserScope } from '../../auth/scopes/user-scope.entity';
import { RequestContext } from '../../common/context/request-context';
import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { auditCsv } from './audit-logs/audit-csv';
import { readableSummary } from './audit-logs/audit-entry-v2.view';
import { CreateTaskV2Dto } from './tasks/tasks-v2.dto';
import { assertMayGrant, revokeLock } from './user-scopes/scope-grant-rules';
import { CreateUserV2Dto } from './users/users-v2.dto';

const pipe = createValidationPipe();
const validate = (
  metatype: new () => object,
  payload: Record<string, unknown>,
) => pipe.transform(payload, { type: 'body', metatype });

const ID = '7b0d3f3e-7c3a-4a43-9a51-5f3e2f0b1c2d';

function context(roles: string[], userId = 'caller'): RequestContext {
  return {
    userId,
    tenantId: 'plant',
    organizationId: 'org',
    legacyRole: roles[0],
    roles,
    scopes: [],
    isSuperAdmin: false,
    correlationId: 'c',
  };
}

function scope(overrides: Partial<UserScope>): UserScope {
  return Object.assign(new UserScope(), {
    userId: 'u1',
    scopeKind: 'tenant',
    scopeId: 'plant',
    role: 'viewer',
    ...overrides,
  });
}

const holder = {
  id: 'u1',
  role: 'Operator',
  tenantId: 'other-plant',
  organizationId: 'org',
  isActive: true,
};

describe('v2 administration: pure rules', () => {
  it('leaves the technical tail and record ids out of the audit summary', () => {
    expect(
      readableSummary(
        `UPDATE Task "Fix seal" via API PATCH /api/v2/tasks/${ID}`,
      ),
    ).toBe('UPDATE Task "Fix seal"');
    expect(
      readableSummary(`DELETE Unit "${ID}" via API DELETE /api/units/${ID}`),
    ).toBe('DELETE Unit');
    expect(readableSummary(null)).toBeNull();
  });

  it('writes RFC 4180 CSV and neutralizes spreadsheet formulas', () => {
    const csv = auditCsv([
      {
        id: 'a',
        timestamp: '2026-10-12T00:00:00.000Z',
        actorId: 'u',
        actorName: null,
        action: 'UPDATE',
        entityType: 'Task',
        entityId: 'e',
        message: '=HYPERLINK("x")',
        details: null,
      },
    ]);
    expect(csv.split('\r\n')[1]).toBe(
      '"2026-10-12T00:00:00.000Z","Unknown user","UPDATE","Task","e","\'=HYPERLINK(""x"")"',
    );
  });

  it('locks grants the caller may not revoke', () => {
    const admin = context(['TenantAdmin', 'manager_approver']);
    expect(revokeLock(admin, scope({ userId: 'caller' }), holder)).toBe(
      'own_grant',
    );
    expect(revokeLock(admin, scope({}), undefined)).toBe('other_plant');
    expect(
      revokeLock(
        admin,
        scope({ scopeId: 'other-plant', role: 'operator' }),
        holder,
      ),
    ).toBe('home_role');
    expect(
      revokeLock(admin, scope({}), { ...holder, role: 'TenantAdmin' }),
    ).toBe('outranks_you');
    expect(revokeLock(admin, scope({}), holder)).toBeNull();
  });

  it('SuperAdmin manages their own supplemental access while retaining the home-role mirror', () => {
    const admin = { ...context(['SuperAdmin'], holder.id), isSuperAdmin: true };
    expect(revokeLock(admin, scope({}), holder)).toBeNull();
    expect(() =>
      assertMayGrant(admin, holder, 'quality_approver'),
    ).not.toThrow();
    expect(
      revokeLock(
        admin,
        scope({ scopeId: holder.tenantId, role: 'operator' }),
        holder,
      ),
    ).toBe('home_role');
  });

  it('validates user and task bodies at the boundary', async () => {
    await expect(
      validate(CreateUserV2Dto, {
        name: 'A',
        email: 'a@b.co',
        password: 'short',
        role: 'Operator',
      }),
    ).rejects.toBeInstanceOf(ValidationFailedException);
    await expect(
      validate(CreateUserV2Dto, {
        name: 'A',
        email: 'a@b.co',
        password: 'long-enough',
        role: 'Viewer',
      }),
    ).rejects.toBeInstanceOf(ValidationFailedException);
    await expect(
      validate(CreateTaskV2Dto, {
        title: 'T',
        assigneeId: ID,
        priority: 'High',
        linkType: 'RCA',
      }),
    ).rejects.toBeInstanceOf(ValidationFailedException);
    await expect(
      validate(CreateTaskV2Dto, {
        title: 'T',
        assigneeId: ID,
        priority: 'High',
        linkType: 'RCA',
        linkId: ID,
      }),
    ).resolves.toMatchObject({ linkId: ID });
  });
});
