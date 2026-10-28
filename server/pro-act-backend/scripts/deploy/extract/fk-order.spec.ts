import { ForeignKey, orderTables, selfReferenceColumn } from './fk-order';

const fks: ForeignKey[] = [
  { table: 'user_scopes', column: 'user_id', references: 'users' },
  { table: 'users', column: 'tenant_id', references: 'tenants' },
  { table: 'tenants', column: 'organization_id', references: 'organizations' },
  { table: 'reason_codes', column: 'parent_id', references: 'reason_codes' },
  { table: 'reason_codes', column: 'tenant_id', references: 'tenants' },
  {
    table: 'signals',
    column: 'connection_id',
    references: 'integration_connections',
  },
];

describe('orderTables', () => {
  it('puts referenced tables before the tables that reference them', () => {
    expect(
      orderTables(['user_scopes', 'users', 'tenants', 'organizations'], fks),
    ).toEqual(['organizations', 'tenants', 'users', 'user_scopes']);
  });

  it('ignores self references and tables outside the list', () => {
    expect(orderTables(['signals', 'reason_codes', 'tenants'], fks)).toEqual([
      'signals',
      'tenants',
      'reason_codes',
    ]);
  });

  it('keeps the given order between independent tables', () => {
    expect(orderTables(['b', 'a', 'c'], [])).toEqual(['b', 'a', 'c']);
  });

  it('throws naming the tables of a cycle', () => {
    const cycle: ForeignKey[] = [
      { table: 'a', column: 'b_id', references: 'b' },
      { table: 'b', column: 'a_id', references: 'a' },
    ];
    expect(() => orderTables(['a', 'b'], cycle)).toThrow(/cycle: a -> b -> a/);
  });
});

describe('selfReferenceColumn', () => {
  it('returns the column of a self-referencing table', () => {
    expect(selfReferenceColumn('reason_codes', fks)).toBe('parent_id');
  });

  it('returns null for a table without a self reference', () => {
    expect(selfReferenceColumn('users', fks)).toBeNull();
  });
});
