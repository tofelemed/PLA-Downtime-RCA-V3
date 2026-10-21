import type { Capabilities } from '@/features/auth/capabilities';

/**
 * The Setup / Reliability menu entry a master-data page belongs to (21 Oct 2026); its pages show each other as
 * a link row.
 */
export type MasterDataGroup = 'overview' | 'equipment' | 'codes' | 'rules' | 'rca' | 'work-orders';

export interface MasterDataSection {
  to: string;
  group: MasterDataGroup;
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
  { to: '/master-data', group: 'overview', label: 'Overview', text: 'Record counts of the plant', end: true, visible: (c) => c.canReachMasterData },
  { to: '/master-data/units', group: 'equipment', label: 'Production units', text: 'Production units and lines', visible: managers },
  { to: '/master-data/assets', group: 'equipment', label: 'Assets', text: 'Equipment and instruments', visible: managers },
  { to: '/master-data/products', group: 'equipment', label: 'Products', text: 'Products of the plant', visible: managers },
  { to: '/master-data/hierarchy', group: 'equipment', label: 'Plant hierarchy', text: 'Organization, plants, units and assets', visible: managers },
  // the page admits every operations reader (QA L1: the tab bar lists every page the user can open)
  { to: '/master-data/codes-rules', group: 'codes', label: 'Codes & rules', text: 'Code libraries, reason codes and automatic rules', visible: (c) => c.canViewOperations || c.canManageMasterData },
  { to: '/master-data/rca/templates', group: 'rca', label: 'RCA templates', text: 'Logic trees', visible: managers },
  { to: '/master-data/rca/causes', group: 'rca', label: 'Cause library', text: 'Causes by category', visible: managers },
  { to: '/master-data/rca/checklists', group: 'rca', label: 'Verification checklists', text: 'Checks that confirm a fix worked', visible: managers },
  { to: '/master-data/failure-dictionary', group: 'codes', label: 'Failure dictionary', text: 'ISO 14224-aligned failure codes', visible: (c) => c.canManageMasterData || c.canValidateFailures },
  {
    to: '/master-data/plant-flow', group: 'equipment',
    label: 'Plant flow',
    text: 'Which unit feeds which, the buffers between them and their levels',
    visible: (c) => c.canManageMasterData || c.canWriteProfiles,
  },
  {
    to: '/master-data/stop-policy', group: 'rules',
    label: 'Stop and plan policy',
    text: 'Micro-stop thresholds, trip reasons and the grade-change allowance',
    visible: (c) => c.canManageMasterData || c.canWriteOeePolicy,
  },
  {
    to: '/master-data/standby-equipment', group: 'rules',
    label: 'Standby equipment',
    text: 'Standby registrations, their demand / test log and measures',
    visible: (c) => c.canManageMasterData || c.canWriteStandby,
  },
  {
    to: '/master-data/unit-impact-rules', group: 'rules',
    label: 'Unit impact rules',
    text: 'How a stop of one asset affects its unit, and which standby takes over',
    visible: (c) => c.canManageMasterData || c.canWriteUnitImpactRules,
  },
  {
    to: '/master-data/work-orders', group: 'work-orders',
    label: 'Work-order operations',
    text: 'CMMS operations behind mean active repair time',
    visible: (c) => c.canManageMasterData || c.canWriteWorkOrders,
  },
  {
    to: '/master-data/unit-state', group: 'rules',
    label: 'Unit state',
    text: 'State signal mappings, staleness and coverage',
    visible: (c) => c.canManageMasterData || c.canWriteStateMappings,
  },
];

/** The group of a master-data path (longest matching section); null outside master data. */
export function masterDataGroupOf(pathname: string): MasterDataGroup | null {
  const matches = MASTER_DATA_SECTIONS.filter((s) => pathname === s.to || (!s.end && pathname.startsWith(`${s.to}/`)));
  const best = matches.sort((a, b) => b.to.length - a.to.length)[0];
  return best?.group ?? null;
}

/** The sections the user may open, in menu order. */
export const visibleMasterDataSections = (capabilities: Capabilities) => MASTER_DATA_SECTIONS.filter((s) => s.visible(capabilities));

/** The tab-bar name of a master-data page (single source for link texts elsewhere, QA re-test N5). */
export function sectionNameOf(to: string): string {
  const section = MASTER_DATA_SECTIONS.find((candidate) => candidate.to === to);
  if (!section) throw new Error(`No master-data section at ${to}`);
  return section.label;
}
