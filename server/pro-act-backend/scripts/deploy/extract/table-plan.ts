/**
 * What the reference extraction copies from the dev database (TF-PREP-001 task 4): the seed files, their
 * tables, and the row filter of each table. Class R* tables other than integration_connections
 * (secrets, pi_connections, pi_mappings, af_bindings) and every transactional table stay out
 * (deploy/ANALYSIS-REPORT.md §3.5). integration_connections is seeded so that signals (NOT NULL
 * connection_id) load; its rows are made inactive and secret-less by transforms.ts.
 */

export interface TableGroup {
  file: string;
  tables: readonly string[];
}

export const TABLE_GROUPS: ReadonlyArray<TableGroup> = [
  {
    file: 'R010__org_hierarchy',
    tables: [
      'organizations',
      'tenants',
      'sites',
      'units',
      'assets',
      'standby_equipment',
      'plant_flow_routes',
      'unit_streams',
    ],
  },
  {
    file: 'R020__codes',
    tables: [
      'code_versions',
      'reason_codes',
      'impact_codes',
      'oee_codes',
      'failure_code_groups',
      'failure_dictionary_entries',
      'loss_category_defs',
      'verification_status_codes',
      'rca_cause_codes',
      'rca_templates',
      'evidence_categories',
      'evidence_locations',
    ],
  },
  {
    file: 'R030__calendar',
    tables: ['calendar_versions', 'crews', 'crew_rotations'],
  },
  {
    file: 'R040__products_profiles_rates',
    tables: [
      'products',
      'production_profiles',
      'unit_product_rates',
      'valuation_rates',
      'fx_rates',
      'uncertainty_budgets',
      'transition_standards',
      // demand_statuses.product_id references products, so it loads here rather than with the codes.
      'demand_statuses',
    ],
  },
  {
    file: 'R050__policies_rules_mappings',
    tables: [
      'accounting_policies',
      'rules',
      'rule_versions',
      'unit_state_mappings',
      'unit_impact_rules',
      'custom_attribute_definitions',
      'attribute_mapping_versions',
      'code_mapping_rules',
      'source_status_mappings',
      'source_hierarchy_mappings',
      'source_mappings',
      'feature_flags',
      'app_settings',
    ],
  },
  {
    file: 'R060__connections_signals',
    tables: ['integration_connections', 'signals'],
  },
  { file: 'U010__users', tables: ['users', 'user_scopes', 'role_delegations'] },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidLiteral(id: string): string {
  if (!UUID.test(id)) throw new Error(`not a uuid: ${id}`);
  return `'${id}'`;
}

/** Path of a group's file under the seed directory: users go to the git-ignored `generated/`. */
export function groupPath(file: string): string {
  return file.startsWith('U')
    ? `generated/${file}.sql`
    : `reference/${file}.sql`;
}

/** Every table of the plan, in plan order. */
export function planTables(): string[] {
  return TABLE_GROUPS.flatMap((group) => [...group.tables]);
}

/** SQL condition selecting the rows of the tenant (and its organisation) in `table`. */
export function rowFilter(
  table: string,
  tenantId: string,
  orgId: string,
): string {
  if (table === 'organizations') return `id = ${uuidLiteral(orgId)}`;
  if (table === 'tenants') return `id = ${uuidLiteral(tenantId)}`;
  if (table === 'app_settings')
    return `tenant_id = ${uuidLiteral(tenantId)} OR tenant_id IS NULL`;
  return `tenant_id = ${uuidLiteral(tenantId)}`;
}

/** Throws naming the plan tables that the source database does not have. */
export function assertTablesExist(existing: ReadonlySet<string>): void {
  const missing = planTables().filter((table) => !existing.has(table));
  if (missing.length > 0) {
    throw new Error(
      `tables of the plan missing from the source database: ${missing.join(', ')}`,
    );
  }
}
