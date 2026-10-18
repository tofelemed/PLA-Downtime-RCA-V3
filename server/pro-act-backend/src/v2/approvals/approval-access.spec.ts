import {
  anonymousContext,
  RequestContext,
} from '../../common/context/request-context';
import { approvalScope } from './approval-scope';
import {
  cursorBinding,
  decodeApprovalCursor,
  encodeApprovalCursor,
} from './approval-cursor';
const tenantId = '00000000-0000-4000-8000-000000000001';
const context = (extra: Partial<RequestContext> = {}): RequestContext => ({
  ...anonymousContext('inbox-test'),
  tenantId,
  userId: '00000000-0000-4000-8000-000000000002',
  ...extra,
});
describe('approval role scope and cursor isolation', () => {
  it('does not turn a plant-wide viewer and unit manager into a plant-wide manager', () => {
    const ctx = context({
      roles: ['viewer', 'manager_approver'],
      scopes: [
        { kind: 'tenant', id: tenantId, tenantId, role: 'viewer' },
        { kind: 'unit', id: 'unit-a', tenantId, role: 'manager_approver' },
      ],
    });
    expect(approvalScope(ctx, ['manager_approver'], 'r.unitId')).toMatchObject({
      sql: '(r.unitId IN (:...approvalUnits))',
      parameters: { approvalUnits: ['unit-a'] },
    });
    expect(approvalScope(ctx, ['manager_approver']).sql).toBe('FALSE');
  });
  it('does not use another plant’s approval role', () => {
    expect(
      approvalScope(
        context({
          scopes: [
            {
              kind: 'tenant',
              id: 'foreign',
              tenantId: 'foreign',
              role: 'finance_approver',
            },
          ],
        }),
        ['finance_approver'],
      ).sql,
    ).toBe('FALSE');
  });
  it('keeps unit-only finance out of plant-wide policy approvals', () => {
    expect(
      approvalScope(
        context({
          scopes: [
            { kind: 'unit', id: 'unit-a', tenantId, role: 'finance_approver' },
          ],
        }),
        ['finance_approver'],
      ).sql,
    ).toBe('FALSE');
  });
  it('retains global SuperAdmin and mapped legacy manager access', () => {
    expect(
      approvalScope(context({ isSuperAdmin: true }), ['quality_approver']).sql,
    ).toBe('TRUE');
    expect(
      approvalScope(
        context({
          legacyRole: 'Manager',
          roles: ['Manager', 'manager_approver'],
        }),
        ['manager_approver'],
      ).sql,
    ).toBe('TRUE');
  });
  it('preserves microseconds and rejects cursors after a role or tenant change', () => {
    const binding = cursorBinding(context());
    const row = {
      at: '2026-10-17T00:00:00.123456Z',
      id: '00000000-0000-4000-8000-000000000003',
      kind: 'profile',
      binding,
    };
    expect(decodeApprovalCursor(encodeApprovalCursor(row), binding)).toEqual(
      row,
    );
    expect(() =>
      decodeApprovalCursor(
        encodeApprovalCursor(row),
        cursorBinding(context({ roles: ['viewer'] })),
      ),
    ).toThrow();
    expect(() =>
      decodeApprovalCursor(
        encodeApprovalCursor({
          ...row,
          id: '------------------------------------',
        }),
        binding,
      ),
    ).toThrow();
  });
  it('keeps cursor binding stable when grant order changes', () => {
    const scopes: RequestContext['scopes'] = [
      { kind: 'unit', id: 'unit-a', tenantId, role: 'manager_approver' },
      { kind: 'unit', id: 'unit-b', tenantId, role: 'quality_approver' },
    ];
    expect(
      cursorBinding(
        context({ roles: ['quality_approver', 'manager_approver'], scopes }),
      ),
    ).toBe(
      cursorBinding(
        context({
          roles: ['manager_approver', 'quality_approver'],
          scopes: [...scopes].reverse(),
        }),
      ),
    );
  });
});
