import { groupPath, planTables, rowFilter } from './table-plan';

const tenant = '433c1a69-7a32-4b32-ab20-c4139423abd2';
const org = 'e1161cc7-af17-4465-a616-8aca514300c7';

describe('table plan', () => {
  it('selects the organisation and the tenant by id, app_settings with the global row', () => {
    expect(rowFilter('organizations', tenant, org)).toBe(`id = '${org}'`);
    expect(rowFilter('tenants', tenant, org)).toBe(`id = '${tenant}'`);
    expect(rowFilter('app_settings', tenant, org)).toBe(
      `tenant_id = '${tenant}' OR tenant_id IS NULL`,
    );
    expect(rowFilter('units', tenant, org)).toBe(`tenant_id = '${tenant}'`);
  });

  it('refuses an id that is not a uuid', () => {
    expect(() => rowFilter('units', "x' OR true --", org)).toThrow(
      /not a uuid/,
    );
  });

  it('lists each table once and puts users in the generated directory', () => {
    const tables = planTables();
    expect(new Set(tables).size).toBe(tables.length);
    expect(groupPath('U010__users')).toBe('generated/U010__users.sql');
    expect(groupPath('R010__org_hierarchy')).toBe(
      'reference/R010__org_hierarchy.sql',
    );
  });
});
