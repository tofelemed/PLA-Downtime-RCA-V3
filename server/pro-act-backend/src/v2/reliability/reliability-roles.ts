import { RoleName } from '../../auth/roles/role-model';

/** Failure dictionary: master data owned by maintenance (SME D11: MNT is the code owner). */
export const DICTIONARY_WRITERS: readonly RoleName[] = [
  'master_data_admin',
  'reliability_engineer',
  'manager_approver',
];

/** Standby demand / test logs (SME D9): field records of operators and maintenance, imports from integration. */
export const STANDBY_WRITERS: readonly RoleName[] = [
  'operator',
  'reliability_engineer',
  'integration_admin',
  'manager_approver',
];

/** CMMS work-order operations (SME D10): maintenance and the integration that maps the CMMS export. */
export const WORK_ORDER_WRITERS: readonly RoleName[] = [
  'reliability_engineer',
  'integration_admin',
  'manager_approver',
];

/** Unit state mappings and staleness settings (SME D1 / D2): automation and operations approve them. */
export const STATE_MAPPING_WRITERS: readonly RoleName[] = [
  'integration_admin',
  'manager_approver',
];
