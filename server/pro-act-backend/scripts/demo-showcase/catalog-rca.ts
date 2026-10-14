/**
 * The RCA cases of the HDPE showcase (DEMO DATA — illustrative failure modes, people and numbers, not plant
 * records; every title starts with "Demo:"). One case per workflow stage of SME CA1: draft, analysis,
 * effectiveness monitoring, closure review and closed. The stories:
 * - a repeat gearbox bearing overheating on Extruder Line 2: three same-mode stops in 30 days fire the
 *   D17 repeat trigger; the case is opened from the event (monitoring, verification still running);
 * - cutter knife breakage on the pelletizer, opened for its approved economic impact over the demo money
 *   limit; the knife-pressure fix is verified NOT effective (the mode kept repeating) and sits in
 *   closure review for an independent manager to send back;
 * - melt pressure after screen pack changes on Extruder Line 1: pre-heating packs is verified EFFECTIVE
 *   (no repeat in the window), the case is closed by an independent manager and its lesson shared.
 * `failureStops` are the demo stops each story needs, on the named asset with the failure-mode (and
 * mechanism) codes of the demo failure dictionary the triggers and the effectiveness verification match on.
 */
export type CaseStage =
  | 'draft'
  | 'analysis'
  | 'monitoring'
  | 'closure_review'
  | 'closed';

export type ActionType =
  | 'repair'
  | 'design_change'
  | 'procedure_change'
  | 'instrument_change'
  | 'training'
  | 'other';

export interface ActionSpec {
  title: string;
  description: string;
  actionType: ActionType;
  ownerRole: 'engineers' | 'operators';
  dueInDays: number;
  status: 'open' | 'in_progress' | 'done';
  /** CA4 objective evidence (work order, revision, test report) */
  evidence?: string;
  completedDaysAgo?: number;
  /** verification window relative to today, in days (negative = in the future) */
  verification?: { fromDaysAgo: number; toDaysAgo: number };
  claimedAvoidedLossUsd?: string;
}

/** Demo stops of one failure mode on one asset (minutes long, `daysAgo` before today's start). */
export interface FailureStops {
  assetKind: string;
  /** failure-mode code of the demo failure dictionary (ISO 14224 style, catalog-failure-dictionary) */
  failureMode: string;
  /** its plain words, for descriptions and the timeline */
  modeLabel: string;
  failureMechanism?: string;
  minutes: number;
  daysAgo: readonly number[];
}

export interface CaseSpec {
  key: string;
  unitKey: string;
  reason: string;
  stage: CaseStage;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  consequenceClass: 'minor' | 'significant' | 'major' | null;
  rootCause: string | null;
  /** 5-Why chain: answer and the evidence that supports it (CA6: evidence per level, not a count) */
  fiveWhy?: ReadonlyArray<{ answer: string; evidence: string }>;
  recommendations: string[];
  actions: ActionSpec[];
  failureStops?: FailureStops;
  /** opened from the trigger recommendation of the last failure stop (rca-link on that event) */
  openedFromTrigger?: 'repeat' | 'cost';
  residualRisk?: string;
}

const GEARBOX: CaseSpec = {
  key: 'gearbox',
  unitKey: 'EXT2',
  reason: 'MECH-GBX',
  stage: 'monitoring',
  title: 'Demo: Repeat gearbox bearing overheating on Extruder Line 2',
  description:
    'Demo case. Opened from the D17 repeat trigger: three gearbox bearing overheating stops on Extruder ' +
    'Line 2 within 30 days (none of them two hours long). Oil analysis showed oxidised oil.',
  priority: 'High',
  consequenceClass: 'significant',
  rootCause:
    'Oil change interval (12 months) too long for the summer gearbox load: the oil oxidises and the bearing runs hot.',
  fiveWhy: [
    {
      answer: 'The gearbox tripped on high bearing temperature',
      evidence: 'DCS alarm log TI-2214 HH',
    },
    {
      answer: 'The bearing ran hot because the oil had lost viscosity',
      evidence: 'Oil analysis OA-1187: viscosity -18 %, TAN high',
    },
    {
      answer:
        'The oil oxidised because the change interval ignores the summer load',
      evidence: 'CMMS PM-GB-EXT2 interval 12 months; load trend',
    },
  ],
  recommendations: [
    'Change the oil every 6 months',
    'Add oil condition monitoring to the PM route',
  ],
  actions: [
    {
      title: 'Shorten the gearbox oil change interval to 6 months',
      description: 'PM task revised; oil changed during the last PM stop.',
      actionType: 'procedure_change',
      ownerRole: 'engineers',
      dueInDays: -9,
      status: 'done',
      evidence:
        'PM-GB-EXT2 revision 4 released; oil change WO-55120 closed with oil sample OA-1203',
      completedDaysAgo: 9,
      verification: { fromDaysAgo: 8, toDaysAgo: -20 },
      claimedAvoidedLossUsd: '14000',
    },
  ],
  failureStops: {
    assetKind: 'GBX',
    failureMode: 'OHE',
    modeLabel: 'Gearbox bearing overheating',
    failureMechanism: '2.7',
    minutes: 35,
    daysAgo: [26, 19, 12],
  },
  openedFromTrigger: 'repeat',
};

