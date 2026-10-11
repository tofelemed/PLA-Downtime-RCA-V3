/**
 * The showcase code libraries of a polymer complex: reason tree (existing roots MECH-01 / ELEC-01 are
 * reused), impact codes (IC001–IC005 reused), OEE codes (OEE001–OEE007 reused), failure codes and loss
 * categories. Each leaf reason carries its defaults and the kind of event it is used for, so the event
 * generator and the mapping rules read one table. Demo data only.
 */
export type OeeComponent = 'availability' | 'performance' | 'quality' | 'idle';
export type ScheduleClass = 'planned' | 'unplanned' | 'external';
/** what the generator uses a reason for */
export type ReasonUse =
  | 'breakdown'
  | 'planned'
  | 'external'
  | 'minor'
  | 'speed'
  | 'quality';

export interface ReasonLeaf {
  code: string;
  name: string;
  oee: OeeComponent;
  schedule: ScheduleClass;
  impact: string;
  use: ReasonUse;
  /** asset kinds (code suffix) this cause shows up on (empty: the whole unit) */
  assets: readonly string[];
  weight: number;
}

export interface ReasonRoot {
  code: string;
  name: string;
  category: string;
  leaves: readonly ReasonLeaf[];
}

function oeeOf(use: ReasonUse): OeeComponent {
  if (use === 'minor' || use === 'speed') return 'performance';
  return use === 'quality' ? 'quality' : 'availability';
}

function scheduleOf(use: ReasonUse): ScheduleClass {
  if (use === 'planned') return 'planned';
  return use === 'external' ? 'external' : 'unplanned';
}

const leaf = (
  code: string,
  name: string,
  use: ReasonUse,
  extra: Partial<Pick<ReasonLeaf, 'impact' | 'assets' | 'weight'>> = {},
): ReasonLeaf => ({
  code,
  name,
  use,
  oee: oeeOf(use),
  schedule: scheduleOf(use),
  impact: extra.impact ?? 'IC001',
  assets: extra.assets ?? [],
  weight: extra.weight ?? 1,
});

const MECHANICAL: ReasonRoot = {
  code: 'MECH-01',
  name: 'Mechanical',
  category: 'Mechanical',
  leaves: [
    leaf('MECH-BRG', 'Bearing failure', 'breakdown', {
      assets: ['MTR', 'GBX', 'PMP', 'DRY'],
      weight: 3,
    }),
    leaf('MECH-GBX', 'Gearbox oil leak / overheating', 'breakdown', {
      assets: ['GBX'],
      weight: 2,
    }),
    leaf('MECH-SCR', 'Screw or barrel wear', 'breakdown', {
      assets: ['SCR'],
      weight: 1,
    }),
    leaf('MECH-DIE', 'Die plate blockage', 'breakdown', {
      assets: ['DIE'],
      weight: 3,
    }),
    leaf('MECH-KNF', 'Cutter knife wear / breakage', 'breakdown', {
      assets: ['CUT'],
      weight: 2,
    }),
    leaf('MECH-CNV', 'Conveyor jam', 'minor', {
      assets: ['CNV', 'PAL'],
      weight: 4,
      impact: 'IC003',
    }),
    leaf('MECH-SEAL', 'Seal or flange leak', 'breakdown', {
      assets: ['PMP', 'WB'],
      weight: 1,
    }),
  ],
};

const ELECTRICAL: ReasonRoot = {
  code: 'ELEC-01',
  name: 'Electrical',
  category: 'Electrical',
  leaves: [
    leaf('ELEC-MTR', 'Main motor trip', 'breakdown', {
      assets: ['MTR'],
      weight: 3,
    }),
    leaf('ELEC-VFD', 'Drive (VFD) fault', 'breakdown', {
      assets: ['MTR', 'FFS'],
      weight: 2,
    }),
    leaf('ELEC-HTR', 'Barrel heater band failure', 'breakdown', {
      assets: ['SCR'],
      weight: 2,
    }),
    leaf('ELEC-SNS', 'Sensor / instrument fault', 'minor', {
      assets: ['FDR', 'SCL'],
      weight: 3,
      impact: 'IC003',
    }),
    leaf('ELEC-PLC', 'Control system (PLC) fault', 'breakdown', { weight: 1 }),
  ],
};

