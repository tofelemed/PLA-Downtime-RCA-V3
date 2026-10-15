/**
 * The showcase plants: equipment, products, rates and the persona cast that writes each kind of data
 * (authors and approvers are always different people). Demo Plant is the full polymer complex, Demo
 * Plant 2 a smaller PP site, Partner Plant gets a handful of v1 events. Demo data only.
 */
export type ScenarioKind = 'full' | 'small' | 'partner';

export interface AssetSpec {
  /** asset kind, the code suffix the reason table refers to (MTR, GBX, DIE, …) */
  kind: string;
  name: string;
  assetType: string;
  criticality: 'High' | 'Medium' | 'Low';
  manufacturer: string;
}

export interface ProductSpec {
  code: string;
  name: string;
  description: string;
}

export interface UnitSpec {
  /** short key used in event ids (EXT1, EXT2, …) */
  key: string;
  code: string;
  name: string;
  description: string;
  /** sustained (ideal) rate in t/h; the planning rate is 92 % of it */
  sustainedRate: number;
  products: readonly string[];
  assets: readonly AssetSpec[];
}

export interface PersonaCast {
  /** master-data / code / rule / profile / rate authors */
  authors: readonly string[];
  /** approvers (manager_approver), never the author of what they approve */
  managers: readonly string[];
  /** plan authors, period editors (submit), adjustment proposers */
  engineers: readonly string[];
  /** event recorders */
  operators: readonly string[];
  /** RCA case owners */
  reliability: readonly string[];
  /** SME V1: finance maintainers draft valuation inputs (policy, FX, valuation rates, demand) */
  finance: readonly string[];
  /** SME V1: finance approvers, never the author of what they approve */
  financeApprovers: readonly string[];
  /** ISO 9001: Quality / Lab approvers decide lot dispositions, never ones they recorded */
  quality: readonly string[];
  /** Production accountants independently approve revisions and source authority. */
  accountants: readonly string[];
  metrology: readonly string[];
}

export interface PlantScenario {
  kind: ScenarioKind;
  plantCode: string;
  cast: PersonaCast;
  units: readonly UnitSpec[];
  products: readonly ProductSpec[];
  /** RCA cases to open (0 = none) */
  rcaCases: number;
  tasks: number;
  /** stops per unit and day */
  stopsPerDay: { min: number; max: number };
}

const asset = (
  kind: string,
  name: string,
  assetType: string,
  criticality: AssetSpec['criticality'],
  manufacturer: string,
): AssetSpec => ({ kind, name, assetType, criticality, manufacturer });

const EXTRUDER_ASSETS = (line: string): AssetSpec[] => [
  asset('EXT', line, 'Extruder', 'High', 'Demo reference: Coperion'),
  asset('MTR', `${line} main drive motor`, 'Motor', 'High', 'Siemens'),
  asset('GBX', `${line} gearbox`, 'Gearbox', 'High', 'Flender'),
  asset('SCR', `${line} screw and barrel`, 'Extruder', 'High', 'Coperion'),
  asset('DIE', `${line} die plate`, 'Die', 'Medium', 'Coperion'),
  asset('FDR', `${line} gravimetric feeder`, 'Feeder', 'Medium', 'K-Tron'),
  asset('WB', `${line} water bath`, 'Cooling', 'Low', 'Gala'),
  asset('CUT', `${line} underwater pelletizer`, 'Cutter', 'High', 'Gala'),
  asset('PMP', `${line} process water pump A`, 'Pump', 'Medium', 'KSB'),
  asset('DRY', `${line} centrifugal dryer`, 'Dryer', 'Medium', 'Gala'),
  asset(
    'FFS',
    `${line} 25 kg bagging line`,
    'Bagger',
    'Medium',
    'Haver & Boecker',
  ),
];

const HDPE_PRODUCTS: readonly ProductSpec[] = [
  {
    code: 'HDPE-PE100-BK',
    name: 'HDPE PE100 pipe grade (black)',
    description:
      'Illustrative bimodal pressure-pipe compound; carbon black 2.25 wt%; density 0.959 g/cm3; MFR 0.25 g/10 min at 190 C / 5 kg; no product certification implied',
  },
  {
    code: 'HDPE-F7000',
    name: 'HDPE film grade F7000',
    description:
      'Illustrative high molecular weight film grade; density 0.952 g/cm3; MFR 0.05 g/10 min at 190 C / 2.16 kg',
  },
  {
    code: 'HDPE-BL3',
    name: 'HDPE blow moulding grade BL3',
    description:
      'Illustrative blow moulding grade for jerrycans; density 0.954 g/cm3; MFR 0.30 g/10 min at 190 C / 2.16 kg',
  },
  {
    code: 'HDPE-IM55',
    name: 'HDPE injection grade IM55',
    description:
      'Illustrative injection moulding grade; density 0.955 g/cm3; MFR 5.5 g/10 min at 190 C / 2.16 kg',
  },
];

