/**
 * Codes of the training plant (guide lesson 8 and E2E_SINGLE_EXTRUDER §5): the reason hierarchy
 * Mechanical → Drive train → MECH-GEARBOX and the other course reasons with their defaults, the failure
 * dictionary of the extruder gearbox (ISO 14224 style, with honest "investigation pending" choices) and the
 * 6M RCA cause catalogue of the gearbox investigation (lesson 25). Course codes, not a global taxonomy.
 */
type OeeComponent = 'availability' | 'performance' | 'quality';
type ScheduleClass = 'planned' | 'unplanned' | 'external';

export interface ReasonSpec {
  code: string;
  name: string;
  category: string;
  /** parent reason code; null = top level */
  parent: string | null;
  description?: string;
  oee?: OeeComponent;
  schedule?: ScheduleClass;
}

/** Parents first: a child is created after the code it hangs under. */
export const REASONS: readonly ReasonSpec[] = [
  {
    code: 'MECHANICAL',
    name: 'Mechanical',
    category: 'Mechanical',
    parent: null,
  },
  {
    code: 'DRIVE-TRAIN',
    name: 'Drive train',
    category: 'Mechanical',
    parent: 'MECHANICAL',
  },
  {
    code: 'MECH-GEARBOX',
    name: 'Gearbox failure',
    category: 'Mechanical',
    parent: 'DRIVE-TRAIN',
    description: 'Extruder main-drive gearbox failure',
    oee: 'availability',
    schedule: 'unplanned',
  },
  {
    code: 'ELEC-TRIP',
    name: 'Electrical trip',
    category: 'Electrical',
    parent: null,
    description:
      'Electrical protection trip of the extruder (always an availability event)',
    oee: 'availability',
    schedule: 'unplanned',
  },
  {
    code: 'FEED-STARVED',
    name: 'No upstream feed',
    category: 'Upstream',
    parent: null,
    description:
      'Extruder starved of powder feed; external to the extruder, internal to the complex',
    oee: 'availability',
    schedule: 'external',
  },
  {
    code: 'SPEED-LOSS',
    name: 'Reduced extrusion rate',
    category: 'Process',
    parent: null,
    description:
      'Running below the approved sustained rate (observed rate deficit, cause still to investigate)',
    oee: 'performance',
    schedule: 'unplanned',
  },
  {
    code: 'GRADE-CHANGE',
    name: 'Grade change',
    category: 'Planned',
    parent: null,
    description:
      'Grade transition; the standard allowance follows the approved transition model',
    schedule: 'planned',
  },
  {
    code: 'QUALITY-DOWNGRADE',
    name: 'Quality downgrade',
    category: 'Quality',
    parent: null,
    description:
      'Output not first-pass conforming to the intended grade (downgraded lot)',
    oee: 'quality',
  },
];

export type DictionaryKind =
  | 'equipment_class'
  | 'maintainable_item'
  | 'failure_mode'
  | 'failure_mechanism'
  | 'failure_cause'
  | 'detection_method';

export interface DictionaryEntrySpec {
  kind: DictionaryKind;
  code: string;
  name: string;
  description: string;
  equipmentClass?: string;
  assetTypes?: string[];
  isPending?: boolean;
}

const entry = (
  kind: DictionaryKind,
  code: string,
  name: string,
  description: string,
  extra: Partial<DictionaryEntrySpec> = {},
): DictionaryEntrySpec => ({ kind, code, name, description, ...extra });

export const DICTIONARY: readonly DictionaryEntrySpec[] = [
  entry(
    'equipment_class',
    'EXTRUDER',
    'Extruder',
    'Polymer extruder (training plant)',
    {
      assetTypes: ['Equipment'],
    },
  ),
  entry(
    'maintainable_item',
    'GEARBOX',
    'Gearbox',
    'Main-drive gearbox of the extruder',
    {
      equipmentClass: 'EXTRUDER',
    },
  ),
  entry(
    'failure_mode',
    'GEARBOX_FAILURE',
    'Gearbox functional failure',
    'Loss of the gearbox drive function',
    {
      equipmentClass: 'EXTRUDER',
    },
  ),
  entry(
    'failure_mechanism',
    'WEAR',
    'Wear',
    'Progressive wear of gears or bearings (e.g. degraded lubrication)',
  ),
  entry(
    'failure_mechanism',
    'OVERHEATING',
    'Overheating',
    'Temperature rise beyond the design limit',
  ),
  entry(
    'failure_mechanism',
    'MECHANISM_PENDING',
    'Investigation pending',
    'Mechanism not yet established; a trip alarm alone does not show it',
    {
      isPending: true,
    },
  ),
  entry(
    'failure_cause',
    'LUBE_CONTAMINATION',
    'Lubricant contamination',
    'Contaminated lubricant degrading lubrication',
  ),
  entry(
    'failure_cause',
    'COOLING_RESTRICTION',
    'Cooling restriction',
    'Restricted gearbox cooling causing a temperature rise',
  ),
  entry(
    'failure_cause',
    'INSPECTION_GAP',
    'Inspection plan gap',
    'Inspection did not detect the progressive deterioration',
  ),
  entry(
    'failure_cause',
    'CAUSE_PENDING',
    'Investigation pending',
    'Cause not yet established by evidence',
    {
      isPending: true,
    },
  ),
  entry(
    'detection_method',
    'TRIP_ALARM',
    'Trip alarm',
    'Protection trip alarm of the drive',
  ),
];

export type CauseCategory =
  | 'Equipment'
  | 'Process'
  | 'Material'
  | 'Personnel'
  | 'Environment'
  | 'Method';

export interface CauseSpec {
  code: string;
  name: string;
  category: CauseCategory;
  description: string;
}

export const RCA_CAUSES: readonly CauseSpec[] = [
  {
    code: 'MAT-LUBE-CONTAM',
    name: 'Lubricant contamination degraded gearbox lubrication',
    category: 'Material',
    description:
      'Lubricant sample shows contamination that degrades lubrication (gearbox case, lesson 25)',
  },
  {
    code: 'EQ-COOLING-RESTRICT',
    name: 'Gearbox cooling restriction',
    category: 'Equipment',
    description: 'Restricted cooling caused the gearbox temperature rise',
  },
  {
    code: 'EQ-COMPONENT-WEAR',
    name: 'Gear or bearing wear beyond service limit',
    category: 'Equipment',
    description: 'Inspection shows wear beyond the service limit',
  },
  {
    code: 'ME-INSPECTION-GAP',
    name: 'Inspection plan did not detect progressive contamination',
    category: 'Method',
    description:
      'Management cause: inspection plan, limits or follow-up did not catch the deterioration',
  },
  {
    code: 'ME-OIL-LIMITS',
    name: 'Lubricant condition limits and response not defined',
    category: 'Method',
    description:
      'No agreed oil-condition limits or response when a sample is out of limits',
  },
  {
    code: 'PR-OVERLOAD',
    name: 'Gearbox operated above rated load',
    category: 'Process',
    description: 'Loading history above the gearbox rating',
  },
  {
    code: 'PE-INSPECTION-SKILL',
    name: 'Inspection skill or training gap',
    category: 'Personnel',
    description: 'Inspector not trained to recognise early contamination signs',
  },
  {
    code: 'EN-DUST-HEAT',
    name: 'Dust ingress or high ambient temperature',
    category: 'Environment',
    description: 'Ambient dust or heat entering or overheating the gearbox',
  },
];