const PROCESS: ReasonRoot = {
  code: 'PROC',
  name: 'Process',
  category: 'Process',
  leaves: [
    leaf('PROC-MELT', 'Melt pressure high', 'breakdown', {
      assets: ['DIE', 'SCR'],
      weight: 3,
      impact: 'IC008',
    }),
    leaf('PROC-TEMP', 'Temperature out of range', 'breakdown', {
      assets: ['SCR', 'WB'],
      weight: 2,
      impact: 'IC008',
    }),
    leaf('PROC-STRD', 'Strand breaks / pellet agglomerates', 'minor', {
      assets: ['CUT', 'DIE'],
      weight: 4,
      impact: 'IC003',
    }),
    leaf('PROC-SCRN', 'Screen pack change', 'breakdown', {
      assets: ['SCR'],
      weight: 2,
      impact: 'IC008',
    }),
    leaf('PROC-SPEED', 'Reduced throughput (rate cut)', 'speed', {
      weight: 3,
      impact: 'IC003',
    }),
    leaf('PROC-OFFSPEC', 'Off-spec product (MFI / density)', 'quality', {
      weight: 3,
      impact: 'IC004',
    }),
    leaf('PROC-START', 'Start-up scrap', 'quality', {
      weight: 1,
      impact: 'IC004',
    }),
  ],
};

const MATERIAL: ReasonRoot = {
  code: 'MATL',
  name: 'Material',
  category: 'Material',
  leaves: [
    leaf('MATL-RES', 'Resin feed shortage', 'breakdown', {
      assets: ['FDR'],
      weight: 2,
      impact: 'IC005',
    }),
    leaf('MATL-ADD', 'Additive dosing fault', 'minor', {
      assets: ['FDR'],
      weight: 2,
      impact: 'IC005',
    }),
    leaf('MATL-CONT', 'Contamination (black specks / gels)', 'quality', {
      weight: 2,
      impact: 'IC004',
    }),
    leaf('MATL-FILM', 'Bag film shortage', 'breakdown', {
      assets: ['FFS'],
      weight: 2,
      impact: 'IC005',
    }),
    leaf('MATL-SILO', 'Silo transfer delay', 'breakdown', {
      weight: 1,
      impact: 'IC005',
    }),
  ],
};

const PLANNED: ReasonRoot = {
  code: 'PLAN',
  name: 'Planned',
  category: 'Planned',
  leaves: [
    leaf('PLAN-PM', 'Preventive maintenance', 'planned', {
      weight: 2,
      impact: 'IC006',
    }),
    leaf('PLAN-CHG', 'Grade changeover', 'planned', {
      weight: 3,
      impact: 'IC002',
    }),
    leaf('PLAN-CLN', 'Cleaning / purge', 'planned', {
      weight: 2,
      impact: 'IC002',
    }),
    leaf('PLAN-HND', 'Shift handover meeting', 'planned', {
      weight: 1,
      impact: 'IC002',
    }),
  ],
};

const EXTERNAL: ReasonRoot = {
  code: 'EXT',
  name: 'External',
  category: 'External',
  leaves: [
    leaf('EXT-UTIL', 'Cooling water / steam outage', 'external', {
      weight: 2,
      impact: 'IC007',
    }),
    leaf('EXT-PWR', 'Grid power dip', 'external', {
      weight: 2,
      impact: 'IC007',
    }),
    leaf('EXT-LOG', 'No trucks / warehouse full', 'external', {
      weight: 1,
      impact: 'IC007',
    }),
    leaf('EXT-UPS', 'Upstream reactor upset (no powder)', 'external', {
      weight: 1,
      impact: 'IC005',
    }),
  ],
};

export const REASON_TREE: readonly ReasonRoot[] = [
  MECHANICAL,
  ELECTRICAL,
  PROCESS,
  MATERIAL,
  PLANNED,
  EXTERNAL,
];

export interface SimpleCode {
  code: string;
  name: string;
  description?: string;
}

