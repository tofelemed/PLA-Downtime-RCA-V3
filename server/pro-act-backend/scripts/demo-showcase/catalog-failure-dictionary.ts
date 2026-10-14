/**
 * Demo failure dictionary of the HDPE showcase plant, ISO 14224-style (SME D11). Illustrative values only:
 * equipment classes, maintainable items and failure modes follow the structure and common codes of ISO 14224
 * Annex B (pumps, compressors, electric motors, gearboxes, conveyors) with plant extensions for extruders,
 * pelletizers and baggers, which ISO 14224 does not list; mechanism, cause and detection lists follow
 * Tables B.2–B.4. Not a real plant code export. Demo data only, never a product default.
 */
export interface DictionaryRow {
  kind:
    | 'equipment_class'
    | 'maintainable_item'
    | 'failure_mode'
    | 'failure_mechanism'
    | 'failure_cause'
    | 'detection_method';
  equipmentClass?: string;
  code: string;
  name: string;
  description: string;
  category?: string;
  assetTypes?: string[];
  isPending?: boolean;
}

export const DEMO_NOTE =
  'Demo: illustrative ISO 14224-style code, not a plant export';

interface ClassSpec {
  code: string;
  name: string;
  assetTypes: string[];
  items: Array<[string, string]>;
  modes: Array<[string, string]>;
}

const CLASSES: readonly ClassSpec[] = [
  {
    code: 'PU',
    name: 'Pumps',
    assetTypes: ['Pump'],
    items: [
      ['SEAL', 'Mechanical seal'],
      ['BRG', 'Radial / thrust bearing'],
      ['IMP', 'Impeller'],
      ['CPL', 'Coupling'],
      ['CSG', 'Casing'],
    ],
    modes: [
      ['ELP', 'External leakage – process medium'],
      ['FTS', 'Fail to start on demand'],
      ['VIB', 'Vibration'],
      ['LOO', 'Low output'],
      ['NOI', 'Noise'],
      ['BRD', 'Breakdown'],
    ],
  },
  {
    code: 'CO',
    name: 'Compressors and blowers',
    assetTypes: ['Compressor', 'Blower'],
    items: [
      ['VLV', 'Valve'],
      ['RTR', 'Rotor'],
      ['BRG', 'Bearing'],
      ['LUB', 'Lube oil system'],
      ['SEAL', 'Shaft seal'],
    ],
    modes: [
      ['FTS', 'Fail to start on demand'],
      ['UST', 'Spurious stop'],
      ['VIB', 'Vibration'],
      ['OHE', 'Overheating'],
      ['ELP', 'External leakage – process medium'],
    ],
  },
  {
    code: 'EM',
    name: 'Electric motors',
    assetTypes: ['Motor'],
    items: [
      ['STA', 'Stator / windings'],
      ['BRG', 'Bearing'],
      ['CLG', 'Cooling fan'],
      ['VFD', 'Variable-frequency drive'],
      ['TRM', 'Terminal box / cabling'],
    ],
    modes: [
      ['UST', 'Spurious stop (trip)'],
      ['OHE', 'Overheating'],
      ['VIB', 'Vibration'],
      ['FTS', 'Fail to start on demand'],
      ['BRD', 'Breakdown'],
    ],
  },
  {
    code: 'GB',
    name: 'Gearboxes',
    assetTypes: ['Gearbox'],
    items: [
      ['GEAR', 'Gear set'],
      ['BRG', 'Bearing'],
      ['LUB', 'Lubrication system'],
      ['SEAL', 'Shaft seal'],
    ],
    modes: [
      ['ELU', 'External leakage – utility (oil)'],
      ['OHE', 'Overheating'],
      ['VIB', 'Vibration'],
      ['NOI', 'Noise'],
      ['BRD', 'Breakdown'],
    ],
  },
  {
    code: 'XT',
    name: 'Extruders and compounding (plant extension)',
    assetTypes: ['Extruder', 'Die', 'Feeder', 'Cooling'],
    items: [
      ['SCR', 'Screw elements'],
      ['BAR', 'Barrel / liner'],
      ['HTR', 'Heater band'],
      ['DIE', 'Die plate'],
      ['SCN', 'Screen changer'],
      ['FDR', 'Gravimetric feeder'],
    ],
    modes: [
      ['PLU', 'Plugged / choked'],
      ['PDE', 'Parameter deviation (melt pressure / temperature)'],
      ['LOO', 'Low output'],
      ['STD', 'Structural deficiency (wear)'],
      ['UST', 'Spurious stop (interlock trip)'],
    ],
  },
  {
    code: 'PZ',
    name: 'Pelletizers and dryers (plant extension)',
    assetTypes: ['Cutter', 'Dryer'],
    items: [
      ['KNF', 'Cutter knives'],
      ['HUB', 'Cutter hub'],
      ['ROT', 'Dryer rotor'],
      ['SCR', 'Screen'],
    ],
    modes: [
      ['STD', 'Structural deficiency (knife wear / breakage)'],
      ['PLU', 'Plugged (agglomerates)'],
      ['VIB', 'Vibration'],
      ['UST', 'Spurious stop'],
    ],
  },
  {
    code: 'CV',
    name: 'Conveyors',
    assetTypes: ['Conveyor'],
    items: [
      ['BLT', 'Belt'],
      ['RLR', 'Roller / idler'],
      ['DRV', 'Drive unit'],
      ['SNS', 'Position sensor'],
    ],
    modes: [
      ['PLU', 'Jammed / blocked'],
      ['UST', 'Spurious stop'],
      ['BRD', 'Breakdown'],
      ['AIR', 'Abnormal instrument reading'],
    ],
  },
  {
    code: 'BG',
    name: 'Bagging and palletizing (plant extension)',
    assetTypes: ['Bagger', 'Scale', 'Robot', 'Wrapper'],
    items: [
      ['JAW', 'Sealing jaws'],
      ['FLM', 'Film transport'],
      ['WGH', 'Weighing cell'],
      ['GRP', 'Robot gripper'],
      ['SNS', 'Sensor'],
    ],
    modes: [
      ['PDE', 'Parameter deviation (weight / seal)'],
      ['UST', 'Spurious stop (operator cleared)'],
      ['AIR', 'Abnormal instrument reading'],
      ['BRD', 'Breakdown'],
    ],
  },
];

