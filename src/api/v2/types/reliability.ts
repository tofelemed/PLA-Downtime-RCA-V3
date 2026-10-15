import type { components } from '../schema';

type Schemas = components['schemas'];

/** `GET /v2/micro-stop-policies/current` (backend `micro-stop-policy-v2.controller.ts`, SME D6). */
export interface MicroStopPolicyView {
  id: string;
  /** null = the plant-wide version (also when a unit has no override) */
  unitId: string | null;
  version: number;
  microStopSeconds: number;
  microStopSecondsByAssetClass: Record<string, number>;
  tripReasonCodes: string[];
  effectiveFrom: string;
  notes: string | null;
}

export type TransitionAllowanceOption = 'planned' | 'loss';

/** `GET /v2/transition-allowance-policies/current` (engine 2.5.6). */
export interface TransitionAllowanceView {
  id: string;
  unitId: string | null;
  version: number;
  transitionAllowanceInPlan: TransitionAllowanceOption;
  effectiveFrom: string;
  notes: string | null;
}

export type StandbyEvaluation = 'demand' | 'running' | 'demand_and_running';
export type StandbyRecordKind = 'demand' | 'test' | 'run';
export type StandbyOutcome = 'success' | 'failed_start' | 'failed_while_running';

/** `GET /v2/standby-equipment` item (backend `standby-v2.view.ts`, SME D9). */
export interface StandbyEquipmentView {
  id: string;
  assetId: string;
  unitId: string;
  evaluation: StandbyEvaluation;
  notes: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  rowVersion: number;
}

export interface StandbyRecordView {
  id: string;
  assetId: string;
  unitId: string;
  kind: StandbyRecordKind;
  startedAt: string;
  endedAt: string | null;
  outcome: StandbyOutcome;
  eventId: string | null;
  externalRef: string | null;
  notes: string | null;
}

/** A ratio as the server computed it; `value` null with a `reason` when not computable. */
export interface Fraction {
  numerator: number;
  denominator: number;
  value: number | null;
  reason: string | null;
}

/** `GET /v2/standby-equipment/metrics` item. */
export interface StandbyMetricsView {
  assetId: string;
  unitId: string;
  evaluation: StandbyEvaluation;
  demands: number;
  failedStarts: number;
  failureOnDemand: Fraction;
  tests: number;
  failedTests: number;
  testFailureFraction: Fraction;
  runningSeconds: number;
  failuresWhileRunning: number;
  /** seconds per failure; null with reason `no_failures` and the exposure in `runningSeconds` */
  operatingMtbf: Fraction;
  standbySeconds: number;
}

export interface StandbyImportResult {
  total: number;
  created: number;
  updated: number;
}

export type OperationKind = 'diagnosis' | 'repair' | 'test' | 'other';

/** `GET /v2/work-order-operations` item (SME D10). */
export interface WorkOrderOperationView {
  id: string;
  workOrderId: string;
  operationId: string;
  unitId: string;
  assetId: string | null;
  eventId: string | null;
  kind: OperationKind;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  waitingSeconds: number;
  waitingReason: string | null;
  source: string;
}

export interface WorkOrderImportResult {
  total: number;
  created: number;
  updated: number;
  linked: number;
}

/** `GET /v2/work-order-operations/repair-evidence?eventId=`: server-computed active repair of a stop. */
export interface RepairEvidenceView {
  eventId: string;
  operations: number;
  activeOperations: number;
  openOperations: number;
  waitingSeconds: number;
  activeRepairSeconds: number | null;
  repairStart: string | null;
  repairEnd: string | null;
  reason: 'no_operations' | 'operation_open' | null;
}

export type PhysicalState = Schemas['StateRuleDto']['state'];

export interface StateRule {
  match: string;
  state: PhysicalState;
}

/** `GET /v2/unit-state-mappings` item (SME D1 / D2). */
export interface UnitStateMappingView {
  id: string;
  unitId: string;
  signalId: string;
  version: number;
  rules: StateRule[];
  expectedIntervalSeconds: number;
  jitterSeconds: number;
  staleAfterIntervals: number;
  isHeartbeat: boolean;
  staleAfterSeconds: number | null;
  notes: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface StateCoverage {
  scheduledSeconds: number;
  runningSeconds: number;
  knownStoppedSeconds: number;
  unknownSeconds: number;
  /** ratios 0..1 as the server computed them; null without scheduled time */
  coverage: number | null;
  availabilityLower: number | null;
  availabilityUpper: number | null;
  knownTimeAvailability: number | null;
  secondsByState: Record<string, number>;
}

export interface StateSegmentView {
  start: string;
  end: string;
  state: string;
  unknownReason: string | null;
}

/** `GET /v2/unit-state-mappings/coverage`. */
export interface UnitStateCoverageView {
  unitId: string;
  from: string;
  to: string;
  /** null = the unit has no state mapping at `from` */
  coverage: StateCoverage | null;
  segments: StateSegmentView[];
  truncated: boolean;
}

export type MicroStopPolicyBody = Schemas['MicroStopPolicyCreateDto'];
export type TransitionAllowanceBody = Schemas['TransitionAllowanceCreateDto'];
export type StandbyEquipmentBody = Schemas['StandbyEquipmentCreateDto'];
/** the generator types the nullable ISO `endedAt` as an object; the API takes an ISO string or null */
export type StandbyRecordRow = Omit<Schemas['StandbyRecordRowDto'], 'endedAt'> & { endedAt?: string | null };
export type WorkOrderOperationRow = Omit<Schemas['WorkOrderOperationRowDto'], 'endedAt'> & { endedAt?: string | null };
export type UnitStateMappingBody = Schemas['UnitStateMappingCreateDto'];
