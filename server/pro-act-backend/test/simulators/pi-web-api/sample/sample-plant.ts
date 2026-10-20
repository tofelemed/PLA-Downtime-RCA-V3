/**
 * The sample plant served by the sample PI Web API (`run-sample-pi.ts`): an AF database `HDPE` on the
 * asset server `PIAF-MARUN` mirroring the Marun HDPE plant in Pro-Act (unit `Extruder1`, asset
 * `EXT1-Main`), plus a pelletizer Pro-Act does not know (exercises the "unknown unit" quarantine).
 * Sample data only: it lives with the test simulator, never in product code.
 */
export const SAMPLE_ASSET_SERVER = {
  Name: 'PIAF-MARUN',
  WebId: 'F1RSAfMarunPIAF0001',
};
export const SAMPLE_DATABASE = { Name: 'HDPE', WebId: 'F1RDAfMarunHDPE0001' };

const ROOT = `\\\\${SAMPLE_ASSET_SERVER.Name}\\${SAMPLE_DATABASE.Name}\\Marun\\Polymer`;

export interface SampleElement {
  key: 'line' | 'extruder' | 'drive' | 'pelletizer';
  webId: string;
  path: string;
  template: string;
}

export const SAMPLE_ELEMENTS: readonly SampleElement[] = [
  {
    key: 'line',
    webId: 'F1EmMarunLine1',
    path: `${ROOT}\\Line1`,
    template: 'Production Line',
  },
  {
    key: 'extruder',
    webId: 'F1EmMarunExtruder1',
    path: `${ROOT}\\Line1\\Extruder1`,
    template: 'Extruder',
  },
  {
    key: 'drive',
    webId: 'F1EmMarunExt1MainDrive',
    path: `${ROOT}\\Line1\\Extruder1\\Main Drive`,
    template: 'Drive',
  },
  {
    key: 'pelletizer',
    webId: 'F1EmMarunPelletizer1',
    path: `${ROOT}\\Line1\\Pelletizer1`,
    template: 'Pelletizer',
  },
];

export function sampleElement(key: SampleElement['key']): SampleElement {
  const found = SAMPLE_ELEMENTS.find((element) => element.key === key);
  if (!found) throw new Error(`no sample element ${key}`);
  return found;
}

/** One kind of production loss the sample plant produces (reason codes of the HDPE code library). */
export interface LossScenario {
  reason: string;
  /** digital state value of the `ReasonCode` enumeration set */
  state: number;
  minutes: number;
  /** share of the nominal rate lost while the frame runs (1 = full stop) */
  lossShare: number;
  description: string;
  lossCategory: string;
}

/**
 * Cycled in order (deterministic). `SCREEN-CHANGE` is deliberately not in the HDPE code library, so
 * its frames arrive uncoded with an "unknown code" quarantine item.
 */
export const LOSS_SCENARIOS: readonly LossScenario[] = [
  {
    reason: 'MECH-GEARBOX',
    state: 11,
    minutes: 48,
    lossShare: 1,
    description: 'Gearbox high vibration trip',
    lossCategory: 'Breakdown',
  },
  {
    reason: 'FEED-STARVED',
    state: 31,
    minutes: 22,
    lossShare: 1,
    description: 'Powder feed hopper empty',
    lossCategory: 'External',
  },
  {
    reason: 'SPEED-LOSS',
    state: 41,
    minutes: 95,
    lossShare: 0.3,
    description: 'Rate reduced for melt pressure',
    lossCategory: 'Speed loss',
  },
  {
    reason: 'ELEC-TRIP',
    state: 21,
    minutes: 17,
    lossShare: 1,
    description: 'Main motor breaker trip',
    lossCategory: 'Breakdown',
  },
  {
    reason: 'GRADE-CHANGE',
    state: 51,
    minutes: 60,
    lossShare: 1,
    description: 'Grade change HD5502 to TRAIN-B',
    lossCategory: 'Changeover',
  },
  {
    reason: 'SCREEN-CHANGE',
    state: 61,
    minutes: 35,
    lossShare: 1,
    description: 'Screen pack change (code not in library)',
    lossCategory: 'Planned',
  },
  {
    reason: 'DRIVE-TRAIN',
    state: 12,
    minutes: 28,
    lossShare: 1,
    description: 'Coupling inspection',
    lossCategory: 'Breakdown',
  },
  {
    reason: 'QUALITY-DOWNGRADE',
    state: 71,
    minutes: 40,
    lossShare: 0.5,
    description: 'Off-spec MFI, product downgraded',
    lossCategory: 'Quality',
  },
];

/** Extruder nominal rate, tonnes per hour. */
export const NOMINAL_RATE_TPH = 12.5;

/** Process streams served by `streamsets/recorded` / `streams/{id}/summary` (signals in Pro-Act). */
export const SAMPLE_STREAMS = {
  throughput: {
    webId: 'F1AbMarunExt1Throughput',
    name: 'Extruder1|Throughput',
    unit: 't/h',
  },
  meltTemp: {
    webId: 'F1AbMarunExt1MeltTemp',
    name: 'Extruder1|Melt Temperature',
    unit: '°C',
  },
} as const;

/** Shift letter of an instant in plant time (Asia/Tehran, UTC+03:30): A 06–14, B 14–22, C 22–06. */
export function shiftOf(at: Date): 'A' | 'B' | 'C' {
  const local = new Date(at.getTime() + 210 * 60_000);
  const hour = local.getUTCHours();
  if (hour >= 6 && hour < 14) return 'A';
  if (hour >= 14 && hour < 22) return 'B';
  return 'C';
}

const CREWS = { A: 'Crew 1', B: 'Crew 2', C: 'Crew 3' } as const;

export function crewOf(at: Date): string {
  return CREWS[shiftOf(at)];
}