const DEMO_PLANT: PlantScenario = {
  kind: 'full',
  plantCode: 'demo-plant',
  cast: {
    authors: ['charlotte.evans', 'hiro.yamamoto', 'zara.qureshi'],
    managers: ['jonas.weber', 'fatima.haddad', 'erik.johansson', 'laura.rossi'],
    engineers: [
      'noah.schmidt',
      'aisha.bello',
      'mateo.alvarez',
      'hannah.novak',
      'samuel.osei',
    ],
    operators: ['liam.murphy', 'yuki.sato', 'carlos.mendes'],
    reliability: ['viktor.petrov', 'amara.diallo', 'sebastian.vogel'],
    finance: ['mina.sadeghi', 'thomas.keller'],
    financeApprovers: ['reza.karimi', 'sofia.lindqvist'],
    quality: ['parisa.rahimi'],
    accountants: ['sara.nouri', 'david.chen'],
    metrology: ['kaveh.ahmadi'],
  },
  products: HDPE_PRODUCTS,
  units: [
    {
      key: 'EXT1',
      code: 'unit100',
      name: 'unit100',
      description:
        'Demo: HDPE finishing train 100; Extruder1, pelletizing and packing; 32 t/h sustained illustrative rate',
      sustainedRate: 32,
      products: ['HDPE-PE100-BK', 'HDPE-F7000', 'HDPE-BL3'],
      assets: EXTRUDER_ASSETS('Extruder1'),
    },
    {
      key: 'EXT2',
      code: 'unit200',
      name: 'unit200',
      description:
        'Demo: HDPE finishing train 200; Extruder2, pelletizing and packing; 28 t/h sustained illustrative rate',
      sustainedRate: 28,
      products: ['HDPE-F7000', 'HDPE-IM55', 'HDPE-BL3'],
      assets: EXTRUDER_ASSETS('Extruder2'),
    },
  ],
  rcaCases: 6,
  tasks: 14,
  stopsPerDay: { min: 1, max: 4 },
};

const PP_PRODUCTS: readonly ProductSpec[] = [
  {
    code: 'PP-H030',
    name: 'PP homopolymer H030',
    description: 'Raffia and fibre grade, MFI 3',
  },
  {
    code: 'PP-C510',
    name: 'PP impact copolymer C510',
    description: 'Impact copolymer for crates and buckets',
  },
  {
    code: 'PP-T20',
    name: 'PP compound T20 (20 % talc)',
    description: 'Talc-filled compound for automotive parts',
  },
];

const DEMO_PLANT_2: PlantScenario = {
  kind: 'small',
  plantCode: 'demo-plant-2',
  cast: {
    authors: ['isabel.moreno'],
    managers: ['chloe.dubois', 'daniel.okafor'],
    engineers: ['sofia.bergstrom', 'ravi.krishnan'],
    operators: ['grace.whitfield', 'pedro.santos'],
    reliability: ['isabel.moreno'],
    finance: ['mina.sadeghi'],
    financeApprovers: ['reza.karimi'],
    quality: ['parisa.rahimi'],
    accountants: ['sara.nouri', 'david.chen'],
    metrology: ['kaveh.ahmadi'],
  },
  products: PP_PRODUCTS,
  units: [
    {
      key: 'CMP1',
      code: 'CMP-LINE-1',
      name: 'Compounding Line 1',
      description: 'PP compounding extruder with talc side feeder',
      sustainedRate: 18,
      products: ['PP-H030', 'PP-C510', 'PP-T20'],
      assets: EXTRUDER_ASSETS('Compounder 1'),
    },
    {
      key: 'PKG1',
      code: 'PKG-LINE-1',
      name: 'Packaging Line 1',
      description: 'Big-bag and 25 kg bag filling',
      sustainedRate: 24,
      products: ['PP-H030', 'PP-C510'],
      assets: [
        asset('SCL', 'Packaging scale', 'Scale', 'High', 'Mettler Toledo'),
        asset('FFS', 'Bag filler', 'Bagger', 'High', 'Concetti'),
        asset('CNV', 'Bag conveyor', 'Conveyor', 'Medium', 'Concetti'),
      ],
    },
  ],
  rcaCases: 1,
  tasks: 3,
  stopsPerDay: { min: 3, max: 9 },
};

const PARTNER_PLANT: PlantScenario = {
  kind: 'partner',
  plantCode: 'partner-plant',
  cast: {
    authors: ['lucas.ferreira'],
    managers: ['lucas.ferreira'],
    engineers: ['lucas.ferreira'],
    operators: ['lucas.ferreira'],
    reliability: ['lucas.ferreira'],
    finance: ['lucas.ferreira'],
    financeApprovers: ['lucas.ferreira'],
    quality: ['lucas.ferreira'],
    accountants: ['lucas.ferreira'],
    metrology: ['lucas.ferreira'],
  },
  products: [],
  units: [],
  rcaCases: 0,
  tasks: 0,
  stopsPerDay: { min: 0, max: 0 },
};

export const SCENARIOS: readonly PlantScenario[] = [
  DEMO_PLANT,
  DEMO_PLANT_2,
  PARTNER_PLANT,
];

export const PERSONA_DOMAIN = 'demo.acme.com';
export const PERSONA_PASSWORD = 'Persona-2026!demo';
/** a SuperAdmin persona: resolves plant codes and is never an author */
export const RESOLVER_PERSONA = 'helena.fischer';

/** planning rate = sustained × this factor */
export const PLANNING_FACTOR = 0.92;
/** fixed start of calendars, profiles, rates and codes, so re-runs that extend the window stay covered */
export const MASTER_DATA_FROM = '2026-08-01';

export function emailOf(persona: string): string {
  return `${persona}@${PERSONA_DOMAIN}`;
}
