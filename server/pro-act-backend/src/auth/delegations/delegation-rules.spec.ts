import {
  delegationInForce,
  delegationRefusal,
  holdsForScope,
} from './delegation-rules';

const T = 'tenant-a';
const unitTarget = {
  tenantId: T,
  role: 'manager_approver',
  kind: 'unit' as const,
  id: 'unit-1',
  siteOfUnit: 'site-1',
};
const noLegacy = { role: null, tenantId: null };

/** SME R1 / R6 delegates: only what the delegator holds, time-boxed, never to themselves. */
describe('delegation rules', () => {
  it('a tenant, site or same-unit grant of the role covers a unit; another unit or role does not', () => {
    const grant = (
      kind: 'tenant' | 'site' | 'unit',
      id: string,
      role = 'manager_approver',
    ) => [{ tenantId: T, role, kind, id }];
    expect(holdsForScope(grant('tenant', T), noLegacy, unitTarget)).toBe(true);
    expect(holdsForScope(grant('site', 'site-1'), noLegacy, unitTarget)).toBe(
      true,
    );
    expect(holdsForScope(grant('unit', 'unit-1'), noLegacy, unitTarget)).toBe(
      true,
    );
    expect(holdsForScope(grant('unit', 'unit-2'), noLegacy, unitTarget)).toBe(
      false,
    );
    expect(
      holdsForScope(
        grant('tenant', T, 'production_accountant'),
        noLegacy,
        unitTarget,
      ),
    ).toBe(false);
    expect(
      holdsForScope(grant('unit', 'unit-1'), noLegacy, {
        ...unitTarget,
        kind: 'tenant',
        id: T,
      }),
    ).toBe(false);
  });

  it('a legacy home-plant role counts through its mapping (Manager → manager_approver)', () => {
    expect(
      holdsForScope([], { role: 'Manager', tenantId: T }, unitTarget),
    ).toBe(true);
    expect(
      holdsForScope([], { role: 'Manager', tenantId: 'other' }, unitTarget),
    ).toBe(false);
  });

  it('the legacy mapping does not count once the delegator holds an own grant in the plant (QA audit 2026-10-19)', () => {
    const financeOnly = [
      { tenantId: T, role: 'finance_approver', kind: 'tenant' as const, id: T },
    ];
    expect(
      holdsForScope(financeOnly, { role: 'Manager', tenantId: T }, unitTarget),
    ).toBe(false);
  });

  it('refuses self-delegation, empty or over-long intervals and intervals already over', () => {
    const now = new Date('2026-10-15T00:00:00Z');
    const base = {
      delegatorId: 'a',
      delegateId: 'b',
      validFrom: now,
      validUntil: new Date('2026-10-22T00:00:00Z'),
      now,
    };
    expect(delegationRefusal(base)).toBeNull();
    expect(delegationRefusal({ ...base, delegateId: 'a' })).toBe(
      'SELF_DELEGATION',
    );
    expect(delegationRefusal({ ...base, validUntil: now })).toBe(
      'INVALID_INTERVAL',
    );
    expect(
      delegationRefusal({
        ...base,
        validUntil: new Date('2027-02-01T00:00:00Z'),
      }),
    ).toBe('TOO_LONG');
    expect(
      delegationRefusal({
        ...base,
        validFrom: new Date('2026-10-01T00:00:00Z'),
        validUntil: new Date('2026-10-10T00:00:00Z'),
      }),
    ).toBe('ALREADY_ENDED');
  });

  it('is in force from its start until (not including) its end, unless revoked', () => {
    const d = {
      validFrom: new Date('2026-10-15T00:00:00Z'),
      validUntil: new Date('2026-10-16T00:00:00Z'),
      revokedAt: null,
    };
    expect(delegationInForce(d, new Date('2026-10-15T00:00:00Z'))).toBe(true);
    expect(delegationInForce(d, new Date('2026-10-16T00:00:00Z'))).toBe(false);
    expect(
      delegationInForce(
        { ...d, revokedAt: new Date() },
        new Date('2026-10-15T12:00:00Z'),
      ),
    ).toBe(false);
  });
});