const KNIFE: CaseSpec = {
  key: 'knife',
  unitKey: 'PEL',
  reason: 'MECH-KNF',
  stage: 'closure_review',
  title:
    'Demo: Cutter knife breakage on the Underwater Pelletizer (fix not effective)',
  description:
    'Demo case. Opened for the approved economic impact of the knife breakage stops (over the demo money ' +
    'limit). The knife-pressure fix did not stop the breakage: verification is not effective.',
  priority: 'Critical',
  consequenceClass: 'minor',
  rootCause:
    'Knife-to-die contact pressure drifts high after the die plate regrind; the hydraulic regulator is worn.',
  fiveWhy: [
    {
      answer: 'Knives break after 9–12 days instead of 30',
      evidence: 'Knife change log, 6 changes in 3 weeks',
    },
    {
      answer: 'Contact pressure runs above 2.1 bar',
      evidence: 'Pressure trend PI-3105 after the regrind',
    },
  ],
  recommendations: [
    'Replace the pressure regulator',
    'Check die plate flatness after every regrind',
  ],
  actions: [
    {
      title:
        'Re-calibrate the knife pressure regulator and add a pressure alarm',
      description: 'Set 1.8 bar, alarm at 2.1 bar on the DCS.',
      actionType: 'instrument_change',
      ownerRole: 'engineers',
      dueInDays: -20,
      status: 'done',
      evidence:
        'Calibration report CAL-PI-3105; DCS change MOC-2291 (alarm 2.1 bar)',
      completedDaysAgo: 20,
      verification: { fromDaysAgo: 19, toDaysAgo: 1 },
      claimedAvoidedLossUsd: '18500',
    },
  ],
  failureStops: {
    assetKind: 'CUT',
    failureMode: 'STD',
    modeLabel: 'Cutter knife breakage',
    failureMechanism: '2.5',
    minutes: 45,
    daysAgo: [28, 25, 22, 15, 9, 4],
  },
  openedFromTrigger: 'cost',
  residualRisk:
    'Breakage continues at the old rate; knives are inspected every shift until the regulator is replaced.',
};

const MELT: CaseSpec = {
  key: 'melt',
  unitKey: 'EXT1',
  reason: 'PROC-MELT',
  stage: 'closed',
  title:
    'Demo: Melt pressure excursions after screen pack changes (fix effective)',
  description:
    'Demo case. High melt pressure stops clustered in the two hours after a screen pack change. Pre-heating ' +
    'the packs stopped them: verification is effective.',
  priority: 'Medium',
  consequenceClass: 'minor',
  rootCause:
    'New screen packs were installed cold; the pack heats up under flow and pressure peaks until it reaches temperature.',
  fiveWhy: [
    {
      answer: 'Melt pressure peaks right after a screen pack change',
      evidence: 'PT-1102 trend vs screen change log',
    },
    {
      answer: 'The new pack is cold and restricts flow until it heats up',
      evidence: 'Pack temperature measured 40 °C at install',
    },
  ],
  recommendations: ['Pre-heat screen packs in the oven for 30 minutes'],
  actions: [
    {
      title: 'Pre-heat screen packs before installation',
      description:
        'Oven at 220 °C for 30 minutes added to the work instruction.',
      actionType: 'procedure_change',
      ownerRole: 'engineers',
      dueInDays: -21,
      status: 'done',
      evidence:
        'Work instruction WI-EXT-014 revision 3 released; crew briefing record TR-0912',
      completedDaysAgo: 21,
      verification: { fromDaysAgo: 20, toDaysAgo: 2 },
    },
  ],
  failureStops: {
    assetKind: 'DIE',
    failureMode: 'PDE',
    modeLabel: 'Melt pressure high after screen change',
    minutes: 30,
    daysAgo: [29, 26, 23],
  },
  residualRisk:
    'None beyond the revised work instruction; pack temperature checked at install.',
};

export const RCA_CASES: readonly CaseSpec[] = [
  {
    key: 'motor',
    unitKey: 'EXT2',
    reason: 'ELEC-MTR',
    stage: 'draft',
    title: 'Demo: Main drive trips on Extruder Line 2',
    description:
      'Demo case. Three main motor trips in a month; team to be assigned.',
    priority: 'High',
    consequenceClass: null,
    rootCause: null,
    recommendations: [],
    actions: [],
  },
  {
    key: 'die',
    unitKey: 'EXT1',
    reason: 'MECH-DIE',
    stage: 'analysis',
    title: 'Demo: Recurring die plate blockages on Extruder Line 1',
    description:
      'Demo case. Die plate blockages are the largest availability loss of Extruder Line 1 this month.',
    priority: 'High',
    consequenceClass: 'significant',
    rootCause: null,
    recommendations: [
      'Inspect die heater zones 3–4',
      'Review purge procedure after grade changes',
    ],
    actions: [],
  },
  GEARBOX,
  KNIFE,
  MELT,
];

export const SMALL_RCA_CASES: readonly CaseSpec[] = [
  {
    key: 'compounding',
    unitKey: 'CMP1',
    reason: 'PROC-MELT',
    stage: 'analysis',
    title: 'Demo: Melt pressure stops on Compounding Line 1',
    description:
      'Demo case. Talc-filled grades show pressure peaks at the die; investigating side feeder dosing.',
    priority: 'Medium',
    consequenceClass: 'minor',
    rootCause: null,
    recommendations: [],
    actions: [],
  },
];
