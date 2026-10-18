/**
 * Configuration of the Marun HDPE training plant, taken from the owner's student guide (Edition 1,
 * 18 Oct 2026) and plans/DECISIONS.md "Marun HDPE training plant (owner)": the production day is
 * 17 Oct 2026 06:00 → 18 Oct 2026 06:00 Asia/Tehran (the guide's 2 Nov moved, all dates together).
 * Teaching values only, not Marun operating data.
 */
import { LegacyRole } from '../../src/auth/roles/role-model';

export const ORGANIZATION = {
  code: 'MPC-TRAIN',
  name: 'Marun',
} as const;

export const PLANT = {
  code: 'HDPE-TRAIN',
  name: 'HDPE plant',
  description:
    'Single-extruder training plant of the Marun PLA and downtime student guide (teaching values, not Marun operating data)',
  timezone: 'Asia/Tehran',
  calendarSystem: 'gregorian',
  digits: 'latin',
  weekStart: 'saturday',
} as const;

/** Instants (UTC). Asia/Tehran is UTC+03:30 all year (no daylight saving since 2022). */
export const TIMES = {
  /** commissioning instant: before the first shift; signals, state mapping and backdated policies start here */
  commissioningFrom: '2026-10-17T02:00:00.000Z',
  /** 17 Oct 2026 06:00 plant time: start of the production day, profiles, rates and the plan */
  dayStart: '2026-10-17T02:30:00.000Z',
  /** 18 Oct 2026 06:00 plant time (exclusive end of the plan) */
  dayEnd: '2026-10-18T02:30:00.000Z',
  /** 1 Oct 2026 00:00 plant time: FX, demand and valuation policy cover October */
  octoberFrom: '2026-09-30T20:30:00.000Z',
  /** 1 Nov 2026 00:00 plant time (exclusive end of the October demand status) */
  novemberFrom: '2026-10-31T20:30:00.000Z',
  /** operational date of the calendar and the crew rotations */
  operationalDate: '2026-10-17',
} as const;

export const MAIL_DOMAIN = 'hdpe-train.mpc';

export const SUPER_ADMIN = {
  email: `admin@${MAIL_DOMAIN}`,
  name: 'HDPE-TRAIN administrator',
} as const;

export type ScopeRoleName =
  | 'manager_approver'
  | 'production_accountant'
  | 'quality_approver'
  | 'metrology_approver'
  | 'finance_approver'
  | 'finance_maintainer'
  | 'production_engineer'
  | 'reliability_engineer'
  | 'integration_admin'
  | 'master_data_admin'
  | 'operator';

export interface PersonSpec {
  key: string;
  name: string;
  /** users.role; the server also grants its D06 scope role in the home plant */
  legacyRole: LegacyRole;
  /** plant-wide scope roles in HDPE-TRAIN */
  roles: readonly ScopeRoleName[];
  responsibility: string;
}

const person = (
  key: string,
  legacyRole: LegacyRole,
  roles: readonly ScopeRoleName[],
  responsibility: string,
): PersonSpec => ({
  key,
  name: key.charAt(0).toUpperCase() + key.slice(1),
  legacyRole,
  roles,
  responsibility,
});

/** Guide lesson 22 (fictional teaching personas) plus a master-data administrator and a coding verifier. */
export const PEOPLE = [
  person('leila', 'Engineer', ['production_engineer'], 'Prepares the plan'),
  person('omid', 'Operator', ['operator'], 'Records events'),
  person(
    'sara',
    'Analyst',
    ['production_accountant'],
    'Reconciles production, governs measurement authority',
  ),
  person(
    'reza',
    'Manager',
    ['manager_approver'],
    'Approves eligible work, certifies days',
  ),
  person('neda', 'Analyst', ['quality_approver'], 'Decides lot dispositions'),
  person(
    'farid',
    'Engineer',
    ['reliability_engineer'],
    'Validates failure detail, investigates causes',
  ),
  person(
    'mina',
    'Engineer',
    ['integration_admin'],
    'Configures and verifies source intake',
  ),
  person(
    'arman',
    'Analyst',
    ['metrology_approver'],
    'Reviews uncertainty budgets',
  ),
  person(
    'darya',
    'Analyst',
    ['finance_maintainer'],
    'Prepares finance policies and valuation inputs',
  ),
  person(
    'kamran',
    'Analyst',
    ['finance_approver'],
    'Approves finance and financial close',
  ),
  person(
    'maryam',
    'Manager',
    ['manager_approver'],
    'Independent RCA closure reviewer',
  ),
  person(
    'bahram',
    'Analyst',
    ['master_data_admin'],
    'Prepares hierarchy, codes, calendars and profiles',
  ),
  person(
    'shirin',
    'Engineer',
    ['production_engineer'],
    'Independent coding verifier (never codes stops)',
  ),
] as const;

export type PersonKey = (typeof PEOPLE)[number]['key'];

export const emailOf = (key: string): string => `${key}@${MAIL_DOMAIN}`;

export const UNIT = {
  code: 'Extruder1',
  name: 'HDPE Extruder 1',
  unitOfMeasure: 't',
  description:
    'Extruder production function of the training plant; owns the production account (pellet output at the extruder outlet)',
} as const;

export const ASSET = {
  code: 'EXT1-Main',
  name: 'Main drive and gearbox',
  assetType: 'Equipment',
  criticality: 'High',
  status: 'Active',
  location: 'Polymer / Line 1',
  description: 'Main drive and gearbox of HDPE Extruder 1',
} as const;

export interface ProductSpec {
  code: string;
  name: string;
  description: string;
  /** approved sustained = planning rate, t/h */
  rate: string;
  /** contribution margin, USD per t */
  margin: string;
  /** downgrade price difference, USD per t (guide lesson 21: HD5502 only) */
  downgradeDifference: string | null;
}

export const PRODUCTS: readonly ProductSpec[] = [
  {
    code: 'HD5502',
    name: 'HDPE training grade A',
    description: 'Planned and measured grade of the training production day',
    rate: '28',
    margin: '150',
    downgradeDifference: '80',
  },
  {
    code: 'TRAIN-B',
    name: 'HDPE training grade B',
    description: 'Second grade, used only in the grade-change extension',
    rate: '24',
    margin: '150',
    downgradeDifference: null,
  },
];

export const OPERATING_MODE = 'normal';
export const BOUNDARY = 'extruder_outlet';

export const PLAN = {
  name: 'Extruder1 HD5502 — 17 Oct 2026',
  productCode: 'HD5502',
  headerTarget: '672',
  shiftTarget: 224,
  shifts: 3,
  changeReason: 'Daily plan of the training production day (guide lesson 7)',
  approvalReason:
    'Reviewed: three 8-hour shifts of 224 t at the approved 28 t/h planning rate, 672 t for the day',
} as const;

export const SHIFTS = [
  { name: 'A', startLocal: '06:00', endLocal: '14:00' },
  { name: 'B', startLocal: '14:00', endLocal: '22:00' },
  { name: 'C', startLocal: '22:00', endLocal: '06:00' },
] as const;

export const CREWS = [
  { name: 'Crew A', cycle: ['A', 'B', 'C'] },
  { name: 'Crew B', cycle: ['B', 'C', 'A'] },
  { name: 'Crew C', cycle: ['C', 'A', 'B'] },
] as const;
