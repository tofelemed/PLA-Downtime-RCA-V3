/**
 * The RCA cases of the showcase, one per lifecycle stage: draft, analysis, actions open, action verified,
 * and two closed cases (closing one creates its knowledge-base entry). Each case is linked to the
 * biggest stops of its reason on its unit. Demo data only.
 */
export type CaseStage =
  | 'draft'
  | 'analysis'
  | 'actions_open'
  | 'verified'
  | 'closed';

export interface ActionSpec {
  title: string;
  description: string;
  ownerRole: 'reliability' | 'engineers' | 'operators';
  dueInDays: number;
  status: 'open' | 'in_progress' | 'done';
  /** verification window relative to today (days); omitted = none */
  verification?: { fromDaysAgo: number; toDaysAgo: number };
  baselineRecurrences?: string;
  claimedAvoidedLossUsd?: string;
}

export interface CaseSpec {
  unitKey: string;
  reason: string;
  stage: CaseStage;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  rootCause: string | null;
  recommendations: string[];
  actions: ActionSpec[];
}

export const RCA_CASES: readonly CaseSpec[] = [
  {
    unitKey: 'EXT2',
    reason: 'ELEC-MTR',
    stage: 'draft',
    title: 'Main drive trips on Extruder Line 2',
    description:
      'Three main motor trips in a month, the last one still running. Opened from the trigger recommendation; team to be assigned.',
    priority: 'High',
    rootCause: null,
    recommendations: [],
    actions: [],
  },
  {
    unitKey: 'EXT1',
    reason: 'MECH-DIE',
    stage: 'analysis',
    title: 'Recurring die plate blockages on Extruder Line 1',
    description:
      'Die plate blockages are the largest availability loss of Extruder Line 1 this month. Evidence: melt temperature trends, screen pack change log, die hole inspection photos.',
    priority: 'High',
    rootCause: null,
    recommendations: [
      'Inspect die heater zones 3–4',
      'Review purge procedure after grade changes',
    ],
    actions: [],
  },
  {
    unitKey: 'PEL',
    reason: 'MECH-KNF',
    stage: 'actions_open',
    title: 'Cutter knife breakage on the Underwater Pelletizer',
    description:
      'Knives break after 9–12 days instead of the 30 days the supplier quotes; each change costs 40–60 minutes of the whole complex.',
    priority: 'Critical',
    rootCause:
      'Knife-to-die contact pressure set too high after the last die plate regrind; hydraulic pressure regulator drifts.',
    recommendations: [
      'Re-calibrate knife pressure regulator',
      'Introduce knife wear inspection at every grade change',
    ],
    actions: [
      {
        title: 'Re-calibrate knife pressure regulator and add a pressure alarm',
        description: 'Set 1.8 bar, alarm at 2.1 bar on the DCS.',
        ownerRole: 'reliability',
        dueInDays: 5,
        status: 'in_progress',
        baselineRecurrences: '4',
        claimedAvoidedLossUsd: '18500',
      },
      {
        title: 'Add knife wear check to the grade-change checklist',
        description: 'Operators measure knife edge wear at each changeover.',
        ownerRole: 'operators',
        dueInDays: 10,
        status: 'open',
      },
    ],
  },
  {
    unitKey: 'EXT2',
    reason: 'MECH-GBX',
    stage: 'verified',
    title: 'Gearbox overheating on Extruder Line 2',
    description:
      'Gearbox oil temperature alarms forced rate cuts and stops. Oil cooler fouling found.',
    priority: 'Medium',
    rootCause:
      'Fouled oil cooler (cooling water side) – cleaning interval of 12 months too long for the summer water quality.',
    recommendations: [
      'Clean oil cooler every 6 months',
      'Add differential temperature monitoring',
    ],
    actions: [
      {
        title:
          'Clean gearbox oil cooler and shorten the cleaning interval to 6 months',
        description: 'Cleaning done during the PM stop; CMMS interval updated.',
        ownerRole: 'reliability',
        dueInDays: -12,
        status: 'done',
        verification: { fromDaysAgo: 11, toDaysAgo: 1 },
        baselineRecurrences: '6',
        claimedAvoidedLossUsd: '9200',
      },
    ],
  },
  {
    unitKey: 'BAG',
    reason: 'MATL-FILM',
    stage: 'closed',
    title: 'Bag film shortages stopping the bagging line',
    description: 'The FFS bagger waited for film reels several times per week.',
    priority: 'Medium',
    rootCause:
      'Film reels were only called off when the last reel was mounted; the warehouse needs 45 minutes for a forklift run.',
    recommendations: [
      'Keep two reels staged at the bagger',
      'Kanban signal at one reel left',
    ],
    actions: [
      {
        title: 'Introduce a two-reel kanban at the bagger',
        description: 'Kanban card at one reel left; warehouse SLA 30 minutes.',
        ownerRole: 'engineers',
        dueInDays: -15,
        status: 'done',
      },
    ],
  },
  {
    unitKey: 'EXT1',
    reason: 'PROC-MELT',
    stage: 'closed',
    title: 'Melt pressure excursions after screen pack changes',
    description:
      'High melt pressure stops cluster in the two hours after a screen pack change.',
    priority: 'Low',
    rootCause:
      'New screen packs were installed cold; the pack heats up under flow and pressure peaks until it reaches temperature.',
    recommendations: ['Pre-heat screen packs in the oven for 30 minutes'],
    actions: [
      {
        title: 'Pre-heat screen packs before installation',
        description:
          'Oven at 220 °C for 30 minutes added to the work instruction.',
        ownerRole: 'engineers',
        dueInDays: -20,
        status: 'done',
      },
    ],
  },
];

export const SMALL_RCA_CASES: readonly CaseSpec[] = [
  {
    unitKey: 'CMP1',
    reason: 'PROC-MELT',
    stage: 'analysis',
    title: 'Melt pressure stops on Compounding Line 1',
    description:
      'Talc-filled grades show pressure peaks at the die; investigating side feeder dosing.',
    priority: 'Medium',
    rootCause: null,
    recommendations: [],
    actions: [],
  },
];