/** IC001–IC005 exist already (reused by code); the rest are added. */
export const IMPACT_CODES: readonly SimpleCode[] = [
  { code: 'IC001', name: 'Equipment Failure' },
  { code: 'IC002', name: 'Setup Time' },
  { code: 'IC003', name: 'Reduced Speed' },
  { code: 'IC004', name: 'Quality Defects' },
  { code: 'IC005', name: 'Material Shortage' },
  {
    code: 'IC006',
    name: 'Planned Maintenance',
    description: 'Scheduled preventive work',
  },
  {
    code: 'IC007',
    name: 'Utility / External Outage',
    description: 'Cause outside the plant boundary',
  },
  {
    code: 'IC008',
    name: 'Process Upset',
    description: 'Process conditions outside the operating window',
  },
];

/** OEE001–OEE007 exist already (reused); one idle code is added. */
export const OEE_CODES: readonly SimpleCode[] = [
  { code: 'OEE001', name: 'Planned Maintenance' },
  { code: 'OEE002', name: 'Unplanned Downtime' },
  { code: 'OEE003', name: 'Setup and Adjustment' },
  { code: 'OEE004', name: 'Idling and Minor Stops' },
  { code: 'OEE005', name: 'Reduced Speed' },
  { code: 'OEE006', name: 'Startup Rejects' },
  { code: 'OEE007', name: 'Production Rejects' },
  {
    code: 'OEE008',
    name: 'No Demand / Idle',
    description: 'Scheduled but not required',
  },
];

export interface FailureNode {
  code: string;
  name: string;
  kind: 'class' | 'problem' | 'cause' | 'remedy';
  children: readonly FailureNode[];
}

const fc = (
  code: string,
  name: string,
  kind: FailureNode['kind'],
  children: readonly FailureNode[] = [],
): FailureNode => ({ code, name, kind, children });

export const FAILURE_CODES: readonly FailureNode[] = [
  fc('FC-ROT', 'Rotating equipment', 'class', [
    fc('FC-ROT-VIB', 'High vibration', 'problem', [
      fc('FC-ROT-VIB-LUB', 'Lubrication failure', 'cause', [
        fc('FC-RM-LUB', 'Re-lubricate / change oil', 'remedy'),
      ]),
      fc('FC-ROT-VIB-MIS', 'Shaft misalignment', 'cause', [
        fc('FC-RM-ALN', 'Laser re-alignment', 'remedy'),
      ]),
    ]),
    fc('FC-ROT-HOT', 'Overheating', 'problem', [
      fc('FC-ROT-HOT-BRG', 'Bearing wear', 'cause', [
        fc('FC-RM-BRG', 'Replace bearing', 'remedy'),
      ]),
    ]),
  ]),
  fc('FC-ELE', 'Electrical drives', 'class', [
    fc('FC-ELE-TRP', 'Drive trip', 'problem', [
      fc('FC-ELE-TRP-OVL', 'Overload', 'cause', [
        fc('FC-RM-RST', 'Reset and reduce load', 'remedy'),
      ]),
      fc('FC-ELE-TRP-INS', 'Insulation breakdown', 'cause', [
        fc('FC-RM-RWD', 'Rewind / replace motor', 'remedy'),
      ]),
    ]),
  ]),
  fc('FC-PRC', 'Process equipment', 'class', [
    fc('FC-PRC-BLK', 'Blockage', 'problem', [
      fc('FC-PRC-BLK-GEL', 'Gels / degraded polymer', 'cause', [
        fc('FC-RM-PRG', 'Purge and clean die', 'remedy'),
      ]),
    ]),
  ]),
];

export const LOSS_CATEGORIES: readonly SimpleCode[] = [
  { code: 'LC-BRK', name: 'Breakdowns' },
  { code: 'LC-SET', name: 'Setup and adjustments' },
  { code: 'LC-MIN', name: 'Small stops' },
  { code: 'LC-SPD', name: 'Reduced speed' },
  { code: 'LC-STR', name: 'Start-up rejects' },
  { code: 'LC-REJ', name: 'Production rejects' },
  { code: 'LC-PLN', name: 'Planned stops' },
  { code: 'LC-EXT', name: 'External losses' },
];

export function allLeaves(): ReasonLeaf[] {
  return REASON_TREE.flatMap((root) => [...root.leaves]);
}

export function leavesFor(use: ReasonUse): ReasonLeaf[] {
  return allLeaves().filter((item) => item.use === use);
}
