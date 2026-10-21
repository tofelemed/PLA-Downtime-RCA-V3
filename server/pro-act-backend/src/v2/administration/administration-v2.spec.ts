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
    ).toBe('Changed task · Fix seal');
    expect(
      readableSummary(`DELETE Unit "${ID}" via API DELETE /api/units/${ID}`),
    ).toBe('Deleted unit');
    expect(readableSummary(null)).toBeNull();
  });

  it('reads automatic entries as words, never a raw verb or "unknown" (QA audit 2026-10-19)', () => {
    expect(
      readableSummary('CREATE Exports "unknown" via API POST /api/v2/exports'),
    ).toBe('Created export');
    expect(
      readableSummary(
        'CREATE Exports "Period summary CSV" via API POST /api/v2/exports',
      ),
    ).toBe('Created export · Period summary CSV');
    expect(
      readableSummary(
        `CREATE RCA "Pump trips" via API POST /api/v2/rcas/${ID}/actions [actions ${ID}]`,
      ),
    ).toBe('Created investigation · Pump trips');
    expect(
      readableSummary('UPDATE ProductionPlan "October" via API PATCH /x'),
    ).toBe('Changed production plan · October');
    expect(readableSummary('UPDATE RcaPolicies "v2"')).toBe(
      'Changed RCA policy · v2',
    );
    expect(readableSummary('Changed role')).toBe('Changed role');
  });

  it('writes RFC 4180 CSV with UTC and plant-clock times, and neutralizes spreadsheet formulas', () => {
    const csv = auditCsv(
      [
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
      ],
      'Asia/Tehran',
    );
    expect(csv.split('\r\n')[0]).toContain('"Time (UTC)","Time (plant)"');
    expect(csv.split('\r\n')[1]).toBe(
      '"2026-10-12T00:00:00.000Z","2026-10-12T03:30:00+03:30","Unknown user","UPDATE","Task","e","\'=HYPERLINK(""x"")"',
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

  it('the home-role mirror is revocable once the holder has another role in its home plant (QA audit 2026-10-19)', () => {
    const admin = context(['TenantAdmin', 'manager_approver']);
    const kamran = {
      ...holder,
      role: 'Analyst',
      tenantId: 'plant',
      homePlantRoles: ['production_engineer', 'finance_approver'],
    };
    const mirror = scope({ role: 'production_engineer' });
    expect(revokeLock(admin, mirror, kamran)).toBeNull();
    expect(
      revokeLock(admin, mirror, {
        ...kamran,
        homePlantRoles: ['production_engineer'],
      }),
    ).toBe('home_role');
    expect(
      revokeLock(admin, mirror, { ...kamran, homePlantRoles: undefined }),
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