const MECHANISMS: Array<[string, string, string]> = [
  ['1.0', 'Mechanical failure – general', 'Mechanical failure'],
  ['1.1', 'Leakage', 'Mechanical failure'],
  ['1.2', 'Vibration', 'Mechanical failure'],
  ['1.3', 'Clearance / alignment failure', 'Mechanical failure'],
  ['1.5', 'Looseness', 'Mechanical failure'],
  ['1.6', 'Sticking', 'Mechanical failure'],
  ['2.2', 'Corrosion', 'Material failure'],
  ['2.3', 'Erosion', 'Material failure'],
  ['2.4', 'Wear', 'Material failure'],
  ['2.5', 'Breakage', 'Material failure'],
  ['2.6', 'Fatigue', 'Material failure'],
  ['2.7', 'Overheating', 'Material failure'],
  ['3.0', 'Instrument failure – general', 'Instrument failure'],
  ['4.0', 'Electrical failure – general', 'Electrical failure'],
  ['4.1', 'Short circuiting', 'Electrical failure'],
  ['5.1', 'Blockage / plugged', 'External influence'],
  ['5.2', 'Contamination', 'External influence'],
  ['6.1', 'No cause found', 'Miscellaneous'],
];

const CAUSES: Array<[string, string, string]> = [
  ['1.1', 'Improper capacity', 'Design-related'],
  ['1.2', 'Improper material', 'Design-related'],
  ['2.1', 'Fabrication error', 'Fabrication / installation'],
  ['2.2', 'Installation error', 'Fabrication / installation'],
  ['3.1', 'Off-design service', 'Operation / maintenance'],
  ['3.2', 'Operating error', 'Operation / maintenance'],
  ['3.3', 'Maintenance error', 'Operation / maintenance'],
  ['3.4', 'Expected wear and tear', 'Operation / maintenance'],
  ['4.1', 'Documentation error', 'Management'],
  ['4.2', 'Management error', 'Management'],
];

const DETECTION: Array<[string, string]> = [
  ['01', 'Periodic maintenance'],
  ['02', 'Functional testing'],
  ['03', 'Inspection'],
  ['04', 'Periodic condition monitoring'],
  ['05', 'Continuous condition monitoring'],
  ['06', 'Production interference'],
  ['07', 'Casual observation'],
  ['09', 'On demand'],
];

const row = (
  kind: DictionaryRow['kind'],
  code: string,
  name: string,
  extra: Partial<DictionaryRow> = {},
): DictionaryRow => ({
  kind,
  code,
  name,
  description: DEMO_NOTE,
  ...extra,
});

function classRows(spec: ClassSpec): DictionaryRow[] {
  return [
    row('equipment_class', spec.code, spec.name, {
      assetTypes: spec.assetTypes,
    }),
    ...spec.items.map(([code, name]) =>
      row('maintainable_item', code, name, { equipmentClass: spec.code }),
    ),
    ...spec.modes.map(([code, name]) =>
      row('failure_mode', code, name, { equipmentClass: spec.code }),
    ),
  ];
}

/** Every demo row; each list has its pending choice (unknown / investigation pending). */
export const DEMO_DICTIONARY: readonly DictionaryRow[] = [
  ...CLASSES.flatMap(classRows),
  row('maintainable_item', 'UNK', 'Unknown – investigation pending', {
    isPending: true,
  }),
  row('failure_mode', 'UNK', 'Unknown – investigation pending', {
    isPending: true,
  }),
  ...MECHANISMS.map(([code, name, category]) =>
    row('failure_mechanism', code, name, { category }),
  ),
  row('failure_mechanism', '6.4', 'Unknown – investigation pending', {
    category: 'Miscellaneous',
    isPending: true,
  }),
  ...CAUSES.map(([code, name, category]) =>
    row('failure_cause', code, name, { category }),
  ),
  row('failure_cause', '5.4', 'Unknown – investigation pending', {
    category: 'Miscellaneous',
    isPending: true,
  }),
  ...DETECTION.map(([code, name]) => row('detection_method', code, name)),
  row('detection_method', '99', 'Not recorded – pending', { isPending: true }),
];

/** Failure detail a demo breakdown of an asset type is coded with (class, item, mode, mechanism, cause, detection). */
export const DEMO_FAILURE_BY_ASSET_TYPE: Readonly<
  Record<string, [string, string, string, string, string]>
> = {
  Pump: ['SEAL', 'ELP', '1.1', '3.4', '03'],
  Motor: ['BRG', 'OHE', '2.7', '3.4', '05'],
  Gearbox: ['LUB', 'ELU', '1.1', '3.3', '07'],
  Extruder: ['SCR', 'STD', '2.4', '3.4', '06'],
  Die: ['DIE', 'PLU', '5.1', '3.1', '06'],
  Feeder: ['FDR', 'LOO', '1.6', '3.2', '06'],
  Cutter: ['KNF', 'STD', '2.5', '3.4', '06'],
  Dryer: ['ROT', 'VIB', '1.2', '3.4', '04'],
  Conveyor: ['BLT', 'PLU', '5.1', '3.2', '07'],
  Bagger: ['JAW', 'PDE', '2.4', '3.4', '06'],
};
