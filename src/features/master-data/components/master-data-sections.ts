import type { Capabilities } from '@/features/auth/capabilities';

export interface MasterDataSection {
  to: string;
  label: string;
  /** one line for the overview of a user who reaches only some sections */
  text: string;
  /** exact match only (the overview) */
  end?: boolean;
  /** whether the user may open the page (its gate); the server still refuses what the roles do not allow */
  visible: (capabilities: Capabilities) => boolean;
}

const managers = (c: Capabilities) => c.canManageMasterData;

/**
 * The master-data pages in menu order with the capability of each page gate. The reliability pages also
 * admit the roles that write their records (manager approvers, reliability engineers, operators,
 * integration admins), so those users see exactly their links.
 */
export const MASTER_DATA_SECTIONS: readonly MasterDataSection[] = [
  { to: '/master-data', label: 'Overview', text: 'Record counts of the plant', end: true, visible: (c) => c.canReachMasterData },
  { to: '/master-data/units', label: 'Units', text: 'Production units and lines', visible: managers },
  { to: '/master-data/assets', label: 'Assets', text: 'Equipment and instruments', visible: managers },
  { to: '/master-data/products', label: 'Products', text: 'Products of the plant', visible: managers },
  { to: '/master-data/hierarchy', label: 'Plant hierarchy', text: 'Organisation, plants, units and assets', visible: managers },
  { to: '/master-data/codes-rules', label: 'Codes & rules', text: 'Code libraries, reason codes and automatic rules', visible: (c) => c.canViewAnalysis || c.canManageMasterData },
  { to: '/master-data/rca/templates', label: 'RCA templates', text: 'Logic trees', visible: managers },
  { to: '/master-data/rca/causes', label: 'Cause library', text: 'Causes by category', visible: managers },
  { to: '/master-data/rca/checklists', label: 'Verification checklists', text: 'Checks that confirm a fix worked', visible: managers },
  { to: '/master-data/failure-dictionary', label: 'Failure dictionary', text: 'ISO 14224-aligned failure codes', visible: managers },
  {
    to: '/master-data/plant-flow',
    label: 'Plant flow',
    text: 'Which unit feeds which, the buffers between them and their levels',
    visible: (c) => c.canManageMasterData || c.canWriteProfiles,
  },
  {
    to: '/master-data/stop-policy',
    label: 'Stop and plan policy',
    text: 'Micro-stop thresholds, trip reasons and the grade-change allowance',
    visible: (c) => c.canManageMasterData || c.canWriteOeePolicy,
  },
  {
    to: '/master-data/standby-equipment',
    label: 'Standby equipment',
    text: 'Standby registrations, their demand / test log and measures',
    visible: (c) => c.canManageMasterData || c.canWriteStandby,
  },
  {
    to: '/master-data/unit-impact-rules',
    label: 'Unit impact rules',
    text: 'How a stop of one asset affects its unit, and which standby takes over',
    visible: (c) => c.canManageMasterData || c.canWriteUnitImpactRules,
  },
  {
    to: '/master-data/work-orders',
    label: 'Work-order operations',
    text: 'CMMS operations behind mean active repair time',
    visible: (c) => c.canManageMasterData || c.canWriteWorkOrders,
  },
  {
    to: '/master-data/unit-state',
    label: 'Unit state',
    text: 'State signal mappings, staleness and coverage',
    visible: (c) => c.canManageMasterData || c.canWriteStateMappings,
  },
];

/** The sections the user may open, in menu order. */
export const visibleMasterDataSections = (capabilities: Capabilities) => MASTER_DATA_SECTIONS.filter((s) => s.visible(capabilities));
